"""Root URL configuration."""

from django.urls import include, path

urlpatterns = [path("api/auth/", include("identity.urls"))]
