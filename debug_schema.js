
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '.env.local');
let fileEnv = {};
if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach(line => {
        const [key, value] = line.split('=');
        if (key && value) {
            fileEnv[key.trim()] = value.trim().replace(/^"|"$/g, '');
        }
    });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || fileEnv.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || fileEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log('Checking draft_picks columns...');

    // Fetch one row to see structure. Note: Select * might be blocked or return specific columns if not typed.
    // But since we are using JS client without types, select('*') should return everything.
    const { data: picks, error } = await supabase
        .from('draft_picks')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error:', error);
        return;
    }

    if (picks.length > 0) {
        console.log('Columns found:', Object.keys(picks[0]));
        console.log('Sample row:', picks[0]);
    } else {
        console.log('No picks found to inspect.');
    }
}

run();
