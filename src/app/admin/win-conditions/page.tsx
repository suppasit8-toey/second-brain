import { getVersions, getHeroesByVersion } from '@/app/admin/heroes/actions'
import { getTournaments } from '@/app/admin/tournaments/actions'
import { WinConditionManager } from './_components/WinConditionManager'
import { Flag } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function WinConditionPage() {
    // 1. Fetch Versions & Tournaments
    const versionsData = await getVersions()
    const tournamentsData = await getTournaments()

    // 2. Fetch Heroes (Use active version or first one)
    const activeVersion = versionsData?.find((v: any) => v.is_active) || versionsData?.[0]
    let heroesData = []

    if (activeVersion) {
        heroesData = await getHeroesByVersion(activeVersion.id) as any[]
    }

    // Format for simple consumption
    const versions = versionsData?.map((v: any) => v.name) || []

    // Format tournaments 
    const tournaments = tournamentsData?.map((t: any) => ({
        id: t.id,
        name: t.name,
        status: t.status // potentially needed for filtering active ones
    })) || []

    const heroes = heroesData?.map((h: any) => ({
        id: h.id,
        name: h.name,
        image_url: h.icon_url,
        roles: h.main_position
    })) || []

    return (
        <div className="p-6 space-y-6 pb-24">
            <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-500/10 rounded-xl border border-purple-500/20">
                    <Flag className="w-8 h-8 text-purple-400" />
                </div>
                <div>
                    <h1 className="text-3xl font-black italic tracking-tighter text-white">
                        WIN CONDITIONS
                    </h1>
                    <p className="text-slate-400">Analyze and define team victory conditions</p>
                </div>
            </div>

            <WinConditionManager
                heroes={heroes}
                versions={versions}
                tournaments={tournaments}
            />
        </div>
    )
}
