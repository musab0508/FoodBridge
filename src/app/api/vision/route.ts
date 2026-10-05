import { NextResponse } from 'next/server';
import { runVisionInspection } from '@/lib/aiClient';

export async function POST(req: Request) {
  try {
    const { foodCategory } = await req.json();
    const result = await runVisionInspection(foodCategory || 'COOKED_MEALS');
    return NextResponse.json({
      success: true,
      inspection: result
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
