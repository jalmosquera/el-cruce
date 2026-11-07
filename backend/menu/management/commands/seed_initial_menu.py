"""Load the fictional initial menu without modifying existing records."""

from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction

from menu.models import Category, Dish


CATALOG = (
    ("Entrantes", 1, "Tortilla de patatas", "Tortilla jugosa de patata y cebolla.", "8.50", ("eggs",), "01-tortilla-de-patatas.webp"),
    ("Entrantes", 2, "Croquetas de jamón", "Croquetas cremosas de jamón curado.", "9.00", ("cereals_with_gluten", "eggs", "milk"), "02-croquetas-de-jamon.webp"),
    ("Entrantes", 3, "Pimientos de padrón", "Pimientos verdes salteados con sal marina.", "7.50", (), "03-pimientos-de-padron.webp"),
    ("Entrantes", 4, "Tabla de quesos", "Selección de quesos locales con membrillo.", "13.00", ("milk", "nuts"), "04-tabla-de-quesos.webp"),
    ("Entrantes", 5, "Calamares a la romana", "Calamares frescos rebozados y limón.", "12.00", ("cereals_with_gluten", "eggs", "molluscs"), "05-calamares-a-la-romana.webp"),
    ("Entrantes", 6, "Pan cristal con tomate", "Pan tostado, tomate rallado y aceite de oliva.", "5.50", ("cereals_with_gluten",), "06-pan-cristal-con-tomate.webp"),
    ("Ensaladas", 7, "Ensalada mediterránea", "Hojas verdes, tomate, aceitunas y queso fresco.", "10.50", ("milk",), "07-ensalada-mediterranea.webp"),
    ("Ensaladas", 8, "Ensalada de burrata", "Burrata cremosa, tomates asados y albahaca.", "12.50", ("milk",), "08-ensalada-de-burrata.webp"),
    ("Ensaladas", 9, "Ensalada de quinoa", "Quinoa, verduras de temporada y cítricos.", "11.00", (), "09-ensalada-de-quinoa.webp"),
    ("Ensaladas", 10, "Ensalada César", "Pollo, parmesano, picatostes y salsa César.", "12.00", ("cereals_with_gluten", "eggs", "fish", "milk", "mustard"), "10-ensalada-cesar.webp"),
    ("Ensaladas", 11, "Tomates aliñados", "Tomates de temporada con ventresca y cebolla.", "10.00", ("fish",), "11-tomates-alinados.webp"),
    ("Arroces y pastas", 12, "Arroz meloso de setas", "Arroz cremoso con setas de temporada.", "15.50", ("celery", "milk"), "12-arroz-meloso-de-setas.webp"),
    ("Arroces y pastas", 13, "Paella de marisco", "Arroz con gambas, mejillones y calamar.", "18.50", ("crustaceans", "molluscs"), "13-paella-de-marisco.webp"),
    ("Arroces y pastas", 14, "Risotto de calabaza", "Arroz cremoso con calabaza asada y parmesano.", "15.00", ("milk",), "14-risotto-de-calabaza.webp"),
    ("Arroces y pastas", 15, "Tagliatelle boloñesa", "Pasta fresca con ragú lento de ternera.", "14.50", ("cereals_with_gluten", "eggs", "milk", "celery"), "15-tagliatelle-bolonesa.webp"),
    ("Arroces y pastas", 16, "Penne arrabbiata", "Pasta al dente con tomate, ajo y guindilla.", "12.50", ("cereals_with_gluten",), "16-penne-arrabbiata.webp"),
    ("Arroces y pastas", 17, "Lasaña vegetal", "Capas de verduras asadas, pasta y bechamel.", "13.50", ("cereals_with_gluten", "eggs", "milk"), "17-lasana-vegetal.webp"),
    ("Carnes y pescados", 18, "Entrecot a la brasa", "Entrecot de vaca con patatas rústicas.", "22.00", (), "18-entrecot-a-la-brasa.webp"),
    ("Carnes y pescados", 19, "Pollo de corral", "Muslo deshuesado con hierbas y verduras.", "16.50", (), "19-pollo-de-corral.webp"),
    ("Carnes y pescados", 20, "Carrillera al vino tinto", "Carrillera melosa con puré de patata.", "18.00", ("celery", "sulphur_dioxide_and_sulphites", "milk"), "20-carrillera-al-vino-tinto.webp"),
    ("Carnes y pescados", 21, "Hamburguesa de ternera", "Ternera, cheddar, cebolla y patatas fritas.", "15.00", ("cereals_with_gluten", "eggs", "milk", "mustard"), "21-hamburguesa-de-ternera.webp"),
    ("Carnes y pescados", 22, "Salmón a la plancha", "Salmón con crema de limón y espárragos.", "19.00", ("fish", "milk"), "22-salmon-a-la-plancha.webp"),
    ("Carnes y pescados", 23, "Bacalao confitado", "Lomo de bacalao, pisto y aceite de oliva.", "20.00", ("fish",), "23-bacalao-confitado.webp"),
    ("Carnes y pescados", 24, "Pulpo a la brasa", "Pulpo tierno con patata y pimentón.", "21.00", ("molluscs",), "24-pulpo-a-la-brasa.webp"),
    ("Postres", 25, "Tarta de queso", "Tarta cremosa al horno con frutos rojos.", "7.00", ("eggs", "milk"), "25-tarta-de-queso.webp"),
    ("Postres", 26, "Brownie de chocolate", "Brownie tibio con nueces y helado de vainilla.", "7.50", ("cereals_with_gluten", "eggs", "milk", "nuts"), "26-brownie-de-chocolate.webp"),
    ("Postres", 27, "Crema catalana", "Crema de vainilla con costra de azúcar quemada.", "6.50", ("eggs", "milk"), "27-crema-catalana.webp"),
    ("Postres", 28, "Tiramisú", "Bizcocho de café, mascarpone y cacao.", "7.00", ("cereals_with_gluten", "eggs", "milk"), "28-tiramisu.webp"),
    ("Postres", 29, "Fruta de temporada", "Selección fresca cortada al momento.", "5.50", (), "29-fruta-de-temporada.webp"),
    ("Postres", 30, "Helado artesano", "Dos bolas de helado artesano a elección.", "6.00", ("milk",), "30-helado-artesano.webp"),
)


class Command(BaseCommand):
    help = "Create the fictional initial menu without overwriting existing dishes."

    def handle(self, *args, **options) -> None:
        with transaction.atomic():
            categories: dict[str, Category] = {}
            for category_name, *_ in CATALOG:
                category, created = Category.objects.get_or_create(
                    spanish_name=category_name,
                    defaults={"is_published": True},
                )
                categories[category_name] = category
                if created:
                    self.stdout.write(f"Created category: {category_name}")

            created_count = 0
            skipped_count = 0
            for category_name, number, name, description, price, allergens, image_name in CATALOG:
                _, created = Dish.objects.get_or_create(
                    visible_number=number,
                    defaults={
                        "category": categories[category_name],
                        "spanish_name": name,
                        "spanish_description": description,
                        "image_path": f"/menu-images/{image_name}",
                        "price": Decimal(price),
                        "allergens": list(allergens),
                        "is_published": True,
                        "is_available": True,
                    },
                )
                if created:
                    created_count += 1
                else:
                    skipped_count += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Initial menu complete: {created_count} created, {skipped_count} preserved."
            )
        )
