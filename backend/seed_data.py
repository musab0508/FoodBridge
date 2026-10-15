import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'foodbridge.settings')
django.setup()

from django.contrib.auth import get_user_model
from users.models import UserProfile, UserRole
from donations.models import Donation, DistributionAudit, FoodType, DonationStatus, RiskLevel
from donations.ai_engine import SmartSafetyUrgencyEngine

User = get_user_model()

def seed():
    print("[INFO] Seeding production-ready database with AI scores and approval gates...")

    # 1. Admin User
    admin, created = User.objects.get_or_create(
        username='admin',
        defaults={
            'email': 'admin@foodbridge.org',
            'first_name': 'System',
            'last_name': 'Admin',
            'role': UserRole.ADMIN,
            'is_staff': True,
            'is_superuser': True
        }
    )
    if created:
        admin.set_password('admin123')
        admin.save()
        UserProfile.objects.get_or_create(
            user=admin,
            defaults={'role': UserRole.ADMIN, 'phone_number': '9876543210', 'is_approved': True}
        )
        print("  [SUCCESS] Admin created: admin / admin123")

    # 2. Donor User
    donor, created = User.objects.get_or_create(
        username='restaurant_donor',
        defaults={
            'email': 'contact@greenbistro.com',
            'first_name': 'Green Bistro',
            'last_name': 'Kitchen',
            'role': UserRole.DONOR,
        }
    )
    if created:
        donor.set_password('donor123')
        donor.save()
        UserProfile.objects.get_or_create(
            user=donor,
            defaults={
                'role': UserRole.DONOR,
                'phone_number': '9876543211',
                'address': '742 Evergreen Terrace, Downtown Food District',
                'latitude': 37.7749,
                'longitude': -122.4194,
                'organization_name': 'Green Bistro Restaurant',
                'is_approved': True
            }
        )
        print("  [SUCCESS] Approved Donor created: restaurant_donor / donor123")

    # 3. Approved NGO User
    ngo, created = User.objects.get_or_create(
        username='hope_shelter_ngo',
        defaults={
            'email': 'help@hopeshelter.org',
            'first_name': 'Hope Shelter',
            'last_name': 'Coordinator',
            'role': UserRole.NGO,
        }
    )
    if created:
        ngo.set_password('ngo123')
        ngo.save()
        UserProfile.objects.get_or_create(
            user=ngo,
            defaults={
                'role': UserRole.NGO,
                'phone_number': '9876543212',
                'address': '120 Hope Community Center Way, Westside',
                'latitude': 37.7833,
                'longitude': -122.4167,
                'organization_name': 'Hope Relief Foundation',
                'registration_number': 'NGO-8942-IN',
                'operating_area': 'Metro Area Shelters',
                'is_approved': True
            }
        )
        print("  [SUCCESS] Approved NGO created: hope_shelter_ngo / ngo123")
    else:
        # Ensure existing seed NGO is approved
        ngo.profile.is_approved = True
        ngo.profile.save()

    # 4. Pending Unapproved NGO User for Approval Hub Testing
    pending_ngo, p_created = User.objects.get_or_create(
        username='community_kitchen_ngo',
        defaults={
            'email': 'info@communitykitchen.org',
            'first_name': 'Community Kitchen',
            'last_name': 'Manager',
            'role': UserRole.NGO,
        }
    )
    if p_created:
        pending_ngo.set_password('ngo123')
        pending_ngo.save()
        UserProfile.objects.get_or_create(
            user=pending_ngo,
            defaults={
                'role': UserRole.NGO,
                'phone_number': '9876543213',
                'organization_name': 'Metro Community Food Kitchen',
                'registration_number': 'NGO-9981-IN',
                'is_approved': False
            }
        )
        print("  [SUCCESS] Pending Unapproved NGO created: community_kitchen_ngo / ngo123")

    # 5. Sample Donations with AI Scores
    if Donation.objects.count() == 0:
        res1 = SmartSafetyUrgencyEngine.calculate_urgency_score('COOKED', 2)
        d1 = Donation.objects.create(
            donor=donor,
            food_title="50 Trays Fresh Baked Artisan Bread & Sandwiches",
            food_type=FoodType.COOKED,
            quantity_amount=50,
            quantity_unit="meals",
            quantity="50 meals",
            pickup_location="742 Evergreen Terrace, Downtown",
            latitude=37.7749,
            longitude=-122.4194,
            expiry_hours=2,
            ai_urgency_score=res1['urgency_score'],
            ai_risk_level=res1['risk_level'],
            status=DonationStatus.AVAILABLE
        )
        DistributionAudit.objects.create(
            donation=d1,
            previous_status="CREATED",
            new_status=DonationStatus.AVAILABLE,
            updated_by=donor,
            notes=f"Initial surplus post created. AI Urgency Score: {res1['urgency_score']}% ({res1['risk_level']})"
        )

        res2 = SmartSafetyUrgencyEngine.calculate_urgency_score('COOKED', 8)
        d2 = Donation.objects.create(
            donor=donor,
            food_title="20 kg Organic Rice & Prepared Vegetarian Stew",
            food_type=FoodType.COOKED,
            quantity_amount=20,
            quantity_unit="kg",
            quantity="20 kg",
            pickup_location="742 Evergreen Terrace, Downtown",
            latitude=37.7749,
            longitude=-122.4194,
            expiry_hours=8,
            ai_urgency_score=res2['urgency_score'],
            ai_risk_level=res2['risk_level'],
            status=DonationStatus.CLAIMED,
            claimed_by=ngo
        )
        DistributionAudit.objects.create(
            donation=d2,
            previous_status=DonationStatus.AVAILABLE,
            new_status=DonationStatus.CLAIMED,
            updated_by=ngo,
            notes="Claimed by Hope Relief Foundation."
        )

        res3 = SmartSafetyUrgencyEngine.calculate_urgency_score('NON_PERISHABLE', 72)
        d3 = Donation.objects.create(
            donor=donor,
            food_title="100 Canned Beans & Soup Cartons",
            food_type=FoodType.NON_PERISHABLE,
            quantity_amount=100,
            quantity_unit="packets",
            quantity="100 packets",
            pickup_location="742 Evergreen Terrace, Downtown",
            latitude=37.7749,
            longitude=-122.4194,
            expiry_hours=72,
            ai_urgency_score=res3['urgency_score'],
            ai_risk_level=res3['risk_level'],
            status=DonationStatus.DELIVERED,
            claimed_by=ngo
        )
        DistributionAudit.objects.create(
            donation=d3,
            previous_status=DonationStatus.IN_TRANSIT,
            new_status=DonationStatus.DELIVERED,
            updated_by=ngo,
            notes="Distributed to local shelter families."
        )

        print("  [SUCCESS] 3 initial AI-scored sample donations created.")

    print("[SUCCESS] Seeding completed successfully.")

if __name__ == '__main__':
    seed()
