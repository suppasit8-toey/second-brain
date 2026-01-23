
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.error('Missing Supabase credentials in .env.local')
    process.exit(1)
}

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

async function check() {
    console.log('--- Checking win_conditions table ---')
    const { data, error } = await supabase.from('win_conditions').select('count', { count: 'exact', head: true })

    if (error) {
        console.error('Error connecting to table:')
        console.error(JSON.stringify(error, null, 2))
        if (error.code === '42P01') {
            console.log('\n[CONCLUSION] Table "win_conditions" DOES NOT EXIST.')
        } else {
            console.log('\n[CONCLUSION] Unknown error, check logs.')
        }
    } else {
        console.log('Success! Table exists.')
        console.log('Data:', data)
    }
}

check()
