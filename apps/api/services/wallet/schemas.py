from pydantic import BaseModel, Field


class WalletSummaryResponse(BaseModel):
    # Money states, in the order a naira travels through them.
    ongoing_kobo: int  # orders still in progress (paid, not yet delivered)
    clearing_kobo: int  # delivered, inside the dispute window — not withdrawable yet (vendors only)
    on_hold_kobo: int  # orders under dispute
    available_kobo: int  # withdrawable now
    requested_kobo: int  # in a payout request awaiting admin / transfer in flight
    paid_out_kobo: int  # collected: admin approved and Paystack confirmed
    lifetime_earned_kobo: int
    min_withdrawal_kobo: int
    has_payout_account: bool


class WalletEntryResponse(BaseModel):
    id: str
    kind: str
    amount_kobo: int
    order_id: str | None
    payout_request_id: str | None
    metadata: dict | None
    created_at: str


class PaginatedWalletEntriesResponse(BaseModel):
    items: list[WalletEntryResponse]
    total: int
    page: int
    page_size: int


class CreatePayoutRequest(BaseModel):
    amount_kobo: int = Field(gt=0)


class ApprovePayoutRequest(BaseModel):
    approved_kobo: int = Field(gt=0)
    note: str | None = Field(default=None, max_length=500)


class RejectPayoutRequest(BaseModel):
    note: str = Field(min_length=3, max_length=500)


class PayoutEventResponse(BaseModel):
    id: str
    event: str
    actor_id: str | None
    actor_role: str
    amount_kobo: int | None
    note: str | None
    created_at: str


class PayoutRequestResponse(BaseModel):
    id: str
    owner_type: str
    owner_id: str
    owner_name: str | None
    requested_kobo: int
    approved_kobo: int | None
    status: str
    destination: dict | None
    decided_by: str | None
    decided_at: str | None
    decision_note: str | None
    paid_at: str | None
    failure_reason: str | None
    created_at: str
    events: list[PayoutEventResponse] | None = None
    # Admin detail view only: the owner's balances at the moment of review.
    owner_available_kobo: int | None = None
    owner_lifetime_earned_kobo: int | None = None


class PaginatedPayoutRequestsResponse(BaseModel):
    items: list[PayoutRequestResponse]
    total: int
    page: int
    page_size: int
    pending_count: int
    pending_kobo: int
