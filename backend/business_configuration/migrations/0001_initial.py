# Generated manually for the approved business configuration domain.

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models
from django.db.models import Q


PALETTES = (
    ("tierra-elegante", "Tierra Elegante", "#583F44", "#D9CBC6", "#221C27", "#A17F76", "#A45E43"),
    ("mediterraneo", "Mediterráneo", "#244A59", "#F6F3EA", "#202D35", "#89A8A2", "#C28B58"),
    ("oliva-natural", "Oliva Natural", "#46533D", "#F4F0E5", "#272C25", "#A8AD91", "#B77849"),
    ("terracota-moderna", "Terracota Moderna", "#874B3C", "#FAF3EC", "#302522", "#C5A79B", "#B66B46"),
    ("minimalista-premium", "Minimalista Premium", "#292929", "#FAF9F6", "#202020", "#A9A49D", "#927A5B"),
)


def create_predefined_palettes(apps, schema_editor):
    palette_model = apps.get_model("business_configuration", "PublicPalette")
    for key, name, primary, background, text, secondary, accent in PALETTES:
        palette_model.objects.update_or_create(
            key=key,
            defaults={
                "name": name,
                "primary": primary,
                "background": background,
                "text": text,
                "secondary": secondary,
                "accent": accent,
                "is_predefined": True,
            },
        )


class Migration(migrations.Migration):
    initial = True

    dependencies = [migrations.swappable_dependency(settings.AUTH_USER_MODEL)]

    operations = [
        migrations.CreateModel(
            name="AccommodationException",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("date", models.DateField(unique=True)),
                ("description", models.TextField(max_length=1000)),
            ],
            options={"ordering": ("date",)},
        ),
        migrations.CreateModel(
            name="PublicPalette",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("key", models.SlugField(max_length=48, unique=True)),
                ("name", models.CharField(max_length=80, unique=True)),
                ("primary", models.CharField(max_length=7)),
                ("background", models.CharField(max_length=7)),
                ("text", models.CharField(max_length=7)),
                ("secondary", models.CharField(max_length=7)),
                ("accent", models.CharField(max_length=7)),
                ("is_predefined", models.BooleanField(default=False, editable=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("created_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="created_public_palettes", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ("is_predefined", "name", "pk")},
        ),
        migrations.CreateModel(
            name="RestaurantSpecialSchedule",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("date", models.DateField(unique=True)),
                ("is_closed", models.BooleanField(default=False)),
            ],
            options={"ordering": ("date",)},
        ),
        migrations.CreateModel(
            name="RestaurantWeeklySchedule",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("weekday", models.PositiveSmallIntegerField(choices=[(0, "Monday"), (1, "Tuesday"), (2, "Wednesday"), (3, "Thursday"), (4, "Friday"), (5, "Saturday"), (6, "Sunday")])),
                ("opens_at", models.TimeField()),
                ("closes_at", models.TimeField()),
            ],
            options={"ordering": ("weekday", "opens_at", "pk")},
        ),
        migrations.CreateModel(
            name="BusinessConfiguration",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("singleton", models.BooleanField(default=True, editable=False, unique=True)),
                ("check_in_from", models.TimeField(blank=True, null=True)),
                ("check_in_until", models.TimeField(blank=True, null=True)),
                ("check_out_from", models.TimeField(blank=True, null=True)),
                ("check_out_until", models.TimeField(blank=True, null=True)),
                ("reception_from", models.TimeField(blank=True, null=True)),
                ("reception_until", models.TimeField(blank=True, null=True)),
                ("accommodation_instructions", models.TextField(blank=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("draft_palette", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name="draft_for_configurations", to="business_configuration.publicpalette")),
                ("published_palette", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name="published_for_configurations", to="business_configuration.publicpalette")),
            ],
        ),
        migrations.CreateModel(
            name="RestaurantSpecialScheduleInterval",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("opens_at", models.TimeField()),
                ("closes_at", models.TimeField()),
                ("special_schedule", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="intervals", to="business_configuration.restaurantspecialschedule")),
            ],
            options={"ordering": ("opens_at", "pk")},
        ),
        migrations.CreateModel(
            name="ConfigurationAuditEvent",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("event_type", models.CharField(max_length=48)),
                ("payload", models.JSONField(default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("actor", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="configuration_audit_events", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ("-created_at", "-pk")},
        ),
        migrations.AddConstraint(model_name="accommodationexception", constraint=models.CheckConstraint(condition=Q(("description__regex", "\\S")), name="configuration_accommodation_exception_non_blank")),
        migrations.AddConstraint(model_name="businessconfiguration", constraint=models.CheckConstraint(condition=Q(("singleton", True)), name="configuration_business_configuration_is_singleton")),
        migrations.AddConstraint(model_name="restaurantweeklyschedule", constraint=models.CheckConstraint(condition=Q(("weekday__in", [0, 1, 2, 3, 4, 5, 6])), name="configuration_weekly_schedule_weekday_valid")),
        migrations.AddConstraint(model_name="restaurantweeklyschedule", constraint=models.UniqueConstraint(fields=("weekday", "opens_at", "closes_at"), name="configuration_weekly_schedule_interval_unique")),
        migrations.AddConstraint(model_name="restaurantspecialscheduleinterval", constraint=models.UniqueConstraint(fields=("special_schedule", "opens_at", "closes_at"), name="configuration_special_schedule_interval_unique")),
        *[
            migrations.AddConstraint(model_name="publicpalette", constraint=models.CheckConstraint(condition=Q(**{f"{field}__regex": r"^#[0-9A-Fa-f]{6}$"}), name=f"configuration_palette_{field}_hex"))
            for field in ("primary", "background", "text", "secondary", "accent")
        ],
        migrations.RunPython(create_predefined_palettes, migrations.RunPython.noop),
        migrations.RunSQL(
            sql="""
                CREATE FUNCTION business_configuration_prevent_predefined_palette_mutation()
                RETURNS trigger AS $$
                BEGIN
                    IF OLD.is_predefined THEN
                        RAISE EXCEPTION 'Predefined public palettes are immutable';
                    END IF;
                    RETURN OLD;
                END;
                $$ LANGUAGE plpgsql;
                CREATE TRIGGER business_configuration_predefined_palette_immutable
                BEFORE UPDATE OR DELETE ON business_configuration_publicpalette
                FOR EACH ROW EXECUTE FUNCTION business_configuration_prevent_predefined_palette_mutation();
                CREATE FUNCTION business_configuration_prevent_audit_event_mutation()
                RETURNS trigger AS $$
                BEGIN
                    RAISE EXCEPTION 'Configuration audit events are append-only';
                END;
                $$ LANGUAGE plpgsql;
                CREATE TRIGGER business_configuration_audit_event_append_only
                BEFORE UPDATE OR DELETE ON business_configuration_configurationauditevent
                FOR EACH ROW EXECUTE FUNCTION business_configuration_prevent_audit_event_mutation();
            """,
            reverse_sql="""
                DROP TRIGGER IF EXISTS business_configuration_audit_event_append_only ON business_configuration_configurationauditevent;
                DROP FUNCTION IF EXISTS business_configuration_prevent_audit_event_mutation();
                DROP TRIGGER IF EXISTS business_configuration_predefined_palette_immutable ON business_configuration_publicpalette;
                DROP FUNCTION IF EXISTS business_configuration_prevent_predefined_palette_mutation();
            """,
        ),
    ]
