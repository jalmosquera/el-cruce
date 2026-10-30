"""Internal management routes for QR codes."""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import QrCodeViewSet

app_name = "qr_codes"

router = DefaultRouter()
router.register("", QrCodeViewSet, basename="qr-code")

urlpatterns = [path("", include(router.urls))]
