import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("business_configuration", "0001_initial")]

    operations = [
        migrations.AlterField(
            model_name="configurationauditevent",
            name="actor",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="configuration_audit_events",
                to=settings.AUTH_USER_MODEL,
            ),
        )
    ]
