"""Persistence models for the multilingual restaurant menu."""

from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q


class TranslationLanguage(models.TextChoices):
    """Languages available for persisted menu translations."""

    ENGLISH = "en", "English"
    FRENCH = "fr", "French"
    GERMAN = "de", "German"
    ITALIAN = "it", "Italian"


class Allergen(models.TextChoices):
    """Standardized allergen codes based on the EU's 14 declarable allergens."""

    CELERY = "celery", "Celery"
    CEREALS_WITH_GLUTEN = "cereals_with_gluten", "Cereals containing gluten"
    CRUSTACEANS = "crustaceans", "Crustaceans"
    EGGS = "eggs", "Eggs"
    FISH = "fish", "Fish"
    LUPIN = "lupin", "Lupin"
    MILK = "milk", "Milk"
    MOLLUSCS = "molluscs", "Molluscs"
    MUSTARD = "mustard", "Mustard"
    NUTS = "nuts", "Nuts"
    PEANUTS = "peanuts", "Peanuts"
    SESAME = "sesame", "Sesame"
    SOYBEANS = "soybeans", "Soybeans"
    SULPHUR_DIOXIDE_AND_SULPHITES = "sulphur_dioxide_and_sulphites", "Sulphur dioxide and sulphites"


def validate_allergens(value: list[str]) -> None:
    """Ensure allergen values use the approved vocabulary without duplicates."""
    if not isinstance(value, list):
        raise ValidationError("Allergens must be a list.")

    invalid_values = set(value).difference(Allergen.values)
    if invalid_values:
        raise ValidationError("Allergens must use supported allergen codes.")
    if len(value) != len(set(value)):
        raise ValidationError("Allergens cannot contain duplicate values.")


class Category(models.Model):
    """A Spanish-source grouping for menu dishes."""

    spanish_name = models.CharField(max_length=120)
    is_published = models.BooleanField(default=False)

    class Meta:
        ordering = ("spanish_name", "pk")
        verbose_name_plural = "categories"
        constraints = [
            models.CheckConstraint(
                condition=Q(spanish_name__regex=r"\S"),
                name="menu_category_spanish_name_non_blank",
            )
        ]

    def __str__(self) -> str:
        return self.spanish_name


class Dish(models.Model):
    """A menu item with a stable customer-facing number and Spanish source content."""

    category = models.ForeignKey(
        Category,
        on_delete=models.PROTECT,
        related_name="dishes",
    )
    visible_number = models.PositiveIntegerField(unique=True)
    spanish_name = models.CharField(max_length=160)
    spanish_description = models.TextField(blank=True)
    price = models.DecimalField(decimal_places=2, max_digits=8)
    allergens = models.JSONField(default=list, validators=[validate_allergens])
    is_published = models.BooleanField(default=False)
    is_available = models.BooleanField(default=True)

    class Meta:
        ordering = ("visible_number", "pk")
        constraints = [
            models.CheckConstraint(
                condition=Q(visible_number__gt=0),
                name="menu_dish_visible_number_positive",
            ),
            models.CheckConstraint(
                condition=Q(price__gte=0),
                name="menu_dish_price_non_negative",
            ),
            models.CheckConstraint(
                condition=Q(spanish_name__regex=r"\S"),
                name="menu_dish_spanish_name_non_blank",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.visible_number} — {self.spanish_name}"


class CategoryTranslation(models.Model):
    """A manually reviewable persisted translation of a category name."""

    category = models.ForeignKey(
        Category,
        on_delete=models.CASCADE,
        related_name="translations",
    )
    language = models.CharField(choices=TranslationLanguage.choices, max_length=2)
    name = models.CharField(max_length=120)
    is_manually_reviewed = models.BooleanField(default=False)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("category", "language"),
                name="menu_category_translation_language_unique",
            ),
            models.CheckConstraint(
                condition=Q(language__in=TranslationLanguage.values),
                name="menu_category_translation_language_supported",
            ),
        ]


class DishTranslation(models.Model):
    """A manually reviewable persisted translation of dish content."""

    dish = models.ForeignKey(
        Dish,
        on_delete=models.CASCADE,
        related_name="translations",
    )
    language = models.CharField(choices=TranslationLanguage.choices, max_length=2)
    name = models.CharField(max_length=160)
    description = models.TextField(blank=True)
    is_manually_reviewed = models.BooleanField(default=False)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("dish", "language"),
                name="menu_dish_translation_language_unique",
            ),
            models.CheckConstraint(
                condition=Q(language__in=TranslationLanguage.values),
                name="menu_dish_translation_language_supported",
            ),
        ]
