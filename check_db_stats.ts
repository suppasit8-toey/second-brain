
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

async function checkStats() {
    console.log("Checking DB Stats...")

    // 1. Get Patches
    const { data: patches, error: patchError } = await supabase
        .from('patches')
        .select('id, version, created_at')
        .order('created_at', { ascending: false })

    if (patchError) {
        console.error("Error fetching patches:", patchError)
        return
    }

    console.log(`Found ${patches.length} patches.`)

    for (const p of patches) {
        const { count, error: countError } = await supabase
            .from('hero_stats')
            .select('*', { count: 'exact', head: true })
            .eq('version_id', p.id)

        console.log(`Patch [${p.version}] (ID: ${p.id}): ${count} hero_stats entries.`)
    }
}

checkStats()
