"""Order state machine — single source of truth for all valid transitions."""
from core.exceptions import AppError, ForbiddenException


class OrderStatus:
    PENDING = "PENDING"
    PAID = "PAID"
    VENDOR_ACCEPTED = "VENDOR_ACCEPTED"
    PREPARING = "PREPARING"
    READY_FOR_PICKUP = "READY_FOR_PICKUP"
    PICKED_UP = "PICKED_UP"
    IN_TRANSIT_TO_HUB = "IN_TRANSIT_TO_HUB"
    AT_HUB = "AT_HUB"
    QA_IN_PROGRESS = "QA_IN_PROGRESS"
    QA_PASSED = "QA_PASSED"
    QA_FAILED = "QA_FAILED"
    VENDOR_REMEDIATION = "VENDOR_REMEDIATION"
    OUT_FOR_DELIVERY = "OUT_FOR_DELIVERY"
    DELIVERED = "DELIVERED"
    FAILED_DELIVERY = "FAILED_DELIVERY"
    PAYMENT_RELEASE_PENDING = "PAYMENT_RELEASE_PENDING"
    PAYMENT_RELEASED = "PAYMENT_RELEASED"
    COMPLETED = "COMPLETED"
    DISPUTED = "DISPUTED"
    DISPUTE_RESOLVED = "DISPUTE_RESOLVED"
    REFUND_INITIATED = "REFUND_INITIATED"
    VENDOR_REJECTED = "VENDOR_REJECTED"
    CANCELLED = "CANCELLED"


# {from_state: {to_state: [actor_roles_allowed]}}
# "system" = internal service calls (payment webhook, escrow release, etc.)
TRANSITIONS: dict[str, dict[str, list[str]]] = {
    OrderStatus.PENDING: {
        OrderStatus.PAID: ["system"],
        OrderStatus.CANCELLED: ["customer"],
    },
    OrderStatus.PAID: {
        OrderStatus.VENDOR_ACCEPTED: ["vendor"],
        OrderStatus.VENDOR_REJECTED: ["vendor"],
    },
    OrderStatus.VENDOR_ACCEPTED: {
        OrderStatus.PREPARING: ["vendor"],
    },
    OrderStatus.VENDOR_REJECTED: {
        OrderStatus.REFUND_INITIATED: ["system"],
    },
    OrderStatus.PREPARING: {
        OrderStatus.READY_FOR_PICKUP: ["vendor"],
    },
    OrderStatus.CANCELLED: {
        OrderStatus.REFUND_INITIATED: ["system"],
    },
    OrderStatus.READY_FOR_PICKUP: {
        OrderStatus.PICKED_UP: ["rider"],
    },
    OrderStatus.PICKED_UP: {
        OrderStatus.IN_TRANSIT_TO_HUB: ["rider"],
    },
    OrderStatus.IN_TRANSIT_TO_HUB: {
        OrderStatus.AT_HUB: ["agent"],
    },
    OrderStatus.AT_HUB: {
        OrderStatus.QA_IN_PROGRESS: ["agent"],
    },
    OrderStatus.QA_IN_PROGRESS: {
        OrderStatus.QA_PASSED: ["agent"],
        OrderStatus.QA_FAILED: ["agent"],
    },
    OrderStatus.QA_PASSED: {
        OrderStatus.OUT_FOR_DELIVERY: ["rider", "agent"],
    },
    OrderStatus.QA_FAILED: {
        OrderStatus.VENDOR_REMEDIATION: ["agent"],
    },
    OrderStatus.VENDOR_REMEDIATION: {
        OrderStatus.QA_IN_PROGRESS: ["agent"],
    },
    OrderStatus.OUT_FOR_DELIVERY: {
        OrderStatus.DELIVERED: ["rider"],
        OrderStatus.FAILED_DELIVERY: ["rider"],
    },
    OrderStatus.DELIVERED: {
        OrderStatus.PAYMENT_RELEASE_PENDING: ["system"],
        OrderStatus.DISPUTED: ["customer", "vendor"],
    },
    OrderStatus.PAYMENT_RELEASE_PENDING: {
        OrderStatus.PAYMENT_RELEASED: ["system"],
    },
    OrderStatus.PAYMENT_RELEASED: {
        OrderStatus.COMPLETED: ["system"],
    },
    OrderStatus.DISPUTED: {
        OrderStatus.DISPUTE_RESOLVED: ["admin", "support"],
    },
    OrderStatus.DISPUTE_RESOLVED: {
        OrderStatus.PAYMENT_RELEASED: ["system"],
        OrderStatus.REFUND_INITIATED: ["system"],
    },
}

# Terminal states — no further transitions possible
TERMINAL_STATES = {
    OrderStatus.COMPLETED,
    OrderStatus.REFUND_INITIATED,
    OrderStatus.FAILED_DELIVERY,
}


def validate_transition(from_state: str, to_state: str, actor_role: str) -> None:
    """Raises AppError if the transition is not allowed for the given role."""
    allowed_targets = TRANSITIONS.get(from_state)
    if not allowed_targets or to_state not in allowed_targets:
        raise AppError(
            400,
            "INVALID_TRANSITION",
            f"Cannot transition order from {from_state} to {to_state}",
        )
    allowed_roles = allowed_targets[to_state]
    if actor_role not in allowed_roles:
        raise ForbiddenException(
            f"Role '{actor_role}' cannot transition from {from_state} to {to_state}"
        )


def get_valid_transitions(from_state: str) -> list[str]:
    return list(TRANSITIONS.get(from_state, {}).keys())
