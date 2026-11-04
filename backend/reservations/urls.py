"""Reservation domain URL routes."""

from rest_framework.routers import SimpleRouter

from .views import ReservationViewSet

app_name = "reservations"

router = SimpleRouter()
router.register("", ReservationViewSet, basename="reservation")

urlpatterns = router.urls
