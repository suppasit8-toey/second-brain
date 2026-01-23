
import { notFound } from 'next/navigation'
import { getWinCondition, analyzeWinCondition, updateWinConditionResult } from '../actions'
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getAllHeroes } from '@/app/admin/heroes/actions'
import { getVersions } from '@/app/admin/versions/actions'
import { getTournaments } from '@/app/admin/tournaments/actions'
import { WinConditionHeader } from '../_components/WinConditionHeader'

export const dynamic = 'force-dynamic'

export default async function WinConditionDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params

    const condition = await getWinCondition(id)

    if (!condition) {
        notFound()
    }

    // Fetch necessary data for Header/Edit
    const versionsData = await getVersions()
    const versions = versionsData?.map((v: any) => v.name) || []

    const tournamentsData = await getTournaments()
    // Type check for tournaments
    const tournaments = tournamentsData?.map((t: any) => ({ id: t.id, name: t.name })) || []

    // Fetch heroes for the condition's version, or fallback to active/latest
    // We use getAllHeroes to ensure we have images for everyone, even if stats are missing for a specific version.
    const rawHeroes = await getAllHeroes()
    const heroes = rawHeroes.map((h: any) => ({
        ...h,
        image_url: h.icon_url, // Map DB column to UI prop
        roles: h.main_position // Map DB column to UI prop for filtering
    }))

    // Run Fresh Analysis
    const analysis = await analyzeWinCondition({
        version: condition.version,
        patch: "",
        tournamentId: condition.tournamentId,
        allyConditions: condition.allyConditions,
        enemyConditions: condition.enemyConditions
    })

    const result = analysis.success ? {
        winRate: analysis.winRate || 0,
        totalMatches: analysis.totalMatches || 0,
        winCount: analysis.winCount || 0,
        lossCount: analysis.lossCount || 0,
        teamStats: analysis.teamStats,
        matches: analysis.matches || []
    } : null

    // Persist the fresh result to the database so the main list shows it
    if (result) {
        await updateWinConditionResult(condition.id, result)
    }

    if (!result) {
        return <div className="p-8 text-center">Analysis Failed</div>
    }

    return (
        <div className="p-6 space-y-6 pb-24 max-w-7xl mx-auto">
            <Link href="/admin/win-conditions" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-4">
                <ArrowLeft className="w-4 h-4" />
                Back to Conditions
            </Link>

            <WinConditionHeader
                condition={condition}
                heroes={heroes}
                versions={versions}
                tournaments={tournaments}
            />

            {/* Analysis Dashboard */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 text-center">
                    <div className="text-slate-500 text-sm uppercase font-bold tracking-wider mb-2">Win Rate</div>
                    <div className={cn(
                        "text-5xl font-black",
                        result.winRate > 50 ? "text-emerald-400" : "text-rose-400"
                    )}>
                        {result.winRate}%
                    </div>
                </div>
                <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 text-center">
                    <div className="text-slate-500 text-sm uppercase font-bold tracking-wider mb-2">Total Matches</div>
                    <div className="text-5xl font-black text-slate-200">
                        {result.totalMatches}
                    </div>
                </div>
                <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 text-center">
                    <div className="text-slate-500 text-sm uppercase font-bold tracking-wider mb-2">Record</div>
                    <div className="text-5xl font-black text-slate-200">
                        <span className="text-emerald-400">{result.winCount}</span>
                        <span className="text-slate-600 mx-2">-</span>
                        <span className="text-rose-400">{result.lossCount}</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-4">
                {/* Teams Breakdown */}
                <div className="flex flex-col h-[600px] overflow-hidden bg-slate-900/40 rounded-2xl border border-slate-800">
                    <div className="p-4 bg-slate-900/60 border-b border-slate-800 font-bold text-lg text-slate-300 flex items-center justify-between">
                        <span>Team Performance</span>
                    </div>
                    <ScrollArea className="flex-1 p-0">
                        <div className="divide-y divide-slate-800/50">
                            {result.teamStats?.map((stat: any, idx: number) => (
                                <div key={idx} className="p-4 flex items-center justify-between hover:bg-slate-800/30 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="font-bold text-slate-200">{stat.name}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className={cn(
                                            "font-black text-lg",
                                            stat.winRate > 50 ? "text-emerald-400" : "text-rose-400"
                                        )}>
                                            {stat.winRate.toFixed(1)}%
                                        </div>
                                        <div className="text-xs text-slate-500 font-mono">
                                            {stat.wins}W - {stat.matches - stat.wins}L
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {(!result.teamStats || result.teamStats.length === 0) && (
                                <div className="p-12 text-center text-slate-500">No team stats available</div>
                            )}
                        </div>
                    </ScrollArea>
                </div>

                {/* Recent Matches */}
                <div className="flex flex-col h-[600px] overflow-hidden bg-slate-900/40 rounded-2xl border border-slate-800">
                    <div className="p-4 bg-slate-900/60 border-b border-slate-800 font-bold text-lg text-slate-300">
                        Match History
                    </div>
                    <ScrollArea className="flex-1 p-0">
                        <div className="divide-y divide-slate-800/50">
                            {result.matches?.map((match: any, idx: number) => (
                                <Link
                                    key={idx}
                                    href={`/admin/simulator/${match.matchId}`}
                                    className="block hover:bg-slate-800/30 transition-colors group relative"
                                >
                                    <div className="p-4">
                                        <div className="flex justify-between items-center mb-2">
                                            <div className="text-xs text-slate-500 font-mono">
                                                {new Date(match.date).toLocaleDateString()}
                                            </div>
                                            <div className={cn(
                                                "text-xs font-bold px-2 py-1 rounded text-center min-w-[60px]",
                                                match.result === 'WIN' ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                                            )}>
                                                {match.result}
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between text-base">
                                            <div className="font-bold text-slate-200 w-[45%] truncate text-right">{match.team}</div>
                                            <div className="text-slate-600 px-2 font-mono text-xs">VS</div>
                                            <div className="font-medium text-slate-400 w-[45%] truncate">{match.enemy}</div>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                            {(!result.matches || result.matches.length === 0) && (
                                <div className="p-12 text-center text-slate-500">No matches found</div>
                            )}
                        </div>
                    </ScrollArea>
                </div>
            </div>
        </div>
    )
}
