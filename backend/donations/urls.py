from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import DonationViewSet, AdminMetricsView, ImageInspectView, OptimizeRouteView

router = DefaultRouter()
router.register(r'donations', DonationViewSet, basename='donation')

urlpatterns = [
    path('', include(router.urls)),
    path('donations/inspect-image/', ImageInspectView.as_view(), name='donations_inspect_image'),
    path('donations/optimize-route/', OptimizeRouteView.as_view(), name='donations_optimize_route'),
    path('admin/metrics/', AdminMetricsView.as_view(), name='admin_metrics'),
]
