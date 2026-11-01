"""Safe JSON errors for API endpoints without altering stable DRF error contracts."""

import logging

from django.http import JsonResponse
from django.views import defaults
from rest_framework.views import exception_handler as drf_exception_handler

logger = logging.getLogger(__name__)


def is_api_request(request) -> bool:
    """Limit API JSON error handling to the versionless API namespace."""
    return request.path.startswith("/api/")


def exception_handler(exception, context):
    """Preserve known DRF responses and mask unexpected API exceptions."""
    response = drf_exception_handler(exception, context)
    if response is not None:
        return response

    request = context.get("request")
    if request is not None and is_api_request(request):
        logger.error("Unhandled API exception")
        return JsonResponse(
            {"detail": "An unexpected server error occurred."}, status=500
        )
    return None


def api_error_400(request, exception=None):
    if is_api_request(request):
        return JsonResponse({"detail": "Bad request."}, status=400)
    return defaults.bad_request(request, exception)


def api_error_403(request, exception=None):
    if is_api_request(request):
        return JsonResponse({"detail": "Permission denied."}, status=403)
    return defaults.permission_denied(request, exception)


def api_error_404(request, exception=None):
    if is_api_request(request):
        return JsonResponse({"detail": "Not found."}, status=404)
    return defaults.page_not_found(request, exception)


def api_error_500(request):
    if is_api_request(request):
        return JsonResponse(
            {"detail": "An unexpected server error occurred."}, status=500
        )
    return defaults.server_error(request)
