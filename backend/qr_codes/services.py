"""Local, deterministic QR-code rendering."""

from io import BytesIO

import segno

QR_ERROR_CORRECTION = "h"
QR_BORDER_MODULES = 4
QR_PNG_SCALE = 10
QR_DARK_COLOR = "#111827"
QR_LIGHT_COLOR = "#ffffff"


def stable_qr_path(identifier: str) -> str:
    """Return the only payload encoded in a permanent QR code."""
    return f"/q/{identifier}/"


def generate_qr_code_bytes(identifier: str, image_format: str) -> bytes:
    """Generate a print-oriented QR image without persisting generated blobs."""
    qr_code = segno.make(
        stable_qr_path(identifier),
        error=QR_ERROR_CORRECTION,
        micro=False,
        boost_error=False,
    )
    output = BytesIO()
    qr_code.save(
        output,
        kind=image_format,
        border=QR_BORDER_MODULES,
        dark=QR_DARK_COLOR,
        light=QR_LIGHT_COLOR,
        scale=QR_PNG_SCALE if image_format == "png" else 1,
    )
    return output.getvalue()
