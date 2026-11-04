"""Public, stable routes encoded in generated QR codes."""

from django.urls import path

from .views import PublicQrRedirectView

app_name = "qr_codes_public"

urlpatterns = [
    path("<str:identifier>/", PublicQrRedirectView.as_view(), name="public-qr-redirect"),
]
