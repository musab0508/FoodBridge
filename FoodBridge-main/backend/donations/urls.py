from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    DonationViewSet,
    AdminMetricsView,
    ImageInspectView,
    OptimizeRouteView,
    GenerateHandoffTokenView,
    VerifyHandoffTokenView,
    HandoffReceiptView,
    TelemetryStreamView,
    NotificationListView
)

router = DefaultRouter()
router.register(r'donations', DonationViewSet, basename='donation')

urlpatterns = [
    path('donations/inspect-image/', ImageInspectView.as_view(), name='donations_inspect_image'),
    path('routes/optimize/', OptimizeRouteView.as_view(), name='routes_optimize'),
    path('donations/optimize-route/', OptimizeRouteView.as_view(), name='donations_optimize_route'),
    path('donations/telemetry/stream/', TelemetryStreamView.as_view(), name='donations_telemetry_stream'),
    path('donations/<int:pk>/generate-handoff-token/', GenerateHandoffTokenView.as_view(), name='generate_handoff_token'),
    path('donations/<int:pk>/verify-handoff/', VerifyHandoffTokenView.as_view(), name='verify_handoff'),
    path('donations/<int:pk>/handoff-receipt/', HandoffReceiptView.as_view(), name='handoff_receipt'),
    path('notifications/', NotificationListView.as_view(), name='notifications_list'),
    path('admin/metrics/', AdminMetricsView.as_view(), name='admin_metrics'),
    path('', include(router.urls)),
]

