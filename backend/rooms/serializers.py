"""HTTP serializers for the rooms domain."""

from rest_framework import serializers

from .models import Room, RoomStatus


class RoomSerializer(serializers.ModelSerializer):
    """Validate and represent the internal room management resource."""

    code = serializers.CharField(max_length=32)
    capacity = serializers.IntegerField(
        min_value=1,
        error_messages={"min_value": "Capacity must be greater than zero."},
    )
    status = serializers.ChoiceField(choices=RoomStatus.choices)

    class Meta:
        model = Room
        fields = ("id", "code", "name", "capacity", "status")
        read_only_fields = ("id",)

    def validate_code(self, value: str) -> str:
        """Keep the human-facing room code stable after it has been created."""
        if self.instance is not None:
            if value != self.instance.code:
                raise serializers.ValidationError("Room code cannot be changed after creation.")
        elif Room.objects.filter(code=value).exists():
            raise serializers.ValidationError("A room with this code already exists.")
        return value
