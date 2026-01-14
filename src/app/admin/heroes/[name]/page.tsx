import { createClient } from '@/utils/supabase/server'
import { notFound } from 'next/navigation'
import HeroDetailView from '@/components/HeroDetailView'

// Define Props for Next.js 15+ Page
type Props = {
    params: Promise<{ name: string }>
}

export default async function HeroDetailPage({ params }: Props) {
    const { name } = await params
    const decodedName = decodeURIComponent(name)
    const supabase = await createClient()

    // 1. Fetch Hero by Name (Case Insensitive)
    const { data: hero, error } = await supabase
        .from('heroes')
        .select(`
      *,
      hero_stats (
        tier,
        power_spike,
        win_rate,
        version_id
      )
    `)
        .ilike('name', decodedName)
        .single()

    if (error || !hero) {
        console.error("Hero lookup failed:", error)
        notFound()
    }

    // 2. Fetch Active Version
    const { data: activeVersion } = await supabase
        .from('versions')
        .select('id')
        .eq('is_active', true)
        .single();

    // --- NEW: Calculate Win Rate from Scrim History ---
    let calculatedWinRate = 0;
    let totalGames = 0;

    if (activeVersion) {
        // A. Get all match IDs for this version
        const { data: matches } = await supabase
            .from('draft_matches')
            .select('id')
            .eq('version_id', activeVersion.id);

        const matchIds = matches?.map(m => m.id) || [];

        if (matchIds.length > 0) {
            // B. Get all picks for this hero in those matches
            // We use !inner on draft_games to ensure we only get picks that have a valid game
            // We select draft_games explicitly to check the winner
            const { data: scrimPicks } = await supabase
                .from('draft_picks')
                .select(`
                    side,
                    draft_games!inner (
                        winner,
                        match_id
                    )
                `)
                .eq('hero_id', hero.id)
                .eq('type', 'PICK')
                .in('draft_games.match_id', matchIds);

            if (scrimPicks && scrimPicks.length > 0) {
                totalGames = scrimPicks.length;
                const wins = scrimPicks.filter((pick: any) => {
                    const game = pick.draft_games;
                    if (!game || !game.winner) return false;

                    const pSide = pick.side?.toUpperCase(); // "BLUE" or "RED"
                    const gWinner = game.winner?.toUpperCase(); // "BLUE" or "RED" or "Blue"/"Red" depending on DB consistency

                    return pSide === gWinner;
                }).length;

                calculatedWinRate = Math.round((wins / totalGames) * 100);
            }
        }
    }

    // Override the static win_rate with our dynamic scrim win rate
    // We treat the first stats entry as the active one for display purposes
    if (!hero.hero_stats) {
        hero.hero_stats = [];
    }

    if (hero.hero_stats.length === 0) {
        // Create a dummy stat object if none exists
        hero.hero_stats.push({
            tier: '?',
            power_spike: 'Unknown',
            win_rate: calculatedWinRate,
            matches_played: totalGames,
            version_id: activeVersion?.id
        });
    } else {
        // Update existing
        hero.hero_stats[0].win_rate = calculatedWinRate;
        hero.hero_stats[0].matches_played = totalGames;
    }
    // --------------------------------------------------

    // 3. Fetch Matchups (if active version exists)
    let matchups: any[] = [];

    if (activeVersion && hero) {
        const { data } = await supabase
            .from('matchups')
            .select(`
                position,
                win_rate,
                enemy_position,
                enemy_hero:heroes!enemy_hero_id ( id, name, icon_url )
            `)
            .eq('hero_id', hero.id)
            .eq('version_id', activeVersion.id)
            .order('win_rate', { ascending: false });

        if (data) {
            matchups = data;
        }
    }

    // 4. Fetch Hero Combos
    let combos: any[] = [];
    if (activeVersion && hero) {
        const { data } = await supabase
            .from('hero_combos')
            .select(`
            id,
            hero_a_id,
            hero_a_position,
            hero_b_id,
            hero_b_position,
            synergy_score,
            description,
            hero_a:heroes!hero_combos_hero_a_id_fkey(id, name, icon_url),
            hero_b:heroes!hero_combos_hero_b_id_fkey(id, name, icon_url)
        `)
            .eq('version_id', activeVersion.id)
            .or(`hero_a_id.eq.${hero.id},hero_b_id.eq.${hero.id}`)
            .order('synergy_score', { ascending: false });

        if (data) combos = data;
    }

    return <HeroDetailView hero={hero} matchups={matchups} combos={combos} />
}
