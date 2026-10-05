import { NextResponse } from 'next/server';
import { MOCK_FORECASTS } from '@/lib/mockData';

const AI_MICROSERVICE_URL = 'http://localhost:8000';

export async function GET(req: Request) {
  try {
    const res = await fetch(`${AI_MICROSERVICE_URL}/api/v1/forecast?days=7`);
    if (res.ok) {
      const data = await res.json();
      return NextResponse.json(data);
    }
  } catch (e) {
    // Microservice offline fallback
  }

  return NextResponse.json({
    success: true,
    data: {
      generatedAt: new Date().toISOString(),
      forecastDays: 7,
      dailyForecasts: MOCK_FORECASTS
    }
  });
}
