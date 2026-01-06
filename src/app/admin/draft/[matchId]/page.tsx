import { getMatch } from '../actions'
import MatchRoom from '../_components/MatchRoom'
import { getHeroesByVersion } from '../../heroes/actions'
import { notFound } from 'next/navigation'

export default async function MatchRoomPage({ params }: { params: { matchId: string } }) {
    const match = await getMatch(params.matchId)

    if (!match) {
        notFound()
    }

    const heroes = await getHeroesByVersion(match.version_id)

    return <MatchRoom match={match} heroes={heroes} />
}
