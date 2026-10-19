import { NextRequest, NextResponse } from 'next/server';
import { scrubPII } from '@/lib/pii-scrubber';

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();
    if (typeof text !== 'string') {
      return NextResponse.json({ error: 'Invalid input text' }, { status: 400 });
    }
    const scrubbed = scrubPII(text);
    return NextResponse.json({ text: scrubbed });
  } catch (e: any) {
    console.error("PII Scrub route error:", e);
    return NextResponse.json({ error: 'Server error scrubbing text' }, { status: 500 });
  }
}
