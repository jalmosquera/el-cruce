"""Root URL configuration."""

from django.urls import include, path

urlpatterns = [
    path("api/auth/", include("identity.urls")),
    path("api/guests/", include("guests.urls")),
    path("api/rooms/", include("rooms.urls")),
    path("api/menu/", include("menu.urls")),
    path("api/reservations/", include("reservations.urls")),
    path("api/", include("employees.urls")),
]
