"""Employee domain URL routes."""

from rest_framework.routers import DefaultRouter

from .views import EmployeeViewSet, ShiftViewSet

app_name = "employees"

router = DefaultRouter()
router.register("employees", EmployeeViewSet, basename="employee")
router.register("shifts", ShiftViewSet, basename="shift")

urlpatterns = router.urls
