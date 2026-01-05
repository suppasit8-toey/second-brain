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

    return <HeroDetailView hero={hero} matchups={matchups} />
}
