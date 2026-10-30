"""HTTP endpoints for QR management, downloads, and public redirects."""

from django.http import Http404, HttpResponse
from django.shortcuts import redirect
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView
from rest_framework.viewsets import ModelViewSet

from identity.permissions import IsManagerOrAdministrator

from .models import QrCode
from .serializers import QrCodeSerializer
from .services import generate_qr_code_bytes


class QrCodeViewSet(ModelViewSet):
    """Manager and administrator CRUD plus locally generated downloads."""

    queryset = QrCode.objects.select_related("created_by").all()
    serializer_class = QrCodeSerializer
    permission_classes = (IsManagerOrAdministrator,)

    def perform_create(self, serializer: QrCodeSerializer) -> None:
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=("get",), url_path="download/svg")
    def download_svg(self, request, pk=None) -> HttpResponse:
        return self._download(self.get_object(), "svg", "image/svg+xml")

    @action(detail=True, methods=("get",), url_path="download/png")
    def download_png(self, request, pk=None) -> HttpResponse:
        return self._download(self.get_object(), "png", "image/png")

    @staticmethod
    def _download(qr_code: QrCode, image_format: str, content_type: str) -> HttpResponse:
        response = HttpResponse(
            generate_qr_code_bytes(qr_code.identifier, image_format),
            content_type=content_type,
        )
        response["Content-Disposition"] = (
            f'attachment; filename="qr-code-{qr_code.identifier}.{image_format}"'
        )
        return response


class PublicQrRedirectView(APIView):
    """Redirect active permanent QR paths without exposing redirect targets in codes."""

    authentication_classes = ()
    permission_classes = (AllowAny,)

    def get(self, request, identifier: str) -> HttpResponse:
        try:
            qr_code = QrCode.objects.get(identifier=identifier, is_active=True)
        except QrCode.DoesNotExist as error:
            raise Http404 from error
        return redirect(qr_code.target_path, permanent=False)
