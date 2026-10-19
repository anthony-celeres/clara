// app/api/test-supabase/route.ts
import { supabase } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const { data, error } = await supabase.from('guides').select('*').limit(1)
    return NextResponse.json({ 
      success: true, 
      data: data || [], 
      error: error?.message || null 
    })
  } catch (err) {
    return NextResponse.json({ 
      success: false, 
      error: String(err) 
    }, { status: 500 })
  }
}