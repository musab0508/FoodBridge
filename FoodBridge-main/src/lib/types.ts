export type Role = 'DONOR' | 'NGO' | 'VOLUNTEER' | 'ADMIN';

export type DonationStatus = 
  | 'POSTED' 
  | 'AI_MATCHED' 
  | 'ACCEPTED' 
  | 'PICKED_UP' 
  | 'DISTRIBUTED' 
  | 'AUDITED'
  | 'EXPIRED';

export type FoodCategory = 
  | 'COOKED_MEALS' 
  | 'BAKERY_PASTRY' 
  | 'FRESH_PRODUCE' 
  | 'DAIRY_PACKAGED' 
  | 'FROZEN'
  | 'RAW_INGREDIENTS';

export type StorageRequirement = 'AMBIENT' | 'REFRIGERATED' | 'FROZEN' | 'HOT_CONTAINER';

export interface LocationPoint {
  latitude: number;
  longitude: number;
  address: string;
}

export interface DonorProfile {
  id: string;
  name: string;
  orgType: string;
  reputationScore: number;
  latitude: number;
  longitude: number;
  address: string;
}

export interface NgoProfile {
  id: string;
  name: string;
  capacityServings: number;
  currentRemaining: number;
  dietaryConstraints: string[];
  intakeHours: string;
  latitude: number;
  longitude: number;
  address: string;
}

export interface VolunteerProfile {
  id: string;
  name: string;
  vehicleType: string;
  isAvailable: boolean;
  latitude: number;
  longitude: number;
  activePayloadKg: number;
  maxCapacityKg: number;
}

export interface Donation {
  id: string;
  donorId: string;
  donorName: string;
  title: string;
  description: string;
  category: FoodCategory;
  servingsCount: number;
  weightKg: number;
  prepTime: string;
  expirationEta: string;
  storageRequirement: StorageRequirement;
  imageUrl?: string;
  status: DonationStatus;
  
  // AI Attributes
  urgencyScore: number;
  qualityIndex: number;
  spoilageRiskFlag: boolean;
  aiMatchedNgoId?: string;
  
  latitude: number;
  longitude: number;
  address: string;
  createdAt: string;
}

export interface MatchResult {
  ngoId: string;
  ngoName: string;
  matchScore: number;
  distanceKm: number;
  urgencyScore: number;
  remainingHours: number;
  capacityMatch: boolean;
  dietaryMatch: boolean;
  radiusExpanded: boolean;
  recommendedPriority: 'CRITICAL' | 'HIGH' | 'NORMAL';
}

export interface RouteStop {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  type: 'PICKUP' | 'DELIVERY';
  servings?: number;
  weightKg?: number;
  legDistanceKm: number;
  cumulativeDistKm: number;
  estLegTimeMinutes: number;
}

export interface OptimizedRoute {
  volunteerStart: { latitude: number; longitude: number };
  totalStops: number;
  optimizedRoute: RouteStop[];
  totalDistanceKm: number;
  totalEstTimeMinutes: number;
  totalPayloadKg: number;
  routingAlgorithm: string;
  carbonSavedTransitKg: number;
  routePolylinePoints: [number, number][];
}

export interface TelemetryReading {
  donationId: string;
  sensorId: string;
  timestamp: string;
  temperatureC: number;
  humidityPct: number;
  thermalBreach: boolean;
}

export interface DistrictForecast {
  districtId: string;
  districtName: string;
  predictedSurplusKg: number;
  predictedMeals: number;
  surgeProbabilityPct: number;
  hotspotLevel: 'CRITICAL_HOTSPOT' | 'MODERATE_SURGE' | 'STABLE';
  proactiveNgoAlert: boolean;
}

export interface DailyForecast {
  date: string;
  dayOfWeek: string;
  isWeekend: boolean;
  districtForecasts: DistrictForecast[];
}
