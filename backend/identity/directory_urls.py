"""Identity routes outside the browser authentication namespace."""

from django.urls import path

from .views import InternalUserDirectoryView

app_name = "identity_directory"

urlpatterns = [
    path("users/", InternalUserDirectoryView.as_view(), name="internal-user-directory"),
]
