import { NextResponse } from 'next/server';
import { fetchOptimizedRoute } from '@/lib/aiClient';

export async function POST(req: Request) {
  try {
    const { volunteerLat, volunteerLng, pickups, dropoffNgo } = await req.json();
    const route = await fetchOptimizedRoute(volunteerLat, volunteerLng, pickups, dropoffNgo);
    return NextResponse.json({
      success: true,
      route
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
