"""HTTP endpoints for internal menu management and the public menu."""

from django.db.models import Prefetch
from rest_framework import viewsets
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Category, CategoryTranslation, Dish, DishTranslation
from .permissions import IsMenuManagerOrAdministrator
from .serializers import (
    CategorySerializer,
    CategoryTranslationSerializer,
    DishSerializer,
    DishTranslationSerializer,
    PublicMenuQuerySerializer,
)


class CategoryViewSet(viewsets.ModelViewSet):
    """Manager and administrator CRUD operations for categories."""

    permission_classes = (IsMenuManagerOrAdministrator,)
    queryset = Category.objects.all()
    serializer_class = CategorySerializer


class DishViewSet(viewsets.ModelViewSet):
    """Manager and administrator CRUD operations for dishes."""

    permission_classes = (IsMenuManagerOrAdministrator,)
    queryset = Dish.objects.select_related("category").all()
    serializer_class = DishSerializer


class CategoryTranslationViewSet(viewsets.ModelViewSet):
    """Manager and administrator CRUD operations for category translations."""

    permission_classes = (IsMenuManagerOrAdministrator,)
    queryset = CategoryTranslation.objects.select_related("category").all()
    serializer_class = CategoryTranslationSerializer


class DishTranslationViewSet(viewsets.ModelViewSet):
    """Manager and administrator CRUD operations for dish translations."""

    permission_classes = (IsMenuManagerOrAdministrator,)
    queryset = DishTranslation.objects.select_related("dish").all()
    serializer_class = DishTranslationSerializer


class PublicMenuView(APIView):
    """Return only published menu content in a predictable selected language."""

    authentication_classes = ()
    permission_classes = (AllowAny,)

    def get(self, request) -> Response:
        query_serializer = PublicMenuQuerySerializer(data=request.query_params)
        query_serializer.is_valid(raise_exception=True)
        language = query_serializer.validated_data["language"]

        translation_filter = {"language": language} if language != "es" else {"pk__isnull": True}
        categories = (
            Category.objects.filter(is_published=True, dishes__is_published=True)
            .distinct()
            .prefetch_related(
                Prefetch(
                    "translations",
                    queryset=CategoryTranslation.objects.filter(**translation_filter),
                    to_attr="requested_translations",
                ),
                Prefetch(
                    "dishes",
                    queryset=Dish.objects.filter(is_published=True)
                    .order_by("visible_number", "pk")
                    .prefetch_related(
                        Prefetch(
                            "translations",
                            queryset=DishTranslation.objects.filter(**translation_filter),
                            to_attr="requested_translations",
                        )
                    ),
                    to_attr="published_dishes",
                ),
            )
            .order_by("spanish_name", "pk")
        )

        return Response(
            {
                "language": language,
                "categories": [self._serialize_category(category) for category in categories],
            }
        )

    @staticmethod
    def _localized_content(source_name: str, source_description: str, translations: list) -> dict:
        translation = translations[0] if translations else None
        return {
            "name": translation.name if translation else source_name,
            "spanish_name": source_name,
            "description": getattr(translation, "description", source_description)
            if translation
            else source_description,
            "spanish_description": source_description,
            "translation_available": translation is not None,
        }

    def _serialize_category(self, category: Category) -> dict:
        category_content = self._localized_content(
            category.spanish_name,
            "",
            category.requested_translations,
        )
        return {
            "id": category.pk,
            "name": category_content["name"],
            "spanish_name": category_content["spanish_name"],
            "translation_available": category_content["translation_available"],
            "dishes": [
                self._serialize_dish(dish) for dish in category.published_dishes
            ],
        }

    def _serialize_dish(self, dish: Dish) -> dict:
        content = self._localized_content(
            dish.spanish_name,
            dish.spanish_description,
            dish.requested_translations,
        )
        return {
            "id": dish.pk,
            "visible_number": dish.visible_number,
            **content,
            "price": f"{dish.price:.2f}",
            "allergens": dish.allergens,
            "is_available": dish.is_available,
        }
