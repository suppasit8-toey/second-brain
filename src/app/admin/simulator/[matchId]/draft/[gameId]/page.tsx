import { getMatch } from '@/app/admin/simulator/actions'
import { getHeroesByVersion } from '@/app/admin/heroes/actions'
import DraftInterface from '@/app/admin/simulator/_components/DraftInterface'
import { notFound } from 'next/navigation'
import { DraftGame } from '@/utils/types'

interface PageProps {
    params: Promise<{
        matchId: string;
        gameId: string;
    }>
}

export default async function DraftPage({ params }: PageProps) {
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
        <div className="h-[calc(100vh-4rem)] overflow-hidden">
            <DraftInterface match={match} game={game} initialHeroes={heroes} />
        </div>
    )
}
