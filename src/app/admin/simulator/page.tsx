import { getVersions } from '../heroes/actions'
import { getMatches } from './actions'
import { getTournaments } from '../tournaments/actions'
import CreateMatchModal from './_components/CreateMatchModal'
import Link from 'next/link'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import MatchList from './_components/MatchList'

export default async function DraftDashboard() {
    const versions = await getVersions()
    const matches = await getMatches()
    const tournaments = await getTournaments()

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">Draft Simulator & Analysis</h1>
                    <p className="text-slate-400 mt-1">Simulate tournament drafts and analyze team strategies.</p>
                </div>
                <CreateMatchModal versions={versions} tournaments={tournaments} />
            </div>

            <div className="grid gap-4">
                <h2 className="text-xl font-semibold text-white">Recent Matches</h2>

                <MatchList matches={matches} />
            </div>
        </div>
    )
}
