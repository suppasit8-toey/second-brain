
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkGames() {
    const teamA = 'BURIRAM UNITED ESPORTS'
    const teamB = 'FULL SENSE'

    console.log(`Checking games involving: ${teamA} OR ${teamB}`)

    const { data: games, error } = await supabase
        .from('draft_games')
        .select(`
            id, 
            match_id, 
            blue_team_name, 
            red_team_name, 
            winner,
            match:draft_matches(status)
        `)
        .or(`blue_team_name.eq.${teamA},red_team_name.eq.${teamA},blue_team_name.eq.${teamB},red_team_name.eq.${teamB}`)

    if (error) {
        console.error('Error fetching games:', error)
        return
    }

    console.log(`Found ${games.length} total games with these names.`)

    const finishedGames = games.filter((g: any) => g.match && g.match.status === 'finished')
    console.log(`Found ${finishedGames.length} finished games.`)

    if (finishedGames.length > 0) {
        console.log('Sample finished game:', finishedGames[0])
    }

    // Check exact name matches
    const exactA = games.filter((g: any) => g.blue_team_name === teamA || g.red_team_name === teamA)
    const exactB = games.filter((g: any) => g.blue_team_name === teamB || g.red_team_name === teamB)

    console.log(`Games for ${teamA}: ${exactA.length}`)
    console.log(`Games for ${teamB}: ${exactB.length}`)

    // Check strict equality in DB vs intended
    if (games.length === 0) {
        console.log("Checking if names have whitespace issues...")
        const { data: allTeams } = await supabase.from('draft_games').select('blue_team_name, red_team_name').limit(100)
        console.log("Recent team names in DB:", allTeams?.map(t => `${t.blue_team_name} | ${t.red_team_name}`))
    }
}

checkGames()
