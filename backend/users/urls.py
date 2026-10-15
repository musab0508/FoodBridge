from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    RegisterView, UserMeView, UserListView, ToggleUserActiveView,
    CustomTokenObtainPairView, PendingNgoListView, ApproveNgoView, RejectNgoView
)

urlpatterns = [
    path('auth/register/', RegisterView.as_view(), name='auth_register'),
    path('auth/login/', CustomTokenObtainPairView.as_view(), name='auth_login'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='auth_refresh'),
    path('auth/me/', UserMeView.as_view(), name='auth_me'),
    path('users/', UserListView.as_view(), name='user_list'),
    path('users/<int:pk>/toggle-active/', ToggleUserActiveView.as_view(), name='user_toggle_active'),
    path('admin/pending-ngos/', PendingNgoListView.as_view(), name='admin_pending_ngos'),
    path('admin/ngos/<int:pk>/approve/', ApproveNgoView.as_view(), name='admin_approve_ngo'),
    path('admin/ngos/<int:pk>/reject/', RejectNgoView.as_view(), name='admin_reject_ngo'),
]
