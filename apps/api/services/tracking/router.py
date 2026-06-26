"""WebSocket tracking — real-time order + rider location via Redis Pub/Sub."""
from __future__ import annotations

import asyncio
import json
import uuid

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from core.redis import redis_pool
from core.security import decode_token
from services.dispatch.service import calculate_eta_seconds

ws_router = APIRouter()


async def _get_initial_state(order_id: str, redis) -> dict:  # type: ignore[type-arg]
    """Fetch current order status and last known rider location from Redis."""
    from sqlalchemy import select

    from core.database import AsyncSessionLocal
    from services.orders.models import Order

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Order).where(Order.id == uuid.UUID(order_id))
        )
        order = result.scalar_one_or_none()
        if not order:
            return {"type": "error", "message": "Order not found"}

        state: dict = {
            "type": "initial_state",
            "order_id": order_id,
            "status": order.status,
            "rider_location": None,
            "eta_seconds": None,
        }

        if order.rider_id:
            raw = await redis.get(f"rider:location:{order.rider_id}")
            if raw:
                loc = json.loads(raw)
                state["rider_location"] = loc
                # Compute ETA if delivery address has coordinates
                addr = order.delivery_address or {}
                dest_lat = addr.get("lat")
                dest_lng = addr.get("lng")
                if dest_lat and dest_lng:
                    state["eta_seconds"] = calculate_eta_seconds(
                        loc["lat"], loc["lng"], dest_lat, dest_lng
                    )

    return state


@ws_router.websocket("/order/{order_id}")
async def order_tracking(websocket: WebSocket, order_id: str) -> None:
    # ── Auth: validate JWT cookie before accepting ────────────────────────────
    token = websocket.cookies.get("avdan_token")
    if not token:
        await websocket.close(code=1008, reason="Authentication required")
        return

    payload = decode_token(token)
    if not payload:
        await websocket.close(code=1008, reason="Invalid or expired token")
        return

    await websocket.accept()

    import redis.asyncio as aioredis
    redis = aioredis.Redis(connection_pool=redis_pool)

    # Send initial state on connect
    initial = await _get_initial_state(order_id, redis)
    await websocket.send_text(json.dumps(initial))

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

            # Enrich location_update messages with ETA
            if data.get("type") == "location_update":
                addr = await _get_delivery_address(order_id)
                dest_lat = addr.get("lat")
                dest_lng = addr.get("lng")
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
