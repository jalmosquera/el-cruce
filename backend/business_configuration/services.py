"""Business rules for configuration updates and palette publication."""

from collections.abc import Iterable
from datetime import date, time

from django.core.exceptions import ValidationError

from .models import ConfigurationAuditEvent, PublicPalette


MINIMUM_AA_CONTRAST_RATIO = 4.5


def minutes_since_midnight(value: time) -> int:
    """Convert a local wall-clock time into minutes since local midnight."""
    return value.hour * 60 + value.minute


def interval_span(day: int, opens_at: time, closes_at: time) -> tuple[int, int]:
    """Return a weekly absolute interval, allowing a closing time after midnight."""
    if opens_at == closes_at:
        raise ValidationError({"closes_at": "Opening and closing times must differ."})
    start = day * 1440 + minutes_since_midnight(opens_at)
    end = day * 1440 + minutes_since_midnight(closes_at)
    if end <= start:
        end += 1440
    return start, end


def validate_weekly_intervals(intervals: Iterable[dict]) -> None:
    """Reject overlapping weekly intervals, including Sunday-to-Monday overlap."""
    spans: list[tuple[int, int]] = []
    for interval in intervals:
        spans.append(interval_span(interval["weekday"], interval["opens_at"], interval["closes_at"]))
    for index, (start, end) in enumerate(spans):
        for other_start, other_end in spans[index + 1 :]:
            for offset in (-7 * 1440, 0, 7 * 1440):
                if start < other_end + offset and other_start + offset < end:
                    raise ValidationError("Restaurant opening intervals cannot overlap.")


def validate_daily_intervals(intervals: Iterable[dict]) -> None:
    """Reject overlapping intervals within one special-schedule date."""
    spans = [interval_span(0, item["opens_at"], item["closes_at"]) for item in intervals]
    for index, (start, end) in enumerate(spans):
        for other_start, other_end in spans[index + 1 :]:
            if start < other_end and other_start < end:
                raise ValidationError("Special-schedule opening intervals cannot overlap.")


def validate_special_schedule_intervals(schedules: Iterable[dict]) -> None:
    """Reject special-date overlap, including cross-midnight adjacent-date intervals."""
    spans: list[tuple[int, int]] = []
    for schedule in schedules:
        schedule_date: date = schedule["date"]
        for interval in schedule["intervals"]:
            spans.append(
                interval_span(
                    schedule_date.toordinal(), interval["opens_at"], interval["closes_at"]
                )
            )
    for index, (start, end) in enumerate(spans):
        for other_start, other_end in spans[index + 1 :]:
            if start < other_end and other_start < end:
                raise ValidationError("Special-schedule opening intervals cannot overlap.")


def relative_luminance(hex_color: str) -> float:
    """Calculate WCAG relative luminance for a validated six-digit HEX color."""
    channels = [int(hex_color[index : index + 2], 16) / 255 for index in (1, 3, 5)]
    normalized = [channel / 12.92 if channel <= 0.04045 else ((channel + 0.055) / 1.055) ** 2.4 for channel in channels]
    return 0.2126 * normalized[0] + 0.7152 * normalized[1] + 0.0722 * normalized[2]


def contrast_ratio(first: str, second: str) -> float:
    """Return the WCAG contrast ratio for two six-digit HEX colors."""
    first_luminance = relative_luminance(first)
    second_luminance = relative_luminance(second)
    lighter, darker = max(first_luminance, second_luminance), min(first_luminance, second_luminance)
    return (lighter + 0.05) / (darker + 0.05)


def validate_palette_for_publication(palette: PublicPalette) -> None:
    """Require AA contrast for the public text and primary action color pairs."""
    invalid_pairs = [
        name
        for name, foreground in (("text", palette.text), ("primary", palette.primary))
        if contrast_ratio(foreground, palette.background) < MINIMUM_AA_CONTRAST_RATIO
    ]
    if invalid_pairs:
        raise ValidationError(
            {"palette": f"WCAG AA contrast is insufficient for: {', '.join(invalid_pairs)}."}
        )


def record_audit_event(*, event_type: str, actor, payload: dict | None = None) -> None:
    """Persist only the minimum identifiers needed to trace a configuration change."""
    ConfigurationAuditEvent.objects.create(
        event_type=event_type,
        actor=actor,
        payload=payload or {},
    )
