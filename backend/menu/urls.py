"""URL routes for public and internal menu APIs."""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    CategoryTranslationViewSet,
    CategoryViewSet,
    DishTranslationViewSet,
    DishViewSet,
    PublicMenuView,
)

app_name = "menu"

router = DefaultRouter()
router.register("categories", CategoryViewSet, basename="category")
router.register("dishes", DishViewSet, basename="dish")
router.register("category-translations", CategoryTranslationViewSet, basename="category-translation")
router.register("dish-translations", DishTranslationViewSet, basename="dish-translation")

urlpatterns = [
    path("public/", PublicMenuView.as_view(), name="public-menu"),
    path("", include(router.urls)),
]
