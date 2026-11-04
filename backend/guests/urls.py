"""Guest domain URL routes."""

from rest_framework.routers import SimpleRouter

from .views import GuestViewSet

app_name = "guests"

router = SimpleRouter()
router.register("", GuestViewSet, basename="guest")

urlpatterns = router.urls
