"""Structured Nigerian address: the fields every address form collects, and how they combine into
the single `address` string that geocoding, rider matching and older clients still read.

The state list mirrors `NIGERIA_LOCATIONS` in packages/types/src/nigeria-locations.ts (a test keeps
them in step). Local governments are not enforced here — the apps offer them as a dependent
dropdown and the server stores what was chosen.
"""
from __future__ import annotations

from typing import Protocol

from pydantic import BaseModel, Field, field_validator

from core.exceptions import AppError

NIGERIA = "Nigeria"

NIGERIA_STATES: tuple[str, ...] = (
    "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno",
    "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu", "Gombe", "Imo", "Jigawa",
    "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara", "Lagos", "Nasarawa", "Niger", "Ogun",
    "Ondo", "Osun", "Oyo", "Plateau", "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara", "FCT",
)


class StructuredAddressFields(BaseModel):
    """Mixin for request bodies. Every field is optional so partial updates work; once any is
    sent, `apply_structured_address` insists the street, city and state end up present."""

    street: str | None = Field(default=None, max_length=200)
    city: str | None = Field(default=None, max_length=100)
    state: str | None = Field(default=None, max_length=50)
    lga: str | None = Field(default=None, max_length=100)
    country: str | None = Field(default=None, max_length=50)
    landmark: str | None = Field(default=None, max_length=200)

    @field_validator("street", "city", "lga", "landmark", mode="before")
    @classmethod
    def _strip(cls, v: object) -> object:
        return v.strip() or None if isinstance(v, str) else v

    @field_validator("state")
    @classmethod
    def _known_state(cls, v: str | None) -> str | None:
        if v is not None and v not in NIGERIA_STATES:
            raise ValueError("Choose a state from the list")
        return v

    @field_validator("country")
    @classmethod
    def _nigeria_only(cls, v: str | None) -> str | None:
        if v is not None and v != NIGERIA:
            raise ValueError("Only Nigeria is supported for now")
        return v

    def has_structured_fields(self) -> bool:
        return any(getattr(self, f) is not None for f in ("street", "city", "state", "lga", "landmark"))


def address_fields(entity: object) -> dict[str, str | None]:
    """The structured fields of a vendor/hub row, ready to splat into a response model."""
    return {f: getattr(entity, f, None) for f in ("street", "city", "lga", "state", "country", "landmark")}


class _HasAddress(Protocol):
    address: str | None
    street: str | None
    city: str | None
    state: str | None
    lga: str | None
    country: str | None
    landmark: str | None


def compose_address(
    street: str | None, city: str | None, lga: str | None, state: str | None,
    *, with_country: bool = False,
) -> str:
    """`12 Adeola Odeku St, Ado Odo/Ota, Ogun` — the string geocoders and humans read."""
    parts = [street, city, lga if lga and lga != city else None, state, NIGERIA if with_country else None]
    return ", ".join(p for p in parts if p)


def apply_structured_address(entity: _HasAddress, data: StructuredAddressFields) -> str | None:
    """Merge the sent fields onto `entity` and rebuild `entity.address`. Returns the string to
    geocode (with the country), or None if no structured field was sent."""
    if not data.has_structured_fields():
        return None
    for field in ("street", "city", "state", "lga", "landmark"):
        value = getattr(data, field)
        if value is not None:
            setattr(entity, field, value)
    entity.country = NIGERIA
    missing = [label for label, v in (("street", entity.street), ("town/city", entity.city),
                                      ("state", entity.state)) if not v]
    if missing:
        raise AppError(422, "ADDRESS_INCOMPLETE", f"Please fill in: {', '.join(missing)}")
    entity.address = compose_address(entity.street, entity.city, entity.lga, entity.state)
    return compose_address(entity.street, entity.city, entity.lga, entity.state, with_country=True)
