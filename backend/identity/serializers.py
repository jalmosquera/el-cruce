"""HTTP serializers for the identity domain."""

from rest_framework import serializers

from .models import User


class CurrentUserSerializer(serializers.ModelSerializer):
    """Expose the minimum current-user representation to an authenticated client."""

    class Meta:
        model = User
        fields = ("id", "username", "role")
        read_only_fields = fields
