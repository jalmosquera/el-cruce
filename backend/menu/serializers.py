"""DRF serializers for internal menu management and the public menu."""

from decimal import Decimal

from rest_framework import serializers

from .models import (
    Allergen,
    Category,
    CategoryTranslation,
    Dish,
    DishTranslation,
    TranslationLanguage,
    validate_allergens,
)


class CategorySerializer(serializers.ModelSerializer):
    """Internal category representation."""

    class Meta:
        model = Category
        fields = ("id", "spanish_name", "is_published")
        read_only_fields = ("id",)


class DishSerializer(serializers.ModelSerializer):
    """Internal dish representation with standardized allergen validation."""

    allergens = serializers.ListField(
        child=serializers.ChoiceField(choices=Allergen.values),
        default=list,
        required=False,
    )
    visible_number = serializers.IntegerField(min_value=1)
    price = serializers.DecimalField(
        decimal_places=2,
        max_digits=8,
        min_value=Decimal("0"),
    )

    class Meta:
        model = Dish
        fields = (
            "id",
            "category",
            "visible_number",
            "spanish_name",
            "spanish_description",
            "price",
            "allergens",
            "is_published",
            "is_available",
        )
        read_only_fields = ("id",)

    def validate_allergens(self, value: list[str]) -> list[str]:
        validate_allergens(value)
        return value

    def validate(self, attrs: dict) -> dict:
        """Keep the public-facing dish number stable after creation."""
        if (
            self.instance is not None
            and "visible_number" in attrs
            and attrs["visible_number"] != self.instance.visible_number
        ):
            raise serializers.ValidationError(
                {"visible_number": "This field cannot be changed after creation."}
            )
        return attrs


class CategoryTranslationSerializer(serializers.ModelSerializer):
    """Internal category translation representation."""

    class Meta:
        model = CategoryTranslation
        fields = ("id", "category", "language", "name", "is_manually_reviewed")
        read_only_fields = ("id",)


class DishTranslationSerializer(serializers.ModelSerializer):
    """Internal dish translation representation."""

    class Meta:
        model = DishTranslation
        fields = (
            "id",
            "dish",
            "language",
            "name",
            "description",
            "is_manually_reviewed",
        )
        read_only_fields = ("id",)


class PublicMenuQuerySerializer(serializers.Serializer):
    """Validate supported public-menu language selection."""

    language = serializers.ChoiceField(
        choices=("es", *TranslationLanguage.values),
        default="es",
        required=False,
    )
