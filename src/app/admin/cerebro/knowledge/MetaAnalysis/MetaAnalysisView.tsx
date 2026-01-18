'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tournament } from '@/utils/types'
import { getTournamentMeta } from '../../actions'
import Image from 'next/image'
import { Badge } from '@/components/ui/badge'

interface MetaAnalysisViewProps {
    tournaments: Tournament[]
}

export default function MetaAnalysisView({ tournaments }: MetaAnalysisViewProps) {
    const [selectedTournament, setSelectedTournament] = useState<string>('')
    const [stats, setStats] = useState<any>(null)
    const [loading, setLoading] = useState(false)
    const [activeTab, setActiveTab] = useState<string>('simulator')

    useEffect(() => {
        if (!selectedTournament) return

        async function fetchStats() {
            setLoading(true)
            const data = await getTournamentMeta(selectedTournament)
            setStats(data)
            setLoading(false)
        }

        fetchStats()
    }, [selectedTournament])

    const renderHeroTable = (heroStats: any, totalGames: number, showBans: boolean) => {
        const sortedHeroes = heroStats
            ? Object.values(heroStats).sort((a: any, b: any) => b.picks - a.picks)
            : []

        if (sortedHeroes.length === 0) {
            return (
                <div className="text-center p-8 text-slate-500">
                    No data available for this mode.
                </div>
            )
        }

        return (
            <div className="border border-slate-800 rounded-md overflow-hidden bg-slate-900/50">
                <Table>
                    <TableHeader className="bg-slate-900">
                        <TableRow className="border-slate-800 hover:bg-slate-900">
                            <TableHead className="w-[300px] text-slate-400">Hero</TableHead>
                            <TableHead className="text-center text-slate-400">Pick</TableHead>
                            {showBans && <TableHead className="text-center text-slate-400">Ban</TableHead>}
                            <TableHead className="text-center text-slate-400">Win Rate</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {sortedHeroes.map((hero: any) => {
                            const pickRate = totalGames > 0 ? ((hero.picks / totalGames) * 100).toFixed(1) : '0.0'
                            const banRate = totalGames > 0 ? ((hero.bans / totalGames) * 100).toFixed(1) : '0.0'
                            const winRate = hero.picks > 0 ? ((hero.wins / hero.picks) * 100).toFixed(1) : '0.0'

                            return (
                                <TableRow key={hero.id} className="border-slate-800 hover:bg-slate-800/50">
                                    <TableCell className="font-medium">
                                        <div className="flex items-center gap-3">
                                            <div className="relative w-8 h-8 rounded overflow-hidden border border-slate-700">
                                                <Image
                                                    src={hero.icon}
                                                    alt={hero.name}
                                                    fill
                                                    className="object-cover"
                                                />
                                            </div>
                                            <span className="text-slate-200">{hero.name}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <div className="flex flex-col">
                                            <span className="text-blue-400 font-bold">{pickRate}%</span>
                                            <span className="text-slate-500 text-xs">{hero.picks} games</span>
                                        </div>
                                    </TableCell>
                                    {showBans && (
                                        <TableCell className="text-center">
                                            <div className="flex flex-col">
                                                <span className="text-red-400 font-bold">{banRate}%</span>
                                                <span className="text-slate-500 text-xs">{hero.bans} games</span>
                                            </div>
                                        </TableCell>
                                    )}
                                    <TableCell className="text-center">
                                        <div className="flex flex-col">
                                            <span className={`font-bold ${parseFloat(winRate) >= 50 ? 'text-green-400' : 'text-orange-400'}`}>
                                                {winRate}%
                                            </span>
                                            <span className="text-slate-500 text-xs">{hero.wins} wins</span>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )
                        })}
                    </TableBody>
                </Table>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-600 bg-clip-text text-transparent">
                        Meta Analysis
                    </h1>
                    {stats && stats.versions && stats.versions.length > 0 && (
                        <div className="flex items-center gap-2 mt-2">
                            <span className="text-slate-400 text-sm">Version:</span>
                            {stats.versions.map((v: string) => (
                                <Badge key={v} variant="secondary" className="bg-slate-800 text-slate-200">
                                    {v}
                                </Badge>
                            ))}
                        </div>
                    )}
                </div>
                <div className="w-[300px]">
                    <Select value={selectedTournament} onValueChange={setSelectedTournament}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select Tournament" />
                        </SelectTrigger>
                        <SelectContent>
                            {tournaments.map((t) => (
                                <SelectItem key={t.id} value={t.id}>
                                    {t.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {!selectedTournament && (
                <Card className="bg-slate-900 border-slate-800">
                    <CardContent className="flex flex-col items-center justify-center h-[400px] text-slate-400">
                        <p className="text-xl">Please select a tournament to view analysis</p>
                    </CardContent>
                </Card>
            )}

            {loading && (
                <div className="flex justify-center p-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                </div>
            )}

            {!loading && stats && (
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="bg-slate-900 border border-slate-800">
                        <TabsTrigger value="simulator">Full Draft Simulator</TabsTrigger>
                        <TabsTrigger value="quick">Quick Result Entry</TabsTrigger>
                    </TabsList>

                    <TabsContent value="simulator" className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Card className="bg-slate-900 border-slate-800">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium text-slate-400">Total Games</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">{stats.simulator?.totalGames || 0}</div>
                                </CardContent>
                            </Card>
                        </div>
                        {renderHeroTable(stats.simulator?.heroes, stats.simulator?.totalGames || 0, true)}
                    </TabsContent>

                    <TabsContent value="quick" className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Card className="bg-slate-900 border-slate-800">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium text-slate-400">Total Games</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">{stats.quickEntry?.totalGames || 0}</div>
                                </CardContent>
                            </Card>
                        </div>
                        {renderHeroTable(stats.quickEntry?.heroes, stats.quickEntry?.totalGames || 0, false)}
                    </TabsContent>
                </Tabs>
            )}
        </div>
    )
}
