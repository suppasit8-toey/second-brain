
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

async function debugBans() {
    console.log('--- START DEBUG BANS ---')
    const { data: bans, error } = await supabase
        .from('draft_picks')
        .select('id, match_id, game_id, type, side, position_index, hero_id')
        .eq('type', 'BAN')
        .limit(10)
        .order('id', { ascending: false })

    if (error) {
        console.error('Error:', error)
    } else {
        console.log(`Found ${bans.length} bans.`)
        console.table(bans)
    }
    console.log('--- END DEBUG BANS ---')
    process.exit(0)
}

debugBans()
