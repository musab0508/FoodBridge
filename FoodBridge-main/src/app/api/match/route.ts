import { NextResponse } from 'next/server';
import { fetchAIMatches } from '@/lib/aiClient';

export async function POST(req: Request) {
  try {
    const { donation, ngos } = await req.json();
    const rankings = await fetchAIMatches(donation, ngos);
    return NextResponse.json({
      success: true,
      rankings
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
