import { ChevronLeft, ShieldBan } from 'lucide-react'
import Link from 'next/link'
import { getVersions, getAllTeams } from '../../actions'
import { getTournaments } from '../../../tournaments/actions'
import BanStrategyClient from './_components/BanStrategyClient'

export const dynamic = 'force-dynamic';

export default async function BanStrategyPage() {
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
                            <div className="p-2 bg-orange-500/10 rounded-lg border border-orange-500/20">
                                <ShieldBan className="w-8 h-8 text-orange-400" />
                            </div>
                            Ban Strategy
                        </h1>
                        <p className="text-slate-400 text-sm max-w-2xl">
                            Analyze opponent ban patterns and identify high-impact Phase 2 ban targets based on their pick history.
                        </p>
                    </div>
                </div>

                {/* Client Logic */}
                <BanStrategyClient versions={versions} teams={teams} tournaments={tournaments} />

            </div>
        </div>
    )
}
