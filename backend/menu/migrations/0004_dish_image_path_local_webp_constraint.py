from django.db import migrations, models
from django.db.models import Q


MENU_IMAGE_PATH_REGEX = (
    r"^/menu-images/(?:[A-Za-z0-9_-](?:[A-Za-z0-9_.-]*[A-Za-z0-9_-])?/)*"
    r"[A-Za-z0-9_-](?:[A-Za-z0-9_.-]*[A-Za-z0-9_-])?\.webp$"
)


class Migration(migrations.Migration):
    dependencies = [("menu", "0003_dish_image_path")]

    operations = [
        migrations.AddConstraint(
            model_name="dish",
            constraint=models.CheckConstraint(
                condition=Q(("image_path", ""))
                | Q(("image_path__regex", MENU_IMAGE_PATH_REGEX)),
                name="menu_dish_image_path_local_webp",
            ),
        )
    ]
