import { ChevronLeft, Target } from 'lucide-react'
import Link from 'next/link'
import { getVersions, getAllTeams } from '../../actions'
import { getTournaments } from '../../../tournaments/actions'
import RosterDominanceClient from './_components/RosterDominanceClient'

export const dynamic = 'force-dynamic';

export default async function RosterDominancePage() {
    const versions = await getVersions();
    const teams = await getAllTeams();
    const tournaments = await getTournaments();

    return (
        <div className="min-h-screen bg-[#0B0E14] text-slate-200 p-4 lg:p-8">
            <div className="max-w-7xl mx-auto space-y-6">

                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-slate-400 hover:text-slate-200 transition-colors mb-2">
                            <Link href="/admin/cerebro/knowledge">
                                <span className="flex items-center gap-1 text-sm cursor-pointer">
                                    <ChevronLeft className="w-4 h-4" /> Back to Knowledge Base
                                </span>
                            </Link>
                        </div>
                        <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
                            <div className="p-3 bg-slate-900 rounded-xl border border-white/10 shadow-lg shadow-cyan-900/20">
                                <Target className="w-8 h-8 text-cyan-400" />
                            </div>
                            Roster Dominance Analysis
                        </h1>
                        <p className="text-slate-400 text-sm max-w-2xl">
                            Identify <strong>Signature Picks</strong> and exploit <strong>Enemy Weaknesses</strong> by role.
                        </p>
                    </div>
                </div>

                {/* Client Logic */}
                <RosterDominanceClient versions={versions} teams={teams} tournaments={tournaments} />

            </div>
        </div>
    )
}
