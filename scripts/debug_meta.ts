
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function debugMeta() {
    console.log("--- Debugging Meta Analysis Data ---")

    // 1. Get latest Finished match to see context
    const { data: recentMatch } = await supabase
        .from('draft_matches')
        .select('*')
        .eq('status', 'finished')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

    if (!recentMatch) {
        console.log("No finished matches found to infer context.")
    } else {
        console.log("Recent Match Context:")
        console.log("  ID:", recentMatch.id)
        console.log("  Version ID:", recentMatch.version_id)
        console.log("  Tournament ID:", recentMatch.tournament_id)
        console.log("  Teams:", recentMatch.team_a_name, "vs", recentMatch.team_b_name)
    }

    const versionId = recentMatch?.version_id || 1 // fallback
    const tournamentId = recentMatch?.tournament_id

    // 2. Check Heroes with Stats
    const { data: heroes } = await supabase
        .from('heroes')
        .select(`
            id, name,
            hero_stats(tier, win_rate, pick_rate, ban_rate)
        `)
        .eq('hero_stats.version_id', versionId)

    // Filter heroes with actual stats
    const heroesWithStats = heroes?.filter((h: any) => h.hero_stats && h.hero_stats.length > 0) || []
    console.log(`\nHeroes with stats for Version ${versionId}: ${heroesWithStats.length} / ${heroes?.length}`)

    // 3. Check Tournament Matches (if ID exists)
    if (tournamentId) {
        const { data: tourneyMatches } = await supabase
            .from('draft_matches')
            .select(`
                id,
                games:draft_games(
                    winner,
                    picks:draft_picks(hero_id, type, side)
                )
            `)
            .eq('tournament_id', tournamentId)
            .eq('status', 'finished')

        console.log(`\nTournament Matches for ${tournamentId}: ${tourneyMatches?.length}`)

        if (tourneyMatches && tourneyMatches.length > 0) {
            let totalGames = 0
            tourneyMatches.forEach((m: any) => totalGames += m.games?.length || 0)
            console.log(`  Total Games in these matches: ${totalGames}`)
        }
    } else {
        console.log("\nNo Tournament ID available to check specific meta.")
    }

    // 4. Test Fallback Logic
    // .filter(h => (h.hero_stats?.[0]?.pick_rate || 0) > 15 || (h.hero_stats?.[0]?.win_rate || 0) > 52)
    const fallbackHeroes = heroesWithStats.filter((h: any) => {
        const stats = h.hero_stats[0]
        return (stats.pick_rate > 15 || stats.win_rate > 52)
    })

    console.log(`\nFallback Logic Candidates: ${fallbackHeroes.length}`)
    if (fallbackHeroes.length > 0) {
        console.log("  Top 3 Candidates:", fallbackHeroes.slice(0, 3).map((h: any) => h.name))
    }
}

debugMeta()
