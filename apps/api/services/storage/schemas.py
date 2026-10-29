from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class PresignUploadRequest(BaseModel):
    prefix: Literal["products", "vendor-logos", "qa-evidence"]
    content_type: str = Field(description="MIME type, e.g. image/jpeg")
    content_length: int = Field(gt=0, description="Exact byte length of the file to upload")
    # Only meaningful for qa-evidence, where objects are filed under their order.
    order_id: str | None = None


class PresignUploadResponse(BaseModel):
    upload_url: str = Field(description="Presigned PUT target — send the raw bytes here")
    key: str = Field(description="Object key. Store this for private objects.")
    public_url: str | None = Field(
        default=None,
        description="Durable CDN URL. Null for private prefixes, which need a presigned read.",
    )
    content_type: str = Field(description="Must be sent as the Content-Type header on the PUT")
    expires_in: int = Field(description="Seconds until upload_url stops working")
