import { NextResponse } from 'next/server';
import { INITIAL_TELEMETRY } from '@/lib/mockData';

export async function GET() {
  return NextResponse.json({
    success: true,
    telemetry: INITIAL_TELEMETRY
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const newLog = {
      ...body,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      thermalBreach: body.temperatureC > 8.0 || body.temperatureC < 2.0
    };
    return NextResponse.json({
      success: true,
      log: newLog
    }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}
