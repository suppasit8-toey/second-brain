
import { createClient } from '@/utils/supabase/server'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

async function checkSlugs() {
    const supabase = await createClient()

    console.log("Checking top 50 SLUGS...")
    const { data: matches, error } = await supabase
        .from('draft_matches')
        .select('slug')
        .ilike('slug', 'SCRIM%')
        .order('slug', { ascending: false })
        .limit(50)

    if (error) {
        console.error("Error:", error)
        return
    }

    console.log("Found:", matches.length)
    matches.forEach(m => console.log(m.slug))
}

checkSlugs()
