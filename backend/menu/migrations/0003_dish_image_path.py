from django.db import migrations, models

import menu.models


class Migration(migrations.Migration):
    dependencies = [("menu", "0002_menu_content_integrity_constraints")]

    operations = [
        migrations.AddField(
            model_name="dish",
            name="image_path",
            field=models.CharField(
                blank=True,
                max_length=255,
                validators=[menu.models.validate_dish_image_path],
            ),
        )
    ]
