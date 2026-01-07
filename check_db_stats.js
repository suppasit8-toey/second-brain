
const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Manually read .env.local
const envPath = path.resolve(__dirname, '.env.local')
const envConfig = fs.readFileSync(envPath, 'utf8')
const env = {}
envConfig.split('\n').forEach(line => {
    const [key, value] = line.split('=')
    if (key && value) {
        env[key.trim()] = value.trim().replace(/"/g, '') // remove quotes
    }
})

const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL']
const supabaseKey = env['NEXT_PUBLIC_SUPABASE_ANON_KEY']

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials in .env.local")
    process.exit(1)
}

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
