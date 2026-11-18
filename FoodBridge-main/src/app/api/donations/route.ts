import { NextResponse } from 'next/server';
import { INITIAL_DONATIONS } from '@/lib/mockData';

export async function GET() {
  return NextResponse.json({
    success: true,
    data: INITIAL_DONATIONS
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const newDonation = {
      id: `don_${Date.now()}`,
      ...body,
      createdAt: new Date().toISOString()
    };
    return NextResponse.json({
      success: true,
      donation: newDonation
    }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}
