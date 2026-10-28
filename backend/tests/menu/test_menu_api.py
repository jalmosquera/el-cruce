"""PostgreSQL-backed tests for the multilingual menu APIs."""

from datetime import timedelta
from decimal import Decimal

import pytest
from django.db import IntegrityError, transaction
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken

from identity.models import User, UserRole
from menu.models import Category, CategoryTranslation, Dish, DishTranslation

pytestmark = pytest.mark.django_db

PUBLIC_MENU_URL = "/api/menu/public/"
CATEGORIES_URL = "/api/menu/categories/"
DISHES_URL = "/api/menu/dishes/"
DISH_TRANSLATIONS_URL = "/api/menu/dish-translations/"
PASSWORD = "correct-horse-battery-staple"


@pytest.fixture
def category() -> Category:
    return Category.objects.create(spanish_name="Entrantes", is_published=True)


@pytest.fixture
def published_dish(category: Category) -> Dish:
    return Dish.objects.create(
        category=category,
        visible_number=10,
        spanish_name="Tortilla española",
        spanish_description="Con patatas y huevo.",
        price=Decimal("8.50"),
        allergens=["eggs"],
        is_published=True,
    )


@pytest.fixture
def employee() -> User:
    return User.objects.create_user(
        username="employee", password=PASSWORD, role=UserRole.EMPLOYEE
    )


def authenticated_client(user: User) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def client_with_bearer_token(token: str) -> APIClient:
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return client


def expired_access_token(user: User) -> str:
    token = AccessToken.for_user(user)
    token.set_exp(lifetime=timedelta(minutes=-1))
    return str(token)


def test_dish_constraints_require_a_positive_unique_number_and_non_negative_price(
    category: Category, published_dish: Dish
) -> None:
    with pytest.raises(IntegrityError), transaction.atomic():
        Dish.objects.create(category=category, visible_number=10, spanish_name="Duplicado", price="1.00")
    with pytest.raises(IntegrityError), transaction.atomic():
        Dish.objects.create(category=category, visible_number=0, spanish_name="Número inválido", price="1.00")
    with pytest.raises(IntegrityError), transaction.atomic():
        Dish.objects.create(category=category, visible_number=11, spanish_name="Precio inválido", price="-0.01")


def test_postgresql_constraints_reject_blank_spanish_source_names(category: Category) -> None:
    with pytest.raises(IntegrityError), transaction.atomic():
        Category.objects.create(spanish_name="   ")
    with pytest.raises(IntegrityError), transaction.atomic():
        Dish.objects.create(category=category, visible_number=11, spanish_name="\t", price="1.00")


def test_dish_serializer_rejects_unsupported_and_duplicate_allergens() -> None:
    manager = User.objects.create_user(username="manager", password=PASSWORD, role=UserRole.MANAGER)

    response = authenticated_client(manager).post(
        DISHES_URL,
        {"category": 1, "visible_number": 99, "spanish_name": "Plato", "price": "10.00", "allergens": ["eggs", "eggs", "unknown"]},
        format="json",
    )

    assert response.status_code == 400
    assert "allergens" in response.data


@pytest.mark.parametrize(
    ("visible_number", "price", "invalid_field"),
    ((0, "10.00", "visible_number"), (12, "-0.01", "price")),
)
def test_dish_serializer_rejects_invalid_business_values(
    category: Category, visible_number: int, price: str, invalid_field: str
) -> None:
    manager = User.objects.create_user(username="manager", password=PASSWORD, role=UserRole.MANAGER)

    response = authenticated_client(manager).post(
        DISHES_URL,
        {"category": category.pk, "visible_number": visible_number, "spanish_name": "Plato", "price": price},
        format="json",
    )

    assert response.status_code == 400
    assert invalid_field in response.data


def test_translation_language_and_per_dish_uniqueness_are_enforced(published_dish: Dish) -> None:
    DishTranslation.objects.create(dish=published_dish, language="en", name="Spanish omelette", is_manually_reviewed=True)
    with pytest.raises(IntegrityError), transaction.atomic():
        DishTranslation.objects.create(dish=published_dish, language="en", name="Another English name")


def test_postgresql_constraints_reject_unsupported_translation_languages(
    category: Category, published_dish: Dish
) -> None:
    with pytest.raises(IntegrityError), transaction.atomic():
        CategoryTranslation.objects.create(category=category, language="es", name="Entrantes")
    with pytest.raises(IntegrityError), transaction.atomic():
        DishTranslation.objects.create(dish=published_dish, language="pt", name="Tortilla")


def test_public_menu_excludes_unpublished_categories_and_dishes(category: Category) -> None:
    published = Dish.objects.create(category=category, visible_number=1, spanish_name="Publicado", price="5.00", is_published=True)
    Dish.objects.create(category=category, visible_number=2, spanish_name="Borrador", price="6.00")
    hidden_category = Category.objects.create(spanish_name="Oculta")
    Dish.objects.create(category=hidden_category, visible_number=3, spanish_name="No público", price="7.00", is_published=True)

    response = APIClient().get(PUBLIC_MENU_URL)

    assert response.status_code == 200
    assert response.data["language"] == "es"
    assert response.data["categories"] == [{"id": category.pk, "name": "Entrantes", "spanish_name": "Entrantes", "translation_available": False, "dishes": [{"id": published.pk, "visible_number": 1, "name": "Publicado", "spanish_name": "Publicado", "description": "", "spanish_description": "", "translation_available": False, "price": "5.00", "allergens": [], "is_available": True}]}]


def test_public_menu_uses_persisted_translation_and_keeps_spanish_source(category: Category, published_dish: Dish) -> None:
    CategoryTranslation.objects.create(category=category, language="en", name="Starters", is_manually_reviewed=True)
    translation = DishTranslation.objects.create(dish=published_dish, language="en", name="Spanish omelette", description="With potatoes and egg.", is_manually_reviewed=True)

    response = APIClient().get(PUBLIC_MENU_URL, {"language": "en"})

    assert response.status_code == 200
    dish = response.data["categories"][0]["dishes"][0]
    assert response.data["categories"][0]["name"] == "Starters"
    assert dish["name"] == translation.name
    assert dish["spanish_name"] == published_dish.spanish_name
    assert dish["description"] == translation.description
    assert dish["spanish_description"] == published_dish.spanish_description
    assert dish["translation_available"] is True


def test_public_menu_falls_back_to_spanish_when_translation_is_absent(published_dish: Dish) -> None:
    response = APIClient().get(PUBLIC_MENU_URL, {"language": "fr"})

    assert response.status_code == 200
    dish = response.data["categories"][0]["dishes"][0]
    assert dish["name"] == published_dish.spanish_name
    assert dish["spanish_name"] == published_dish.spanish_name
    assert dish["translation_available"] is False


def test_public_menu_rejects_unsupported_languages() -> None:
    response = APIClient().get(PUBLIC_MENU_URL, {"language": "pt"})

    assert response.status_code == 400
    assert "language" in response.data


def test_public_menu_returns_200_for_anonymous_requests() -> None:
    response = APIClient().get(PUBLIC_MENU_URL)

    assert response.status_code == 200


def test_public_menu_returns_200_for_a_valid_access_token(employee: User) -> None:
    response = client_with_bearer_token(str(AccessToken.for_user(employee))).get(
        PUBLIC_MENU_URL
    )

    assert response.status_code == 200


def test_public_menu_ignores_an_expired_access_token(employee: User) -> None:
    response = client_with_bearer_token(expired_access_token(employee)).get(
        PUBLIC_MENU_URL
    )

    assert response.status_code == 200


def test_public_menu_ignores_a_malformed_bearer_token() -> None:
    response = client_with_bearer_token("not-a-jwt").get(PUBLIC_MENU_URL)

    assert response.status_code == 200


def test_protected_menu_management_still_rejects_an_expired_access_token(
    employee: User,
) -> None:
    response = client_with_bearer_token(expired_access_token(employee)).get(
        CATEGORIES_URL
    )

    assert response.status_code == 401
    assert response.data["code"] == "token_not_valid"


@pytest.mark.parametrize("role", (UserRole.MANAGER, UserRole.ADMINISTRATOR))
def test_manager_and_administrator_can_create_categories(role: str) -> None:
    user = User.objects.create_user(username=role, password=PASSWORD, role=role)

    response = authenticated_client(user).post(CATEGORIES_URL, {"spanish_name": "Postres", "is_published": False}, format="json")

    assert response.status_code == 201
    assert response.data["spanish_name"] == "Postres"


def test_employee_cannot_access_menu_management(employee: User) -> None:
    assert authenticated_client(employee).get(CATEGORIES_URL).status_code == 403


def test_anonymous_user_cannot_access_menu_management() -> None:
    assert APIClient().get(DISH_TRANSLATIONS_URL).status_code == 401


def test_dish_visible_number_cannot_be_changed_after_creation(
    published_dish: Dish,
) -> None:
    manager = User.objects.create_user(
        username="manager", password=PASSWORD, role=UserRole.MANAGER
    )

    response = authenticated_client(manager).patch(
        f"{DISHES_URL}{published_dish.pk}/",
        {"visible_number": 11},
        format="json",
    )

    assert response.status_code == 400
    assert response.data == {
        "visible_number": ["This field cannot be changed after creation."]
    }
    published_dish.refresh_from_db()
    assert published_dish.visible_number == 10
