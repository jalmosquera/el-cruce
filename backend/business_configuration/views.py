"""HTTP endpoints for business configuration and public published settings."""

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from identity.permissions import IsManagerOrAdministrator

from .models import (
    AccommodationException,
    BusinessConfiguration,
    PublicPalette,
    RestaurantSpecialSchedule,
    RestaurantSpecialScheduleInterval,
    RestaurantWeeklySchedule,
)
from .serializers import (
    AccommodationSettingsSerializer,
    CustomPublicPaletteSerializer,
    PublicPaletteSerializer,
    RestaurantScheduleSerializer,
    serialize_accommodation_settings,
    serialize_restaurant_schedule,
)
from .services import record_audit_event, validate_palette_for_publication


class PublicConfigurationView(APIView):
    """Return only configuration that has been explicitly published."""

    authentication_classes = ()
    permission_classes = (AllowAny,)

    def get(self, request) -> Response:
        configuration = BusinessConfiguration.objects.select_related("published_palette").filter(
            singleton=True
        ).first()
        return Response(
            {
                "restaurant": serialize_restaurant_schedule(),
                "accommodation": serialize_accommodation_settings(configuration),
                "palette": (
                    PublicPaletteSerializer(configuration.published_palette).data
                    if configuration and configuration.published_palette
                    else None
                ),
            }
        )


class ConfigurationOverviewView(APIView):
    """Return the manager-only complete configuration overview."""

    permission_classes = (IsManagerOrAdministrator,)

    def get(self, request) -> Response:
        configuration = BusinessConfiguration.objects.select_related(
            "draft_palette", "published_palette"
        ).filter(singleton=True).first()
        return Response(
            {
                "restaurant": serialize_restaurant_schedule(),
                "accommodation": serialize_accommodation_settings(configuration),
                "draft_palette": (
                    PublicPaletteSerializer(configuration.draft_palette).data
                    if configuration and configuration.draft_palette
                    else None
                ),
                "published_palette": (
                    PublicPaletteSerializer(configuration.published_palette).data
                    if configuration and configuration.published_palette
                    else None
                ),
            }
        )


class RestaurantScheduleView(APIView):
    """Manage the complete restaurant schedule in one atomic replacement."""

    permission_classes = (IsManagerOrAdministrator,)

    def get(self, request) -> Response:
        return Response(serialize_restaurant_schedule())

    def put(self, request) -> Response:
        serializer = RestaurantScheduleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            RestaurantWeeklySchedule.objects.all().delete()
            RestaurantSpecialSchedule.objects.all().delete()
            RestaurantWeeklySchedule.objects.bulk_create(
                [RestaurantWeeklySchedule(**interval) for interval in serializer.validated_data["weekly_schedules"]]
            )
            special_schedules = []
            for special in serializer.validated_data["special_schedules"]:
                intervals = special.pop("intervals")
                special_schedule = RestaurantSpecialSchedule.objects.create(**special)
                special_schedules.extend(
                    RestaurantSpecialScheduleInterval(special_schedule=special_schedule, **interval)
                    for interval in intervals
                )
            RestaurantSpecialScheduleInterval.objects.bulk_create(special_schedules)
            record_audit_event(event_type="restaurant_schedule_replaced", actor=request.user)
        return Response(serialize_restaurant_schedule())


class AccommodationSettingsView(APIView):
    """Manage accommodation operational settings in one atomic replacement."""

    permission_classes = (IsManagerOrAdministrator,)

    def get(self, request) -> Response:
        configuration = BusinessConfiguration.objects.filter(singleton=True).first()
        return Response(serialize_accommodation_settings(configuration))

    def put(self, request) -> Response:
        configuration = BusinessConfiguration.objects.filter(singleton=True).first()
        serializer = AccommodationSettingsSerializer(
            configuration or BusinessConfiguration(), data=request.data
        )
        serializer.is_valid(raise_exception=True)
        exceptions = serializer.validated_data.pop("exceptions", [])
        with transaction.atomic():
            configuration = BusinessConfiguration.get_solo()
            serializer.instance = configuration
            serializer.save()
            AccommodationException.objects.all().delete()
            AccommodationException.objects.bulk_create(
                [AccommodationException(**exception) for exception in exceptions]
            )
            record_audit_event(event_type="accommodation_settings_replaced", actor=request.user)
        return Response(serialize_accommodation_settings(configuration))


class PaletteListCreateView(APIView):
    """List public palettes and create custom five-colour alternatives."""

    permission_classes = (IsManagerOrAdministrator,)

    def get(self, request) -> Response:
        return Response(PublicPaletteSerializer(PublicPalette.objects.all(), many=True).data)

    def post(self, request) -> Response:
        serializer = CustomPublicPaletteSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            palette = serializer.save()
            record_audit_event(
                event_type="custom_palette_created", actor=request.user, payload={"palette_id": palette.pk}
            )
        return Response(PublicPaletteSerializer(palette).data, status=status.HTTP_201_CREATED)


class DraftPaletteView(APIView):
    """Select a palette for private draft preview without changing public output."""

    permission_classes = (IsManagerOrAdministrator,)

    def put(self, request) -> Response:
        palette_id = request.data.get("palette_id")
        try:
            palette = PublicPalette.objects.get(pk=palette_id)
        except (PublicPalette.DoesNotExist, TypeError, ValueError) as error:
            raise ValidationError({"palette_id": "A valid palette ID is required."}) from error
        with transaction.atomic():
            configuration = BusinessConfiguration.get_solo()
            configuration.draft_palette = palette
            configuration.save(update_fields=("draft_palette", "updated_at"))
            record_audit_event(
                event_type="draft_palette_selected", actor=request.user, payload={"palette_id": palette.pk}
            )
        return Response(PublicPaletteSerializer(palette).data)


class PublishPaletteView(APIView):
    """Publish the selected draft palette only when required contrast is AA."""

    permission_classes = (IsManagerOrAdministrator,)

    def post(self, request) -> Response:
        with transaction.atomic():
            configuration = BusinessConfiguration.objects.select_for_update().get_or_create(singleton=True)[0]
            if configuration.draft_palette is None:
                raise ValidationError({"palette": "Select a draft palette before publishing."})
            try:
                validate_palette_for_publication(configuration.draft_palette)
            except DjangoValidationError as error:
                raise ValidationError(error.message_dict) from error
            configuration.published_palette = configuration.draft_palette
            configuration.save(update_fields=("published_palette", "updated_at"))
            record_audit_event(
                event_type="palette_published",
                actor=request.user,
                payload={"palette_id": configuration.published_palette_id},
            )
        return Response(PublicPaletteSerializer(configuration.published_palette).data)
