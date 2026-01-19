import { getMatch } from '@/app/admin/simulator/actions'
import { getHeroesByVersion } from '@/app/admin/heroes/actions'
import SharedMatchRoom from '../_components/SharedMatchRoom'
import { notFound } from 'next/navigation'
import { UIProvider } from '@/context/UIContext'
import { Metadata } from 'next'

interface PageProps {
    params: Promise<{
        matchId: string;
    }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { matchId } = await params
    const match = await getMatch(matchId)

    if (!match) {
        return {
            title: 'Match Not Found',
        }
    }

    return {
        title: `${match.team_a_name} vs ${match.team_b_name} | Draft Simulator`,
        description: `View the draft simulation for ${match.team_a_name} vs ${match.team_b_name} - ${match.tournament?.name || 'Simulator'}`,
    }
}

export default async function SharedMatchPage({ params }: PageProps) {
    const { matchId } = await params
    const match = await getMatch(matchId)

    if (!match) {
        notFound()
    }

    const heroes = await getHeroesByVersion(match.version_id)

    return (
        <UIProvider>
            <SharedMatchRoom match={match} heroes={heroes} />
        </UIProvider>
    )
}
