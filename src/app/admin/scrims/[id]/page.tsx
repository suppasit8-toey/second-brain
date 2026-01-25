import { getMatch } from '../../draft/actions'
import { getHeroesByVersion, getAllHeroes } from '../../heroes/actions'
import ScrimClient from './ScrimClient'
import { notFound } from 'next/navigation'

export default async function ScrimPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const match = await getMatch(id)

    if (!match) {
        notFound()
    }

    // Fetch heroes for the match version
    // Fallback to all heroes if version somehow invalid, or just empty list
    // match.version_id should be number
    let heroes = []
    if (match.version_id) {
        heroes = await getHeroesByVersion(match.version_id)
    } else {
        heroes = await getAllHeroes()
    }

    return <ScrimClient initialMatch={match} heroes={heroes} />
}
