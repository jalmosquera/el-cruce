"""Dependency-free, secret-aware JSON console logging."""

import json
import logging
import re
from datetime import UTC, datetime

SENSITIVE_FIELD_NAMES = frozenset(
    {
        "authorization",
        "cookie",
        "password",
        "secret",
        "token",
        "database_url",
        "api_key",
    }
)
SENSITIVE_VALUE_PATTERN = re.compile(
    r"(?i)(password|secret|token|api[_-]?key|authorization)\s*[=:]\s*[^\s,;]+"
)
URL_CREDENTIAL_PATTERN = re.compile(r"(://[^:/\s]+:)[^@\s]+@")


def redact_value(value):
    """Redact common credential forms before a record reaches stdout."""
    if isinstance(value, dict):
        return {
            key: "[REDACTED]" if key.casefold() in SENSITIVE_FIELD_NAMES else redact_value(item)
            for key, item in value.items()
        }
    if isinstance(value, (list, tuple)):
        return [redact_value(item) for item in value]
    if not isinstance(value, str):
        return value
    value = URL_CREDENTIAL_PATTERN.sub(r"\1[REDACTED]@", value)
    return SENSITIVE_VALUE_PATTERN.sub(r"\1=[REDACTED]", value)


class RedactSecretsFilter(logging.Filter):
    """Remove sensitive fields and values from every configured log record."""

    def filter(self, record: logging.LogRecord) -> bool:
        record.msg = redact_value(record.getMessage())
        record.args = ()
        for key, value in tuple(record.__dict__.items()):
            if key.casefold() in SENSITIVE_FIELD_NAMES:
                record.__dict__[key] = "[REDACTED]"
            elif key not in {"msg", "args"}:
                record.__dict__[key] = redact_value(value)
        return True


class SafeJsonFormatter(logging.Formatter):
    """Emit bounded structured events and intentionally omit exception tracebacks."""

    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "timestamp": datetime.now(UTC).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": redact_value(record.getMessage()),
        }
        return json.dumps(payload, ensure_ascii=True)
