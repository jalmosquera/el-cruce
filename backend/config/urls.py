"""Root URL configuration."""

from django.urls import include, path
from django.http import JsonResponse
from django.views import View


class HealthcheckView(View):
    """Return liveness only; do not disclose settings or database state."""

    http_method_names = ["get", "head", "options"]

    def get(self, request):
        return JsonResponse({"status": "ok"})

urlpatterns = [
    path("healthz/", HealthcheckView.as_view(), name="healthcheck"),
    path("api/auth/", include("identity.urls")),
    path("api/identity/", include("identity.directory_urls")),
    path("api/guests/", include("guests.urls")),
    path("api/rooms/", include("rooms.urls")),
    path("api/menu/", include("menu.urls")),
    path("api/qr-codes/", include("qr_codes.urls")),
    path("api/reservations/", include("reservations.urls")),
    path("api/", include("employees.urls")),
    path("q/", include("qr_codes.public_urls")),
]
