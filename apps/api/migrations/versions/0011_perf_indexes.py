"""performance indexes — rider_id, hub_id, products.available, riders composite

Revision ID: 0011
Revises: 0010
Create Date: 2026-06-16

"""
from collections.abc import Sequence

from alembic import op

revision: str = "0011"
down_revision: str | None = "0010"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Rider fetching their active orders (dispatch router)
    op.create_index("ix_orders_rider_id", "orders", ["rider_id"])
    # Hub agent querying inbound orders scoped to hub
    op.create_index("ix_orders_hub_id", "orders", ["hub_id"])
    # Product browsing — filter by availability
    op.create_index("ix_products_available", "products", ["available"])
    # Dispatch assignment — find online riders in a specific zone
    op.create_index("ix_riders_online_zone", "riders", ["online", "zone_id"])


def downgrade() -> None:
    op.drop_index("ix_riders_online_zone", "riders")
    op.drop_index("ix_products_available", "products")
    op.drop_index("ix_orders_hub_id", "orders")
    op.drop_index("ix_orders_rider_id", "orders")
