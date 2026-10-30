"""DRF serializers for permanent QR-code management."""

from rest_framework import serializers

from .models import QrCode


class QrCodeSerializer(serializers.ModelSerializer):
    """Expose only QR-code management fields, not generated binary data."""

    class Meta:
        model = QrCode
        fields = (
            "id",
            "identifier",
            "name",
            "target_path",
            "is_active",
            "created_by",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "identifier", "created_by", "created_at", "updated_at")
