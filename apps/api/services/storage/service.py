"""
Object storage on Cloudflare R2 (S3-compatible).

One bucket, split by prefix:

    products/{uuid}.{ext}              public  — served from R2_PUBLIC_BASE_URL
    vendor-logos/{uuid}.{ext}          public  — served from R2_PUBLIC_BASE_URL
    qa-evidence/{order_id}/{uuid}.{ext}  PRIVATE — presigned reads only

Uploads are presigned PUTs: the client sends bytes straight to R2 and they never pass through
this API, so an 8 MB photo costs us no memory and no request time. What we keep is the part that
actually needs a server — deciding whether the caller may write to that prefix, and choosing the
key. The client cannot name its own key, so it cannot overwrite somebody else's object.

QA evidence is deliberately not public. It is photographic proof attached to a dispute, and a
public CDN URL is unguessable rather than access-controlled — URLs leak through logs, screenshots
and support tickets. Reads go through `GET /uploads/qa-evidence/...`, which applies the same role
check as the rest of the hub API and then redirects to a short-lived presigned URL.

!!! REQUIRED CLOUDFLARE RULE — the API gate alone is NOT sufficient !!!
    R2_PUBLIC_BASE_URL is bound to the whole bucket, so Cloudflare will happily serve
    cdn.avdanstore.com/qa-evidence/... to anyone who has the key, bypassing every check in this
    file. Verified 2026-08-22: it returned 200 with the real image.
    Close it with a WAF custom rule on the CDN hostname:

        (http.host eq "cdn.avdanstore.com" and starts_with(http.request.uri.path, "/qa-evidence/"))
        -> Block

    Nothing in this codebase can enforce that; it lives in the Cloudflare dashboard.
    See BACKLOG_HARMONISATION.md §2 for the full setup checklist.
"""
from __future__ import annotations

import uuid
from typing import Literal

import aioboto3
from botocore.config import Config

from core.config import settings
from core.exceptions import AppError, ValidationException

# Prefixes callers may write to, and whether objects under them are world-readable.
PUBLIC_PREFIXES = {"products", "vendor-logos"}
PRIVATE_PREFIXES = {"qa-evidence"}
ALLOWED_PREFIXES = PUBLIC_PREFIXES | PRIVATE_PREFIXES

UploadPrefix = Literal["products", "vendor-logos", "qa-evidence"]

# Only formats a browser and React Native can both render. SVG is excluded on purpose: it can
# carry script, and it would be served from our own CDN origin.
ALLOWED_CONTENT_TYPES: dict[str, str] = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/heic": ".heic",
}

_PUT_TTL_SECONDS = 300  # 5 min — long enough for a slow mobile upload, short enough to be cheap
_GET_TTL_SECONDS = 300


def _require_enabled() -> None:
    if not settings.storage_enabled:
        raise AppError(
            503,
            "STORAGE_NOT_CONFIGURED",
            "File storage is not configured on this environment.",
        )


def _session_kwargs() -> dict:
    return {
        "endpoint_url": settings.r2_endpoint_url,
        "aws_access_key_id": settings.r2_access_key_id,
        "aws_secret_access_key": settings.r2_secret_access_key,
        # R2 ignores the region but the SDK insists on one being set.
        "region_name": "auto",
        # R2 only implements SigV4.
        "config": Config(signature_version="s3v4"),
    }


def public_url_for(key: str) -> str:
    return f"{settings.r2_public_base_url.rstrip('/')}/{key.lstrip('/')}"


def build_key(prefix: UploadPrefix, content_type: str, scope_id: str | None = None) -> str:
    """
    Server-chosen object key. The client never supplies one — otherwise it could overwrite
    another vendor's product image by guessing a path.
    """
    if prefix not in ALLOWED_PREFIXES:
        raise ValidationException(f"Unknown upload prefix '{prefix}'")

    ext = ALLOWED_CONTENT_TYPES.get(content_type)
    if not ext:
        allowed = ", ".join(sorted(ALLOWED_CONTENT_TYPES))
        raise ValidationException(f"Unsupported image type '{content_type}'. Allowed: {allowed}")

    name = f"{uuid.uuid4().hex}{ext}"
    if scope_id:
        return f"{prefix}/{scope_id}/{name}"
    return f"{prefix}/{name}"


class StorageService:
    async def create_upload_url(
        self,
        prefix: UploadPrefix,
        content_type: str,
        content_length: int,
        scope_id: str | None = None,
    ) -> dict:
        """
        Presign a PUT the client can upload to directly.

        `content_length` is checked here AND pinned into the signature, so a client cannot
        declare 1 MB to pass validation and then upload 500 MB — R2 rejects any body whose
        length does not match what was signed.
        """
        _require_enabled()

        if content_length <= 0:
            raise ValidationException("content_length must be greater than zero")
        if content_length > settings.max_upload_bytes:
            limit_mb = settings.max_upload_bytes / (1024 * 1024)
            raise ValidationException(f"File is too large. Maximum size is {limit_mb:.0f} MB.")

        key = build_key(prefix, content_type, scope_id)

        session = aioboto3.Session()
        async with session.client("s3", **_session_kwargs()) as s3:
            upload_url = await s3.generate_presigned_url(
                "put_object",
                Params={
                    "Bucket": settings.r2_bucket,
                    "Key": key,
                    "ContentType": content_type,
                    "ContentLength": content_length,
                },
                ExpiresIn=_PUT_TTL_SECONDS,
            )

        is_public = prefix in PUBLIC_PREFIXES
        return {
            "upload_url": upload_url,
            "key": key,
            # Only public prefixes get a durable URL. For private ones the caller stores the key
            # and fetches a fresh presigned read when it actually needs to display the image.
            "public_url": public_url_for(key) if is_public else None,
            "content_type": content_type,
            "expires_in": _PUT_TTL_SECONDS,
        }

    async def put_object(
        self, prefix: UploadPrefix, body: bytes, content_type: str, scope_id: str | None = None
    ) -> str:
        """
        Upload bytes we already hold, returning the object key.

        Used by the server-side path (web-hub's multipart QA upload) where the file has already
        reached us. Mobile clients should presign instead — see `create_upload_url` — so that
        large images never occupy an API worker.
        """
        _require_enabled()

        if len(body) > settings.max_upload_bytes:
            limit_mb = settings.max_upload_bytes / (1024 * 1024)
            raise ValidationException(f"File is too large. Maximum size is {limit_mb:.0f} MB.")

        key = build_key(prefix, content_type, scope_id)
        session = aioboto3.Session()
        async with session.client("s3", **_session_kwargs()) as s3:
            await s3.put_object(
                Bucket=settings.r2_bucket,
                Key=key,
                Body=body,
                ContentType=content_type,
            )
        return key

    async def create_download_url(self, key: str) -> str:
        """Short-lived read URL for a private object. Callers must authorise first."""
        _require_enabled()
        session = aioboto3.Session()
        async with session.client("s3", **_session_kwargs()) as s3:
            return await s3.generate_presigned_url(
                "get_object",
                Params={"Bucket": settings.r2_bucket, "Key": key},
                ExpiresIn=_GET_TTL_SECONDS,
            )

    async def delete_object(self, key: str) -> None:
        _require_enabled()
        session = aioboto3.Session()
        async with session.client("s3", **_session_kwargs()) as s3:
            await s3.delete_object(Bucket=settings.r2_bucket, Key=key)

    async def object_exists(self, key: str) -> bool:
        """Used to confirm a presigned upload actually landed before recording its URL."""
        _require_enabled()
        session = aioboto3.Session()
        async with session.client("s3", **_session_kwargs()) as s3:
            try:
                await s3.head_object(Bucket=settings.r2_bucket, Key=key)
                return True
            except Exception:
                return False
