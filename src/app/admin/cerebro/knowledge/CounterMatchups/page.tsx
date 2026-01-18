
import { ChevronLeft, Swords } from 'lucide-react'
import Link from 'next/link'
import MatchupManager from '@/components/MatchupManager'
import { getVersions } from '@/app/admin/heroes/actions'

export const dynamic = 'force-dynamic'

export default async function CounterMatchupsPage() {
    const versions = await getVersions()

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
                            <div className="p-3 bg-slate-900 rounded-xl border border-white/10 shadow-lg shadow-red-900/20">
                                <Swords className="w-8 h-8 text-red-500" />
                            </div>
                            Counter Matchups
                        </h1>
                        <p className="text-slate-400 ml-1">
                            Identify heroes with &gt;50% win rate against enemy composition.
                        </p>
                    </div>
                </div>

                {/* Content */}
                <MatchupManager initialVersions={versions} hideAddButton={true} />
            </div>
        </div>
    )
}
