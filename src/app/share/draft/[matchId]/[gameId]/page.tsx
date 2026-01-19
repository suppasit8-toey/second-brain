import { getMatch } from '@/app/admin/simulator/actions'
import { getHeroesByVersion } from '@/app/admin/heroes/actions'
import DraftInterface from '@/app/admin/simulator/_components/DraftInterface'
import { notFound } from 'next/navigation'
import { DraftGame } from '@/utils/types'
import { UIProvider } from '@/context/UIContext'
import { Metadata } from 'next'

interface PageProps {
    params: Promise<{
        matchId: string;
        gameId: string;
    }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { matchId, gameId } = await params
    const match = await getMatch(matchId)
    const game = match?.games?.find((g: DraftGame) => g.id === gameId)

    if (!match || !game) {
        return {
            title: 'Draft Not Found',
        }
    }

    return {
        title: `${match.team_a_name} vs ${match.team_b_name} | Game ${game.game_number}`,
        description: `Live Draft: ${match.team_a_name} vs ${match.team_b_name} - ${match.tournament?.name || 'Simulator'}`,
    }
}

export default async function SharedDraftPage({ params }: PageProps) {
    const { matchId, gameId } = await params
    const match = await getMatch(matchId)

    if (!match) {
        notFound()
    }

    const game = match.games?.find((g: DraftGame) => g.id === gameId)

    if (!game) {
        notFound()
    }

    const heroes = await getHeroesByVersion(match.version_id)

    return (
        <UIProvider>
            <div className="min-h-screen bg-slate-950 text-white overflow-hidden">
                <DraftInterface match={match} game={game} initialHeroes={heroes} />
            </div>
        </UIProvider>
    )
}
