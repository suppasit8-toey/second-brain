
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

async function debugBans() {
    console.log('Fetching recent Bans...')
    const { data: bans, error } = await supabase
        .from('draft_picks')
        .select('id, match_id, game_id, type, side, position_index, hero_id')
        .eq('type', 'BAN')
        .limit(20)
        .order('id', { ascending: false })

    if (error) {
        console.error('Error:', error)
        return
    }

    console.log('Found Bans:', bans.length)
    console.table(bans)

    // Also check if any bans have side
    const bansWithSide = bans.filter(b => b.side)
    console.log(`Bans with side: ${bansWithSide.length} / ${bans.length}`)
}

debugBans()
