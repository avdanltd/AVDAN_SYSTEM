"""WebSocket tracking — real-time order + rider location via Redis Pub/Sub.

Message contract (both the initial-state burst on connect and every live pub/sub push use the
same shapes, so the frontend has one handler per type):
  {"type": "status", "status": "<OrderStatus>"}
  {"type": "location", "lat": <float>, "lng": <float>, "eta_seconds": <int|null>}
  {"type": "rider_info", "name": <str|null>, "phone": <str|null>}
"""
from __future__ import annotations

import asyncio
import json
import uuid

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from core.redis import redis_pool
from core.security import decode_token
from services.dispatch.service import calculate_eta_seconds

ws_router = APIRouter()


async def _load_order_and_rider(order_id: str) -> tuple[object | None, object | None]:
    from sqlalchemy import select

    from core.database import AsyncSessionLocal
    from services.auth.models import User
    from services.dispatch.models import Rider
    from services.orders.models import Order

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Order).where(Order.id == uuid.UUID(order_id)))
        order = result.scalar_one_or_none()
        if not order or not order.rider_id:
            return order, None

        rider_result = await db.execute(
            select(Rider, User).join(User, User.id == Rider.user_id).where(Rider.id == order.rider_id)
        )
        row = rider_result.first()
        return order, row


async def _send_initial_state(websocket: WebSocket, order_id: str, redis) -> object | None:  # type: ignore[type-arg]
    """Sends the current status, last known rider location, and rider info (each as its own
    message, same shape as the live pub/sub pushes). Returns the order, or None if not found."""
    order, rider_row = await _load_order_and_rider(order_id)
    if not order:
        await websocket.send_text(json.dumps({"type": "error", "message": "Order not found"}))
        return None

    await websocket.send_text(json.dumps({"type": "status", "status": order.status}))

    if order.rider_id:
        raw = await redis.get(f"rider:location:{order.rider_id}")
        if raw:
            loc = json.loads(raw)
            eta_seconds = None
            addr = order.delivery_address or {}
            dest_lat, dest_lng = addr.get("lat"), addr.get("lng")
            if dest_lat and dest_lng:
                eta_seconds = calculate_eta_seconds(loc["lat"], loc["lng"], dest_lat, dest_lng)
            await websocket.send_text(json.dumps({
                "type": "location", "lat": loc["lat"], "lng": loc["lng"], "eta_seconds": eta_seconds,
            }))

        if rider_row:
            _rider, user = rider_row
            await websocket.send_text(json.dumps({
                "type": "rider_info", "name": user.name, "phone": user.phone,
            }))

    return order


@ws_router.websocket("/order/{order_id}")
async def order_tracking(websocket: WebSocket, order_id: str) -> None:
    # ── Auth: valid token, and the caller must own this order (or be staff) ──────
    token = websocket.cookies.get("avdan_token")
    if not token:
        await websocket.close(code=1008, reason="Authentication required")
        return

    payload = decode_token(token)
    if not payload:
        await websocket.close(code=1008, reason="Invalid or expired token")
        return

    user_id, role = payload.get("sub"), payload.get("role")
    order, _rider_row = await _load_order_and_rider(order_id)
    if not order:
        await websocket.close(code=1008, reason="Order not found")
        return
    is_owner = role == "customer" and str(order.customer_id) == str(user_id)
    is_staff = role in ("admin", "support")
    if not (is_owner or is_staff):
        await websocket.close(code=1008, reason="Not authorized for this order")
        return

    await websocket.accept()

    import redis.asyncio as aioredis
    redis = aioredis.Redis(connection_pool=redis_pool)

    await _send_initial_state(websocket, order_id, redis)

    pubsub = redis.pubsub()
    await pubsub.subscribe(f"order:{order_id}")

    async def _listen_pubsub() -> None:
        async for message in pubsub.listen():
            if message["type"] != "message":
                continue
            try:
                data = json.loads(message["data"])
            except (json.JSONDecodeError, TypeError):
                continue

            # Enrich location pushes with ETA
            if data.get("type") == "location":
                addr = await _get_delivery_address(order_id)
                dest_lat, dest_lng = addr.get("lat"), addr.get("lng")
                if dest_lat and dest_lng:
                    data["eta_seconds"] = calculate_eta_seconds(
                        data["lat"], data["lng"], dest_lat, dest_lng
                    )

            try:
                await websocket.send_text(json.dumps(data))
            except Exception:
                break

    async def _listen_ws() -> None:
        try:
            while True:
                await websocket.receive_text()  # keep connection alive, handle ping
        except (WebSocketDisconnect, Exception):
            pass

    tasks = [
        asyncio.create_task(_listen_pubsub()),
        asyncio.create_task(_listen_ws()),
    ]
    try:
        _done, pending = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
    finally:
        for task in pending:
            task.cancel()
        await pubsub.unsubscribe(f"order:{order_id}")
        await pubsub.close()


async def _get_delivery_address(order_id: str) -> dict:
    from sqlalchemy import select

    from core.database import AsyncSessionLocal
    from services.orders.models import Order
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Order.delivery_address).where(Order.id == uuid.UUID(order_id))
        )
        row = result.scalar_one_or_none()
        return row or {}
