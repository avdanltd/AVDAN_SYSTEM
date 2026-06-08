from __future__ import annotations

from pydantic import BaseModel, Field


class QAInspectionResponse(BaseModel):
    id: str
    order_id: str
    agent_id: str
    hub_id: str
    result: str
    notes: str | None
    evidence_urls: list[str]
    created_at: str

    model_config = {"from_attributes": True}


class QAFailRequest(BaseModel):
    notes: str = Field(min_length=1)
    evidence_urls: list[str] = Field(default_factory=list)


class HubAnalyticsResponse(BaseModel):
    hub_id: str
    hub_name: str
    period_days: int
    orders_processed: int
    qa_pass_count: int
    qa_fail_count: int
    qa_pass_rate_pct: float
    avg_dwell_minutes: float | None


class EvidenceUploadResponse(BaseModel):
    url: str
    filename: str
