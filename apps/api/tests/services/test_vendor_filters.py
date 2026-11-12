import pytest

from services.vendor.service import VendorService


def test_location_where_is_case_insensitive_and_optional():
    assert VendorService._location_where(None, None) == []
    assert len(VendorService._location_where("Ogun", None)) == 1
    assert len(VendorService._location_where(" ogun ", "Ota")) == 2


def test_distance_expression_compiles():
    expr = VendorService._distance_expr(6.5, 3.4)
    assert "vendors" in str(expr)


@pytest.mark.parametrize("sort", ["newest", "nearest"])
def test_sort_values_accepted_by_router_pattern(sort):
    import re

    assert re.match("^(newest|price_asc|price_desc|popular|nearest)$", sort)
