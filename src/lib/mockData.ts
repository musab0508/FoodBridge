import { Donation, DonorProfile, NgoProfile, VolunteerProfile, DailyForecast, TelemetryReading } from './types';

export const INITIAL_DONORS: DonorProfile[] = [
  {
    id: 'donor_mumbai_1',
    name: 'The Taj Mahal Palace Hotel & Banquets',
    orgType: 'Luxury Hotel & Event Center',
    reputationScore: 4.9,
    latitude: 18.9220,
    longitude: 72.8332, // Apollo Bunder, Colaba, South Mumbai
    address: 'Apollo Bunder, Colaba, South Mumbai, 400001'
  },
  {
    id: 'donor_mumbai_2',
    name: 'Jio World Convention Centre Catering',
    orgType: 'Convention & Banquet Hub',
    reputationScore: 4.8,
    latitude: 19.0657,
    longitude: 72.8687, // BKC, Bandra East, Mumbai
    address: 'G Block, Bandra Kurla Complex (BKC), Mumbai, 400051'
  },
  {
    id: 'donor_mumbai_3',
    name: 'JW Marriott Mumbai Juhu',
    orgType: 'Hotel Buffet & Bakery',
    reputationScore: 4.9,
    latitude: 19.1013,
    longitude: 72.8258, // Juhu Tara Road, Mumbai
    address: 'Juhu Tara Rd, Juhu, Mumbai, 400049'
  },
  {
    id: 'donor_mumbai_4',
    name: 'Bastian At The Top',
    orgType: 'Fine Dining Restaurant',
    reputationScore: 4.7,
    latitude: 19.0178,
    longitude: 72.8478, // Dadar West / Kohinoor Square
    address: 'Kohinoor Square, Dadar West, Mumbai, 400028'
  },
  {
    id: 'donor_mumbai_5',
    name: 'Theobroma Patisserie',
    orgType: 'Bakery & Confectionery',
    reputationScore: 4.8,
    latitude: 18.9237,
    longitude: 72.8315, // Colaba Causeway, Mumbai
    address: 'Cusrow Baug, Colaba Causeway, Mumbai, 400005'
  }
];

export const INITIAL_NGOS: NgoProfile[] = [
  {
    id: 'ngo_mumbai_1',
    name: 'Mumbai Roti Bank (Rupee Together Foundation)',
    capacityServings: 400,
    currentRemaining: 280,
    dietaryConstraints: ['VEGETARIAN', 'HALAL'],
    intakeHours: '06:00 - 23:30',
    latitude: 19.0020,
    longitude: 72.8300, // Lower Parel / Worli Hub
    address: 'Mathuradas Mill Compound, Lower Parel, Mumbai, 400013'
  },
  {
    id: 'ngo_mumbai_2',
    name: 'Robin Hood Army Mumbai Chapter (BKC Hub)',
    capacityServings: 350,
    currentRemaining: 210,
    dietaryConstraints: ['VEGETARIAN'],
    intakeHours: '07:00 - 23:00',
    latitude: 19.0600,
    longitude: 72.8500, // Bandra East / BKC Border
    address: 'Kalanagar, Bandra East, Mumbai, 400051'
  },
  {
    id: 'ngo_mumbai_3',
    name: 'Akshaya Patra Community Kitchen',
    capacityServings: 600,
    currentRemaining: 450,
    dietaryConstraints: [],
    intakeHours: '24/7 Intake',
    latitude: 19.1136,
    longitude: 72.8697, // Andheri East MIDC
    address: 'MIDC Central Rd, Andheri East, Mumbai, 400093'
  },
  {
    id: 'ngo_mumbai_4',
    name: 'No Food Waste Dharavi Community Center',
    capacityServings: 300,
    currentRemaining: 190,
    dietaryConstraints: ['NUT_FREE'],
    intakeHours: '08:00 - 22:00',
    latitude: 19.0400,
    longitude: 72.8550, // Dharavi / Sion West
    address: '90 Feet Road, Dharavi, Mumbai, 400017'
  }
];

export const INITIAL_VOLUNTEERS: VolunteerProfile[] = [
  {
    id: 'vol_mumbai_1',
    name: 'Aarav Sharma (EV Cargo Bike)',
    vehicleType: 'MOTORCYCLE',
    isAvailable: true,
    latitude: 19.0620,
    longitude: 72.8600, // BKC Area
    activePayloadKg: 15.0,
    maxCapacityKg: 50.0
  },
  {
    id: 'vol_mumbai_2',
    name: 'Priya Desai (Refrigerated Logistics Van)',
    vehicleType: 'REFRIGERATED_TRUCK',
    isAvailable: true,
    latitude: 19.0180,
    longitude: 72.8430, // Dadar Circle
    activePayloadKg: 0.0,
    maxCapacityKg: 350.0
  }
];

const getFutureTime = (hoursFromNow: number) => {
  const d = new Date();
  d.setMinutes(d.getMinutes() + hoursFromNow * 60);
  return d.toISOString();
};

export const INITIAL_DONATIONS: Donation[] = [
  {
    id: 'don_mumbai_101',
    donorId: 'donor_mumbai_1',
    donorName: 'The Taj Mahal Palace Hotel & Banquets',
    title: '80 Servings Luxury Buffet Lunch (Dal Makhani, Paneer Tikka & Basmati Rice)',
    description: 'Surplus wedding banquet buffet dishes stored in insulated hot containers (>65°C). Prepared 1.5 hrs ago.',
    category: 'COOKED_MEALS',
    servingsCount: 80,
    weightKg: 36.0,
    prepTime: new Date(Date.now() - 1.5 * 3600 * 1000).toISOString(),
    expirationEta: getFutureTime(1.2), // URGENT: <1.5 hrs remaining!
    storageRequirement: 'HOT_CONTAINER',
    status: 'POSTED',
    urgencyScore: 89.2,
    qualityIndex: 97.5,
    spoilageRiskFlag: false,
    latitude: 18.9220,
    longitude: 72.8332,
    address: 'Apollo Bunder, Colaba, South Mumbai, 400001',
    createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString()
  },
  {
    id: 'don_mumbai_102',
    donorId: 'donor_mumbai_2',
    donorName: 'Jio World Convention Centre Catering',
    title: '150 Boxed Executive Corporate Lunch Sets',
    description: 'Hygienically vacuum-sealed individual lunch boxes with rotis, sabzi, rice, and sweet dishes.',
    category: 'COOKED_MEALS',
    servingsCount: 150,
    weightKg: 55.0,
    prepTime: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    expirationEta: getFutureTime(4.5),
    storageRequirement: 'AMBIENT',
    status: 'AI_MATCHED',
    aiMatchedNgoId: 'ngo_mumbai_2',
    urgencyScore: 42.0,
    qualityIndex: 98.0,
    spoilageRiskFlag: false,
    latitude: 19.0657,
    longitude: 72.8687,
    address: 'G Block, Bandra Kurla Complex (BKC), Mumbai, 400051',
    createdAt: new Date(Date.now() - 45 * 60 * 1000).toISOString()
  },
  {
    id: 'don_mumbai_103',
    donorId: 'donor_mumbai_5',
    donorName: 'Theobroma Patisserie',
    title: '60 Assorted Fresh Brownies & Sourdough Loaves',
    description: 'Freshly baked chocolate brownies, croissants, and artisanal bread loaves wrapped in food-grade packaging.',
    category: 'BAKERY_PASTRY',
    servingsCount: 60,
    weightKg: 14.5,
    prepTime: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
    expirationEta: getFutureTime(10.0),
    storageRequirement: 'AMBIENT',
    status: 'ACCEPTED',
    aiMatchedNgoId: 'ngo_mumbai_1',
    urgencyScore: 28.5,
    qualityIndex: 99.0,
    spoilageRiskFlag: false,
    latitude: 18.9237,
    longitude: 72.8315,
    address: 'Cusrow Baug, Colaba Causeway, Mumbai, 400005',
    createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString()
  }
];

export const INITIAL_TELEMETRY: TelemetryReading[] = [
  { donationId: 'don_mumbai_101', sensorId: 'MUM-COLD-SENS-01', timestamp: '15:00', temperatureC: 4.1, humidityPct: 65.0, thermalBreach: false },
  { donationId: 'don_mumbai_101', sensorId: 'MUM-COLD-SENS-01', timestamp: '15:05', temperatureC: 4.4, humidityPct: 66.2, thermalBreach: false },
  { donationId: 'don_mumbai_101', sensorId: 'MUM-COLD-SENS-01', timestamp: '15:10', temperatureC: 5.2, humidityPct: 67.0, thermalBreach: false },
  { donationId: 'don_mumbai_101', sensorId: 'MUM-COLD-SENS-01', timestamp: '15:15', temperatureC: 6.9, humidityPct: 68.5, thermalBreach: false },
  { donationId: 'don_mumbai_101', sensorId: 'MUM-COLD-SENS-01', timestamp: '15:20', temperatureC: 5.3, humidityPct: 66.0, thermalBreach: false },
  { donationId: 'don_mumbai_101', sensorId: 'MUM-COLD-SENS-01', timestamp: '15:25', temperatureC: 4.7, humidityPct: 65.4, thermalBreach: false }
];

export const MOCK_FORECASTS: DailyForecast[] = [
  {
    date: '2026-10-06',
    dayOfWeek: 'Tuesday',
    isWeekend: false,
    districtForecasts: [
      { districtId: 'BKC_COMMERCIAL', districtName: 'Bandra Kurla Complex (BKC)', predictedSurplusKg: 480, predictedMeals: 1056, surgeProbabilityPct: 92.5, hotspotLevel: 'CRITICAL_HOTSPOT', proactiveNgoAlert: true },
      { districtId: 'SOUTH_MUMBAI_HOTELS', districtName: 'South Mumbai (Colaba & Marine Drive)', predictedSurplusKg: 390, predictedMeals: 858, surgeProbabilityPct: 84.0, hotspotLevel: 'CRITICAL_HOTSPOT', proactiveNgoAlert: true },
      { districtId: 'LOWER_PAREL_MILLS', districtName: 'Lower Parel & Phoenix Mills', predictedSurplusKg: 310, predictedMeals: 682, surgeProbabilityPct: 68.0, hotspotLevel: 'MODERATE_SURGE', proactiveNgoAlert: false },
      { districtId: 'ANDHERI_MIDC', districtName: 'Andheri East & SEEPZ MIDC', predictedSurplusKg: 280, predictedMeals: 616, surgeProbabilityPct: 55.0, hotspotLevel: 'MODERATE_SURGE', proactiveNgoAlert: false },
    ]
  },
  {
    date: '2026-10-07',
    dayOfWeek: 'Wednesday',
    isWeekend: false,
    districtForecasts: [
      { districtId: 'BKC_COMMERCIAL', districtName: 'Bandra Kurla Complex (BKC)', predictedSurplusKg: 420, predictedMeals: 924, surgeProbabilityPct: 82.0, hotspotLevel: 'CRITICAL_HOTSPOT', proactiveNgoAlert: true },
      { districtId: 'SOUTH_MUMBAI_HOTELS', districtName: 'South Mumbai (Colaba & Marine Drive)', predictedSurplusKg: 350, predictedMeals: 770, surgeProbabilityPct: 76.0, hotspotLevel: 'MODERATE_SURGE', proactiveNgoAlert: false },
      { districtId: 'LOWER_PAREL_MILLS', districtName: 'Lower Parel & Phoenix Mills', predictedSurplusKg: 330, predictedMeals: 726, surgeProbabilityPct: 72.0, hotspotLevel: 'MODERATE_SURGE', proactiveNgoAlert: false },
      { districtId: 'ANDHERI_MIDC', districtName: 'Andheri East & SEEPZ MIDC', predictedSurplusKg: 290, predictedMeals: 638, surgeProbabilityPct: 58.0, hotspotLevel: 'MODERATE_SURGE', proactiveNgoAlert: false },
    ]
  },
  {
    date: '2026-10-08',
    dayOfWeek: 'Thursday',
    isWeekend: false,
    districtForecasts: [
      { districtId: 'BKC_COMMERCIAL', districtName: 'Bandra Kurla Complex (BKC)', predictedSurplusKg: 550, predictedMeals: 1210, surgeProbabilityPct: 96.0, hotspotLevel: 'CRITICAL_HOTSPOT', proactiveNgoAlert: true },
      { districtId: 'SOUTH_MUMBAI_HOTELS', districtName: 'South Mumbai (Colaba & Marine Drive)', predictedSurplusKg: 460, predictedMeals: 1012, surgeProbabilityPct: 89.0, hotspotLevel: 'CRITICAL_HOTSPOT', proactiveNgoAlert: true },
      { districtId: 'LOWER_PAREL_MILLS', districtName: 'Lower Parel & Phoenix Mills', predictedSurplusKg: 410, predictedMeals: 902, surgeProbabilityPct: 85.0, hotspotLevel: 'CRITICAL_HOTSPOT', proactiveNgoAlert: true },
      { districtId: 'ANDHERI_MIDC', districtName: 'Andheri East & SEEPZ MIDC', predictedSurplusKg: 340, predictedMeals: 748, surgeProbabilityPct: 65.0, hotspotLevel: 'MODERATE_SURGE', proactiveNgoAlert: false },
    ]
  }
];
