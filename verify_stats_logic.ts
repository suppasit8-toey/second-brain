
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

async function verifyStats() {
    const teamName = "Buriram United Esports"
    console.log(`Verifying stats logic for team: ${teamName}`)

    // 1. Fetch Matches (Simplified query)
    const { data: matches, error } = await supabase
        .from('draft_matches')
        .select(`
            games:draft_games(
                id,
                winner,
                blue_team_name,
                red_team_name,
                picks:draft_picks(
                    hero_id,
                    type,
                    side,
                    position_index
                )
            )
        `)
        .eq('status', 'finished')
        .or(`team_a_name.eq."${teamName}",team_b_name.eq."${teamName}"`)
        .limit(5)

    if (error) {
        console.error("Error fetching matches:", error)
        return
    }

    let totalBans = 0
    let bansWithSide = 0
    let bansInferred = 0
    let blueBans = 0
    let redBans = 0

    matches?.forEach((match: any) => {
        match.games?.forEach((game: any) => {
            // Determine Target Side
            let targetSide = null
            const blueName = (game.blue_team_name || '').trim()
            const redName = (game.red_team_name || '').trim()

            if (blueName === teamName || blueName.includes(teamName)) targetSide = 'BLUE'
            else if (redName === teamName || redName.includes(teamName)) targetSide = 'RED'

            if (!targetSide) return

            game.picks?.forEach((p: any) => {
                if (p.type !== 'BAN') return

                totalBans++

                let pSide = (p.side || '').toUpperCase()
                if (pSide === 'BLUE SIDE') pSide = 'BLUE'
                if (pSide === 'RED SIDE') pSide = 'RED'

                if (pSide) bansWithSide++

                // Inference Logic
                if (!pSide && p.position_index) {
                    if ([1, 3, 6, 8].includes(p.position_index)) pSide = 'BLUE';
                    else if ([2, 4, 5, 7].includes(p.position_index)) pSide = 'RED';
                    if (pSide) bansInferred++
                }

                // Check Filter
                if (pSide === targetSide) {
                    if (pSide === 'BLUE') blueBans++
                    else redBans++
                }
            })
        })
    })

    console.log(`Total Bans Found in Sample: ${totalBans}`)
    console.log(`Bans with explicit side: ${bansWithSide}`)
    console.log(`Bans inferred: ${bansInferred}`)
    console.log(`Bans attributed to ${teamName}: ${blueBans + redBans} (Blue: ${blueBans}, Red: ${redBans})`)
}

verifyStats()
