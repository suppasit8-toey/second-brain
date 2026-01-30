
const { createClient } = require('@supabase/supabase-js');

// Load env vars if needed, or use hardcoded service role/anon key for local dev if available in environment
// Assuming standard Next.js env vars structure, but running standalone might miss them.
// I'll try to use the ones likely present or ask for them if needed. 
// For now, I'll attempt to import from a local file if possible, or just rely on process.env if loaded.
// Actually, I'll try to read .env.local

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
    console.log('Fetching games for Buriram United Esports...');
    const searchName = 'Buriram United Esports';

    const { data: games, error } = await supabase
        .from('draft_games')
        .select(`
            id,
            blue_team_name,
            red_team_name,
            winner,
            draft_picks ( side, hero_id, type )
        `)
        .or(`blue_team_name.eq.${searchName},red_team_name.eq.${searchName}`)
        .limit(3); // Limit to 3 for brevity

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log('Found games:', games.length);
    games.forEach(g => {
        console.log('---');
        console.log(`Blue: '${g.blue_team_name}'`);
        console.log(`Winner: '${g.winner}'`);

        const isBlue = g.blue_team_name === searchName;
        const winnerUpper = g.winner ? g.winner.toUpperCase() : 'NULL';
        const won = (isBlue && winnerUpper === 'BLUE') || (!isBlue && winnerUpper === 'RED');
        console.log(`Won: ${won}`);

        if (g.draft_picks && g.draft_picks.length > 0) {
            console.log(`Sample pick side: '${g.draft_picks[0].side}'`);
            const mySide = isBlue ? 'BLUE' : 'RED';
            const myPicks = g.draft_picks.filter(p => p.side === mySide && p.type === 'PICK');
            console.log(`My Picks (Side=${mySide}): ${myPicks.length}`);
            if (myPicks.length === 0) {
                // Check if casing is the issue
                const mixedSide = isBlue ? 'Blue' : 'Red';
                const mixedPicks = g.draft_picks.filter(p => p.side === mixedSide);
                console.log(`My Picks (Side=${mixedSide}): ${mixedPicks.length}`);
            }
        }
    });
}

run();
