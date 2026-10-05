import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding FoodBridge PostGIS Database with Real Mumbai Locations...');

  // 1. Create Taj Mahal Palace Hotel (Donor)
  const donorUser = await prisma.user.upsert({
    where: { email: 'catering@tajhotels.com' },
    update: {},
    create: {
      name: 'The Taj Mahal Palace Hotel & Banquets',
      email: 'catering@tajhotels.com',
      role: 'DONOR',
      phone: '+91-22-6665-3366',
      donorProfile: {
        create: {
          orgType: 'Luxury Hotel & Event Center',
          reputationScore: 4.9,
          address: 'Apollo Bunder, Colaba, South Mumbai, 400001',
          latitude: 18.9220,
          longitude: 72.8332
        }
      }
    }
  });

  // 2. Create Mumbai Roti Bank (NGO)
  const ngoUser = await prisma.user.upsert({
    where: { email: 'dispatch@rotibankmumbai.org' },
    update: {},
    create: {
      name: 'Mumbai Roti Bank (Rupee Together Foundation)',
      email: 'dispatch@rotibankmumbai.org',
      role: 'NGO',
      phone: '+91-86555-80000',
      ngoProfile: {
        create: {
          capacityServings: 400,
          currentRemaining: 280,
          dietaryConstraints: ['VEGETARIAN', 'HALAL'],
          intakeStartHour: '06:00',
          intakeEndHour: '23:30',
          address: 'Mathuradas Mill Compound, Lower Parel, Mumbai, 400013',
          latitude: 19.0020,
          longitude: 72.8300
        }
      }
    }
  });

  // 3. Create EV Delivery Rider (Volunteer)
  const volUser = await prisma.user.upsert({
    where: { email: 'aarav.rider@foodbridge.org' },
    update: {},
    create: {
      name: 'Aarav Sharma',
      email: 'aarav.rider@foodbridge.org',
      role: 'VOLUNTEER',
      phone: '+91-98200-11223',
      volunteerProfile: {
        create: {
          vehicleType: 'MOTORCYCLE',
          isAvailable: true,
          currentLat: 19.0620,
          currentLng: 72.8600,
          activePayload: 15.0,
          maxCapacityKg: 50.0
        }
      }
    }
  });

  // 4. Create Initial Donation
  const donation = await prisma.donation.create({
    data: {
      donorId: donorUser.id,
      title: '80 Servings Luxury Buffet Lunch (Dal Makhani, Paneer Tikka & Basmati Rice)',
      description: 'Surplus wedding banquet buffet dishes stored in insulated hot containers (>65°C)',
      category: 'COOKED_MEALS',
      servingsCount: 80,
      weightKg: 36.0,
      prepTime: new Date(Date.now() - 1.5 * 3600 * 1000),
      expirationEta: new Date(Date.now() + 1.2 * 3600 * 1000),
      storageRequirement: 'HOT_CONTAINER',
      status: 'POSTED',
      urgencyScore: 89.2,
      qualityIndex: 97.5,
      spoilageRiskFlag: false,
      latitude: 18.9220,
      longitude: 72.8332,
      address: 'Apollo Bunder, Colaba, South Mumbai, 400001'
    }
  });

  console.log('✅ Mumbai PostGIS Database Seeding Complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
