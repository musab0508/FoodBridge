from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import get_user_model
from .serializers import RegisterSerializer, UserSerializer
from .models import UserRole, UserProfile

User = get_user_model()

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        user = self.user

        # NGO Approval Gate check
        if user.role == UserRole.NGO and hasattr(user, 'profile'):
            if not user.profile.is_approved:
                raise permissions.exceptions.PermissionDenied(
                    "Your NGO registration is under review by the Administrator. Access will be enabled upon approval."
                )

        return data

class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer

class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = [permissions.AllowAny]
    serializer_class = RegisterSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        # If NGO, return pending notification instead of active tokens
        if user.role == UserRole.NGO and hasattr(user, 'profile') and not user.profile.is_approved:
            return Response({
                'user': UserSerializer(user).data,
                'message': 'Your NGO registration has been submitted successfully! Access is pending Administrator review.'
            }, status=status.HTTP_201_CREATED)

        refresh = RefreshToken.for_user(user)
        return Response({
            'user': UserSerializer(user).data,
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'message': 'Registration successful'
        }, status=status.HTTP_201_CREATED)

class UserMeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)

class UserListView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = UserSerializer

    def get_queryset(self):
        if self.request.user.role == UserRole.ADMIN or self.request.user.is_superuser:
            role_param = self.request.query_params.get('role', None)
            if role_param:
                return User.objects.filter(role=role_param)
            return User.objects.all()
        return User.objects.filter(id=self.request.user.id)

class PendingNgoListView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = UserSerializer

    def get_queryset(self):
        if self.request.user.role == UserRole.ADMIN or self.request.user.is_superuser:
            return User.objects.filter(role=UserRole.NGO, profile__is_approved=False)
        return User.objects.none()

class ApproveNgoView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        if not (request.user.role == UserRole.ADMIN or request.user.is_superuser):
            return Response({'error': 'Admin permissions required'}, status=status.HTTP_403_FORBIDDEN)
        
        try:
            ngo_user = User.objects.get(pk=pk, role=UserRole.NGO)
            ngo_user.profile.is_approved = True
            ngo_user.profile.save()
            ngo_user.is_active = True
            ngo_user.save()
            return Response({
                'message': f'NGO "{ngo_user.profile.organization_name or ngo_user.username}" approved successfully!',
                'user': UserSerializer(ngo_user).data
            })
        except User.DoesNotExist:
            return Response({'error': 'NGO user not found'}, status=status.HTTP_404_NOT_FOUND)

class RejectNgoView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        if not (request.user.role == UserRole.ADMIN or request.user.is_superuser):
            return Response({'error': 'Admin permissions required'}, status=status.HTTP_403_FORBIDDEN)
        
        try:
            ngo_user = User.objects.get(pk=pk, role=UserRole.NGO)
            org_name = ngo_user.profile.organization_name or ngo_user.username
            ngo_user.delete()
            return Response({'message': f'NGO registration for "{org_name}" rejected and removed.'})
        except User.DoesNotExist:
            return Response({'error': 'NGO user not found'}, status=status.HTTP_404_NOT_FOUND)

class ToggleUserActiveView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        if not (request.user.role == UserRole.ADMIN or request.user.is_superuser):
            return Response({'error': 'Admin permissions required'}, status=status.HTTP_403_FORBIDDEN)
        
        try:
            target_user = User.objects.get(pk=pk)
            target_user.is_active = not target_user.is_active
            target_user.save()
            return Response({
                'id': target_user.id,
                'username': target_user.username,
                'is_active': target_user.is_active,
                'message': f"User account {'activated' if target_user.is_active else 'deactivated'} successfully."
            })
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
