
import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
    const supabase = await createClient()

    // Query picks at Slot 5
    const { data: picks, error } = await supabase
        .from('draft_picks')
        .select(`
            hero_id,
            assigned_role,
            hero:heroes(name)
        `)
        .eq('position_index', 5)

    if (error) return NextResponse.json({ error }, { status: 500 })

    const roleCounts: Record<string, number> = {}
    const heroCounts: Record<string, number> = {}

    picks?.forEach((p: any) => {
        const role = p.assigned_role || 'No Role'
        roleCounts[role] = (roleCounts[role] || 0) + 1

        const heroName = p.hero?.name || p.hero_id
        heroCounts[heroName] = (heroCounts[heroName] || 0) + 1
    })

    return NextResponse.json({
        total: picks?.length,
        roleCounts,
        topHeroes: Object.entries(heroCounts).sort((a, b) => b[1] - a[1]).slice(0, 10)
    })
}
