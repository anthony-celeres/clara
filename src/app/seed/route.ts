// app/api/seed/route.ts
import { supabase } from '@/lib/supabase'
import { GUIDES_SEED, PERSONAS_SEED } from '@/lib/seed-data'
import { NextResponse } from 'next/server'

export async function GET() {
  const results: string[] = []
  let hasError = false

  try {
    // ========================================
    // 1. Insert knowledge_base entries
    // ========================================
    console.log('📚 Inserting knowledge_base...')
    
    const kbEntries = [
      { kb_id: 101, title: 'RA 9048 Clerical Error Correction', category: 'Birth', version: '1.0', is_active: true },
      { kb_id: 102, title: 'Late Registration of Birth', category: 'Birth', version: '1.0', is_active: true },
      { kb_id: 103, title: 'Indigenous Peoples Registration (IPRA RA 8371)', category: 'Birth', version: '1.0', is_active: true },
    ]

    for (const entry of kbEntries) {
      const { error } = await supabase
        .from('knowledge_base')
        .upsert(entry, { onConflict: 'kb_id' })
      
      if (error) {
        results.push(`❌ KB ${entry.kb_id}: ${error.message}`)
        hasError = true
      } else {
        results.push(`✅ KB ${entry.kb_id}: ${entry.title}`)
      }
    }

    // ========================================
    // 2. Insert guides (exclude category column)
    // ========================================
    console.log('📖 Inserting guides...')
    
    // Remove 'category' from guides (it doesn't exist in the guides table)
    const guidesToInsert = GUIDES_SEED.map(({ category, ...rest }) => rest)

    const { data: guidesData, error: guidesError } = await supabase
      .from('guides')
      .upsert(guidesToInsert, { onConflict: 'guide_id' })
      .select()

    if (guidesError) {
      results.push(`❌ Guides: ${guidesError.message}`)
      hasError = true
    } else {
      results.push(`✅ Guides: Inserted ${guidesData?.length || 0} guides`)
    }

    // ========================================
    // 3. Insert personas
    // ========================================
    console.log('👤 Inserting personas...')

    // Map PERSONAS_SEED to the schema columns defined in PostgreSQL
    const validPersonas = PERSONAS_SEED.map((p) => ({
      persona_id: p.persona_id,
      name: p.name,
      avatar: p.avatar,
      age: p.age,
      address: p.address,
      backstory: p.backstory,
      problem_type: p.problem_type,
      is_active: true
    }));

    const { data: personasData, error: personasError } = await supabase
      .from('personas')
      .upsert(validPersonas, { onConflict: 'persona_id' })
      .select()

    if (personasError) {
      results.push(`❌ Personas: ${personasError.message}`)
      hasError = true
    } else {
      results.push(`✅ Personas: Inserted ${personasData?.length || 0} personas`)
    }

    // ========================================
    // 4. Verification
    // ========================================
    console.log('🔍 Verifying data...')
    
    const { count: guideCount, error: countError } = await supabase
      .from('guides')
      .select('*', { count: 'exact', head: true })
    
    if (!countError) {
      results.push(`📊 Total guides in database: ${guideCount}`)
    }

    const { count: personaCount } = await supabase
      .from('personas')
      .select('*', { count: 'exact', head: true })
    
    if (!personaCount) {
      results.push(`📊 Total personas in database: ${personaCount || 0}`)
    }

    // ========================================
    // 5. Return Response
    // ========================================
    return NextResponse.json({
      success: !hasError,
      message: hasError ? 'Seeding completed with errors' : 'Database seeded successfully!',
      details: results
    })

  } catch (error: any) {
    console.error('❌ Seed failed:', error)
    return NextResponse.json({ 
      success: false,
      error: error.message,
      details: results
    }, { status: 500 })
  }
}