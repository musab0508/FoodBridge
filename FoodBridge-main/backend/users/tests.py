from django.test import TestCase
from django.urls import reverse
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase
from rest_framework import status
from users.models import UserRole, UserProfile

User = get_user_model()


class UserRegistrationTests(APITestCase):
    def setUp(self):
        self.register_url = reverse('auth_register')
        self.login_url = reverse('auth_login')

    def test_donor_registration_success(self):
        """Test Donor registration returns 201 with JWT access & refresh tokens."""
        payload = {
            'username': 'tasty_donor',
            'email': 'donor@restaurant.com',
            'password': 'password123',
            'role': UserRole.DONOR,
            'organization_name': 'Tasty Treats Kitchen',
            'phone_number': '9876543210',
            'address': 'Bandra West, Mumbai'
        }
        response = self.client.post(self.register_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)
        self.assertEqual(response.data['user']['username'], 'tasty_donor')
        self.assertEqual(response.data['user']['role'], UserRole.DONOR)
        
        user = User.objects.get(username='tasty_donor')
        self.assertTrue(user.profile.is_approved)
        self.assertEqual(user.profile.phone_number, '9876543210')

    def test_phone_number_normalization(self):
        """Test that +91 and leading 0 formats are normalized to 10-digit clean string."""
        payload = {
            'username': 'spice_donor',
            'email': 'spice@donor.com',
            'password': 'password123',
            'role': UserRole.DONOR,
            'organization_name': 'Spice Garden',
            'phone_number': '+91 91234 56789',
            'address': 'Andheri, Mumbai'
        }
        response = self.client.post(self.register_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        user = User.objects.get(username='spice_donor')
        self.assertEqual(user.profile.phone_number, '9123456789')

    def test_ngo_registration_requires_admin_approval(self):
        """Test NGO registration returns 201 with pending review message and no active JWT tokens."""
        payload = {
            'username': 'hope_ngo',
            'email': 'contact@hopefoundation.org',
            'password': 'password123',
            'role': UserRole.NGO,
            'organization_name': 'Hope Relief Foundation',
            'registration_number': 'NGO-MUM-2024-001',
            'phone_number': '9811122233',
            'address': 'Dadar, Mumbai'
        }
        response = self.client.post(self.register_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertNotIn('access', response.data)
        self.assertIn('pending Administrator review', response.data['message'])

        user = User.objects.get(username='hope_ngo')
        self.assertFalse(user.profile.is_approved)

        # Unapproved NGO attempting login should receive 403 PermissionDenied
        login_response = self.client.post(self.login_url, {
            'username': 'hope_ngo',
            'password': 'password123'
        }, format='json')
        self.assertEqual(login_response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn('under review', str(login_response.data))

    def test_registration_duplicate_username_fails(self):
        """Test registering with an existing username returns 400 Bad Request."""
        User.objects.create_user(username='existinguser', password='password123')
        payload = {
            'username': 'existinguser',
            'email': 'new@mail.com',
            'password': 'password123',
            'role': UserRole.DONOR,
            'organization_name': 'Another Cafe',
            'phone_number': '9876543210'
        }
        response = self.client.post(self.register_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('username', response.data)

    def test_registration_short_password_fails(self):
        """Test password shorter than 6 characters returns 400."""
        payload = {
            'username': 'shortpassuser',
            'email': 'test@short.com',
            'password': '123',
            'role': UserRole.DONOR,
            'organization_name': 'Short Pass Bistro',
            'phone_number': '9876543210'
        }
        response = self.client.post(self.register_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('password', response.data)

    def test_registration_invalid_phone_fails(self):
        """Test invalid phone number format returns 400."""
        payload = {
            'username': 'badphoneuser',
            'email': 'test@badphone.com',
            'password': 'password123',
            'role': UserRole.DONOR,
            'organization_name': 'Bad Phone Cafe',
            'phone_number': '12345'
        }
        response = self.client.post(self.register_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('phone_number', response.data)
