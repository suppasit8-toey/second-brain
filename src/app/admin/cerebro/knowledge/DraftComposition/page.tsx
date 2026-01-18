import { ChevronLeft, Brain } from 'lucide-react'
import Link from 'next/link'
import { getVersions, getAllTeams } from '../../actions'
import { getTournaments } from '../../../tournaments/actions'
import DraftCompositionClient from './_components/DraftCompositionClient'

export const dynamic = 'force-dynamic';

export default async function DraftCompositionPage() {
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
                            <div className="p-2 bg-pink-500/10 rounded-lg border border-pink-500/20">
                                <Brain className="w-8 h-8 text-pink-400" />
                            </div>
                            Draft Composition
                        </h1>
                        <p className="text-slate-400 text-sm max-w-2xl">
                            Role Priority Analysis and Phase Strategy. Identifies Flex Picks and Winning Compositions.
                        </p>
                    </div>
                </div>

                {/* Client Logic */}
                <DraftCompositionClient versions={versions} teams={teams} tournaments={tournaments} />

            </div>
        </div>
    )
}
