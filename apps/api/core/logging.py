"""Structured JSON logging with sensitive-field redaction."""
import logging
import sys

from pythonjsonlogger import jsonlogger

SENSITIVE_KEYS = frozenset({
    "password",
    "password_hash",
    "token",
    "secret",
    "paystack_secret_key",
    "paystack_public_key",
    "fcm_server_key",
    "authorization",
    "avdan_token",
    "avdan_refresh_token",
    "x-paystack-signature",
    "secret_key",
})


class SensitiveDataFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        for key in list(vars(record).keys()):
            if key.lower() in SENSITIVE_KEYS:
                setattr(record, key, "***REDACTED***")
        msg = record.getMessage()
        for key in SENSITIVE_KEYS:
            if key in msg.lower():
                record.msg = "[log redacted — sensitive key in message]"
                record.args = ()
                break
        return True


def configure_logging(level: str = "INFO") -> None:
    handler = logging.StreamHandler(sys.stdout)
    formatter = jsonlogger.JsonFormatter(
        fmt="%(asctime)s %(name)s %(levelname)s %(message)s %(request_id)s",
        datefmt="%Y-%m-%dT%H:%M:%SZ",
        rename_fields={"asctime": "timestamp", "levelname": "level", "name": "logger"},
    )
    handler.setFormatter(formatter)
    handler.addFilter(SensitiveDataFilter())

    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(getattr(logging, level.upper(), logging.INFO))

    # Suppress noisy third-party loggers
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
