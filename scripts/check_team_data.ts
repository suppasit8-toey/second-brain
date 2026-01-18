import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function checkTeamData() {
    const teams = ['Godji Check', 'FULL SENSE']

    console.log("=== Checking Team Data for Cerebro AI ===\n")

    for (const teamName of teams) {
        console.log(`📋 Team: "${teamName}"`)
        console.log("─".repeat(40))

        // Check if team exists in teams table
        const { data: team } = await supabase
            .from('teams')
            .select('id, name')
            .ilike('name', teamName)
            .maybeSingle()

        console.log(`  ➤ In 'teams' table: ${team ? `✅ Found (ID: ${team.id})` : '❌ NOT FOUND'}`)

        // Check games where this team participated
        const { data: games, count } = await supabase
            .from('draft_games')
            .select('id, blue_team_name, red_team_name, winner, match:draft_matches!inner(status)', { count: 'exact' })
            .or(`blue_team_name.eq."${teamName}",red_team_name.eq."${teamName}"`)
            .limit(5)

        const finishedGames = games?.filter((g: any) => g.match?.status === 'finished') || []

        console.log(`  ➤ Total games found: ${count || 0}`)
        console.log(`  ➤ Finished games: ${finishedGames.length}`)

        if (finishedGames.length > 0) {
            console.log(`  ➤ Sample: ${finishedGames[0].blue_team_name} vs ${finishedGames[0].red_team_name} (Winner: ${finishedGames[0].winner || 'TBD'})`)
        } else {
            console.log(`  ⚠️ No finished games found. Team Hero Pool and Roster data will be empty.`)
        }

        console.log("")
    }

    console.log("=== Summary ===")
    console.log("If teams have no finished games, their 'Team Hero Pool' and 'Roster Dominance' tabs will show 'No data'.")
    console.log("The 'Meta Stats' tab uses global data and should always show results.")
}

checkTeamData().catch(console.error)
