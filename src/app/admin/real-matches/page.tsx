import { getVersions } from '../heroes/actions'
import { getRealMatches } from './actions'
import { getTournaments } from '../tournaments/actions'
import CreateRealMatchModal from './_components/CreateRealMatchModal'
import Link from 'next/link'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import MatchList from '../simulator/_components/MatchList'

export default async function RealMatchesDashboard() {
    const versions = await getVersions()
    const matches = await getRealMatches()
    const tournaments = await getTournaments()

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">Real Match Recorder</h1>
                    <p className="text-slate-400 mt-1">Record and analyze actual match results.</p>
                </div>
                <CreateRealMatchModal versions={versions} tournaments={tournaments} />
            </div>

            <div className="grid gap-4">
                <h2 className="text-xl font-semibold text-white">Match History</h2>

                <MatchList matches={matches} />
            </div>
        </div>
    )
}
