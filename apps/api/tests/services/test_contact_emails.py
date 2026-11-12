"""Customers are pointed at hello@; vendors, riders, agents and investors at info@."""
from services.notification.emails import (
    build_order_status_email,
    build_otp_email,
    contact_email_for,
)


def test_customer_gets_hello_everyone_else_gets_info() -> None:
    assert contact_email_for("customer") == "hello@avdanstore.com"
    assert contact_email_for(None) == "hello@avdanstore.com"
    for role in ("vendor", "rider", "agent", "admin", "support"):
        assert contact_email_for(role) == "info@avdanstore.com"


def test_email_footer_shows_the_right_inbox() -> None:
    assert "hello@avdanstore.com" in build_otp_email("A", "123456", "customer")
    assert "info@avdanstore.com" in build_otp_email("A", "123456", "vendor")
    vendor_mail = build_order_status_email("V", "abc", "New Order", "x", "vendor")
    assert "info@avdanstore.com" in vendor_mail and "hello@avdanstore.com" not in vendor_mail
