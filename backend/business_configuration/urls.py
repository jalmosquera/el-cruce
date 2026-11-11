"""URL routes for business configuration APIs."""

from django.urls import path

from .views import (
    AccommodationSettingsView,
    ConfigurationOverviewView,
    DraftPaletteView,
    PaletteListCreateView,
    PublicConfigurationView,
    PublishPaletteView,
    RestaurantScheduleView,
)

app_name = "business_configuration"

urlpatterns = [
    path("public/", PublicConfigurationView.as_view(), name="public"),
    path("", ConfigurationOverviewView.as_view(), name="overview"),
    path("restaurant-schedule/", RestaurantScheduleView.as_view(), name="restaurant-schedule"),
    path("accommodation/", AccommodationSettingsView.as_view(), name="accommodation"),
    path("palettes/", PaletteListCreateView.as_view(), name="palettes"),
    path("draft-palette/", DraftPaletteView.as_view(), name="draft-palette"),
    path("publish-palette/", PublishPaletteView.as_view(), name="publish-palette"),
]
