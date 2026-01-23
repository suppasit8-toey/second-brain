
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

async function checkTable() {
    console.log('Checking for win_conditions table...')
    const { data, error } = await supabase.from('win_conditions').select('*').limit(1)

    if (error) {
        console.error('Error (Table likely does not exist):', error.message)
    } else {
        console.log('Table exists. Data sample:', data)
    }
}

checkTable()
