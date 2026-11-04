"""PostgreSQL-backed tests for permanent QR-code behavior."""

import re
import xml.etree.ElementTree as element_tree
from io import BytesIO

import pytest
from django.core.exceptions import ImproperlyConfigured, ValidationError
from django.db import IntegrityError, transaction
from django.test import override_settings
from PIL import Image
from rest_framework.test import APIClient
import zxingcpp

from identity.models import User, UserRole
from qr_codes.models import QrCode
from qr_codes.services import (
    QR_BORDER_MODULES,
    QR_DARK_COLOR,
    QR_ERROR_CORRECTION,
    QR_PNG_SCALE,
    generate_qr_code_bytes,
    stable_qr_path,
    stable_qr_url,
)

pytestmark = pytest.mark.django_db

QR_CODES_URL = "/api/qr-codes/"
PASSWORD = "correct-horse-battery-staple"
SVG_NAMESPACE = "{http://www.w3.org/2000/svg}"
SVG_RASTER_SCALE = 10


def rasterize_segno_svg(svg_bytes: bytes) -> memoryview:
    """Rasterize Segno's module-aligned SVG paths for independent QR decoding."""
    root = element_tree.fromstring(svg_bytes)
    width = int(root.attrib["width"])
    height = int(root.attrib["height"])
    pixels = bytearray([255]) * (width * SVG_RASTER_SCALE * height * SVG_RASTER_SCALE)

    def paint_modules(start_x: float, center_y: float, length: float) -> None:
        left = round(start_x * SVG_RASTER_SCALE)
        right = round((start_x + length) * SVG_RASTER_SCALE)
        top = round((center_y - 0.5) * SVG_RASTER_SCALE)
        bottom = round((center_y + 0.5) * SVG_RASTER_SCALE)
        raster_width = width * SVG_RASTER_SCALE
        for row in range(top, bottom):
            pixels[row * raster_width + left : row * raster_width + right] = b"\x00" * (
                right - left
            )

    qr_path = root.find(f"{SVG_NAMESPACE}path[@class='qrline']")
    assert qr_path is not None
    tokens = re.findall(r"[MmHhVv]|-?\d+(?:\.\d+)?", qr_path.attrib["d"])
    position = 0
    command = ""
    x = y = 0.0
    while position < len(tokens):
        if tokens[position].isalpha():
            command = tokens[position]
            position += 1
        if command in {"M", "m"}:
            next_x, next_y = map(float, tokens[position : position + 2])
            x, y = (next_x, next_y) if command == "M" else (x + next_x, y + next_y)
            position += 2
        elif command in {"H", "h"}:
            length = float(tokens[position])
            if command == "H":
                length -= x
            paint_modules(x, y, length)
            x += length
            position += 1
        elif command in {"V", "v"}:
            y = float(tokens[position]) if command == "V" else y + float(tokens[position])
            position += 1
        else:
            raise AssertionError(f"Unsupported SVG path command: {command}")
    return memoryview(pixels).cast(
        "B", shape=(height * SVG_RASTER_SCALE, width * SVG_RASTER_SCALE)
    )


def decode_qr_payload(image: Image.Image | memoryview) -> str:
    decoded_barcodes = zxingcpp.read_barcodes(
        image, formats=zxingcpp.BarcodeFormat.QRCode, is_pure=True
    )
    assert len(decoded_barcodes) == 1
    return decoded_barcodes[0].text


@pytest.fixture
def manager() -> User:
    return User.objects.create_user(username="qr-manager", password=PASSWORD, role=UserRole.MANAGER)


@pytest.fixture
def administrator() -> User:
    return User.objects.create_user(
        username="qr-administrator", password=PASSWORD, role=UserRole.ADMINISTRATOR
    )


@pytest.fixture
def employee() -> User:
    return User.objects.create_user(username="qr-employee", password=PASSWORD, role=UserRole.EMPLOYEE)


@pytest.fixture
def qr_code(manager: User) -> QrCode:
    return QrCode.objects.create(name="Carta principal", target_path="/carta", created_by=manager)


def authenticated_client(user: User) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def test_qr_code_persists_an_opaque_identifier_and_set_null_creator(manager: User) -> None:
    qr_code = QrCode.objects.create(name="Carta", target_path="/carta", created_by=manager)

    assert re.fullmatch(r"[0-9a-f]{32}", qr_code.identifier)
    assert qr_code.created_at is not None
    assert qr_code.updated_at is not None

    manager.delete()
    qr_code.refresh_from_db()
    assert qr_code.created_by is None


@pytest.mark.parametrize(
    "target_path",
    (
        "https://attacker.example/path",
        "//attacker.example/path",
        "/carta?next=https://attacker.example",
        "/carta#fragment",
        "carta",
        "/api/auth/login/",
    ),
)
def test_qr_code_rejects_open_redirect_and_injection_targets(target_path: str) -> None:
    qr_code = QrCode(name="Unsafe", target_path=target_path)

    with pytest.raises(ValidationError, match="approved local public path"):
        qr_code.full_clean()


def test_database_constraint_rejects_unapproved_target_path() -> None:
    with pytest.raises(IntegrityError), transaction.atomic():
        QrCode.objects.create(name="Unsafe", target_path="/api/auth/login/")


def test_public_qr_redirects_active_code_with_a_temporary_302(qr_code: QrCode) -> None:
    response = APIClient().get(f"/q/{qr_code.identifier}/")

    assert response.status_code == 302
    assert response["Location"] == "/carta"


@pytest.mark.parametrize("is_active", (False,))
def test_public_qr_returns_404_for_inactive_code(qr_code: QrCode, is_active: bool) -> None:
    qr_code.is_active = is_active
    qr_code.save(update_fields=("is_active",))

    assert APIClient().get(f"/q/{qr_code.identifier}/").status_code == 404


def test_public_qr_returns_404_for_unknown_identifier() -> None:
    assert APIClient().get(f"/q/{'a' * 32}/").status_code == 404


def test_qr_management_requires_manager_or_administrator(employee: User) -> None:
    assert APIClient().get(QR_CODES_URL).status_code == 401
    assert authenticated_client(employee).get(QR_CODES_URL).status_code == 403


def test_manager_creates_lists_and_administrator_can_manage_qr_codes(
    manager: User, administrator: User
) -> None:
    create_response = authenticated_client(manager).post(
        QR_CODES_URL,
        {"name": "Carta terraza", "target_path": "/carta"},
        format="json",
    )

    assert create_response.status_code == 201
    assert create_response.data["created_by"] == manager.pk
    assert create_response.data["identifier"]
    assert len(authenticated_client(administrator).get(QR_CODES_URL).data) == 1


def test_serializer_rejects_unsafe_target_path(manager: User) -> None:
    response = authenticated_client(manager).post(
        QR_CODES_URL,
        {"name": "Unsafe", "target_path": "https://attacker.example"},
        format="json",
    )

    assert response.status_code == 400
    assert "target_path" in response.data


def test_identifier_is_immutable_after_creation(manager: User, qr_code: QrCode) -> None:
    response = authenticated_client(manager).patch(
        f"{QR_CODES_URL}{qr_code.pk}/",
        {"identifier": "b" * 32, "name": "Renamed"},
        format="json",
    )

    assert response.status_code == 200
    qr_code.refresh_from_db()
    assert qr_code.identifier != "b" * 32
    assert qr_code.name == "Renamed"


@pytest.mark.parametrize(
    ("image_format", "content_type", "signature"),
    (
        ("svg", "image/svg+xml", b"<svg"),
        ("png", "image/png", b"\x89PNG\r\n\x1a\n"),
    ),
)
def test_protected_downloads_return_correct_type_and_generated_bytes(
    manager: User,
    qr_code: QrCode,
    image_format: str,
    content_type: str,
    signature: bytes,
) -> None:
    response = authenticated_client(manager).get(
        f"{QR_CODES_URL}{qr_code.pk}/download/{image_format}/"
    )

    assert response.status_code == 200
    assert response["Content-Type"] == content_type
    assert response["Content-Disposition"] == (
        f'attachment; filename="qr-code-{qr_code.identifier}.{image_format}"'
    )
    assert signature in response.content


@pytest.mark.parametrize("image_format", ("svg", "png"))
def test_downloaded_qr_exports_decode_to_the_absolute_public_redirect_url(
    manager: User, qr_code: QrCode, image_format: str
) -> None:
    response = authenticated_client(manager).get(
        f"{QR_CODES_URL}{qr_code.pk}/download/{image_format}/"
    )

    assert response.status_code == 200
    image = (
        rasterize_segno_svg(response.content)
        if image_format == "svg"
        else Image.open(BytesIO(response.content))
    )
    assert decode_qr_payload(image) == f"https://elcruce.test/q/{qr_code.identifier}/"


def test_qr_generation_is_deterministic_and_preserves_rendering_configuration(
    qr_code: QrCode,
) -> None:
    svg_first = generate_qr_code_bytes(qr_code.identifier, "svg")
    svg_second = generate_qr_code_bytes(qr_code.identifier, "svg")
    png_first = generate_qr_code_bytes(qr_code.identifier, "png")
    png_second = generate_qr_code_bytes(qr_code.identifier, "png")

    assert stable_qr_path(qr_code.identifier) == f"/q/{qr_code.identifier}/"
    assert stable_qr_url(qr_code.identifier) == f"https://elcruce.test/q/{qr_code.identifier}/"
    assert svg_first == svg_second
    assert png_first == png_second
    assert QR_ERROR_CORRECTION == "h"
    assert QR_BORDER_MODULES >= 4
    assert QR_PNG_SCALE == 10
    assert QR_DARK_COLOR in svg_first.decode()
    assert 'fill="#fff"' in svg_first.decode()


def test_qr_generation_fails_closed_without_a_public_site_url(qr_code: QrCode) -> None:
    with override_settings(PUBLIC_SITE_URL=None), pytest.raises(
        ImproperlyConfigured, match="PUBLIC_SITE_URL"
    ):
        generate_qr_code_bytes(qr_code.identifier, "svg")
