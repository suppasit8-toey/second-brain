'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { ChevronLeft, Brain, Users, Trophy } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { getTournaments } from '@/app/admin/tournaments/actions'
import { getTournamentTeamPools, TeamPoolData } from './actions'
import { Tournament } from '@/utils/types'

export default function TeamHeroPoolPage() {
    const [tournaments, setTournaments] = useState<Tournament[]>([])
    const [selectedTournament, setSelectedTournament] = useState<string>('')
    const [poolData, setPoolData] = useState<TeamPoolData[]>([])
    const [isLoading, setIsLoading] = useState(false)

    // Load Tournaments on Mount
    useEffect(() => {
        getTournaments().then(data => {
            setTournaments(data)
            if (data.length > 0) {
                // Default to RPL Summer 2026 if found, otherwise first
                const defaultTourney = data.find(t => t.name.includes('RPL Summer 2026')) || data[0]
                setSelectedTournament(defaultTourney.id)
            }
        })
    }, [])

    // Load Pool Data when Tournament Changes
    useEffect(() => {
        if (!selectedTournament) return

        setIsLoading(true)
        getTournamentTeamPools(selectedTournament).then(({ data, error }) => {
            if (data) {
                setPoolData(data)
            } else {
                console.error(error)
            }
            setIsLoading(false)
        })
    }, [selectedTournament])

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
                            <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
                                <Users className="w-8 h-8 text-blue-400" />
                            </div>
                            Team Hero Pools
                        </h1>
                        <p className="text-slate-400 text-sm max-w-2xl">
                            Analyze comfort picks and strategy preferences for each team in the tournament.
                        </p>
                    </div>

                    {/* Tournament Selector */}
                    <div className="w-full md:w-64">
                        <Select value={selectedTournament} onValueChange={setSelectedTournament}>
                            <SelectTrigger className="bg-slate-900 border-slate-700">
                                <SelectValue placeholder="Select Tournament">
                                    {tournaments.find(t => t.id === selectedTournament)?.name || "Select Tournament"}
                                </SelectValue>
                            </SelectTrigger>
                            <SelectContent className="bg-slate-900 border-slate-700">
                                {tournaments.map(t => (
                                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* Content */}
                {isLoading ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {poolData.map(team => (
                            <TeamPoolCard key={team.teamId} team={team} />
                        ))}

                        {poolData.length === 0 && (
                            <div className="col-span-full text-center py-20 bg-slate-900/50 rounded-xl border border-dashed border-slate-800">
                                <Trophy className="w-12 h-12 text-slate-600 mx-auto mb-4 opacity-50" />
                                <h3 className="text-xl font-bold text-slate-500">No Match Data Found</h3>
                                <p className="text-slate-600 mt-2">Try selecting a different tournament or ensure matches are marked as 'Finished'.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}

function TeamPoolCard({ team }: { team: TeamPoolData }) {
    const roles = ['Dark Slayer', 'Jungle', 'Mid', 'Abyssal', 'Roam']
    const [tab, setTab] = useState('all')

    // Sort pool by picks
    const sortedPool = Object.values(team.pool).sort((a, b) => b.picks - a.picks)
    const topHeroes = sortedPool.slice(0, 5)

    return (
        <Card className="bg-slate-900/50 border-slate-800 flex flex-col overflow-hidden">
            <CardHeader className="pb-3 border-b border-slate-800 bg-slate-950/30">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded bg-slate-800 overflow-hidden relative border border-slate-700">
                            {team.teamLogo ? (
                                <Image src={team.teamLogo} alt={team.teamName} fill className="object-cover" />
                            ) : (
                                <div className="flex items-center justify-center h-full text-xs font-bold text-slate-500">{team.teamName.substring(0, 2)}</div>
                            )}
                        </div>
                        <div>
                            <CardTitle className="text-base font-bold text-white">{team.teamName}</CardTitle>
                            <CardDescription className="text-xs font-mono">
                                {team.totalGames} Games • {(team.totalWins / team.totalGames * 100).toFixed(0)}% WR
                            </CardDescription>
                        </div>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-0 flex-1 flex flex-col min-h-0">
                <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col">
                    <div className="px-4 pt-4">
                        <TabsList className="w-full grid grid-cols-6 bg-slate-950/50 border border-slate-800 p-0.5 h-8">
                            <TabsTrigger value="all" className="text-[10px] px-0 h-full">ALL</TabsTrigger>
                            <TabsTrigger value="Dark Slayer" className="text-[10px] px-0 h-full">DS</TabsTrigger>
                            <TabsTrigger value="Jungle" className="text-[10px] px-0 h-full">JG</TabsTrigger>
                            <TabsTrigger value="Mid" className="text-[10px] px-0 h-full">MID</TabsTrigger>
                            <TabsTrigger value="Abyssal" className="text-[10px] px-0 h-full">AD</TabsTrigger>
                            <TabsTrigger value="Roam" className="text-[10px] px-0 h-full">SP</TabsTrigger>
                        </TabsList>
                    </div>

                    <ScrollArea className="flex-1 h-[300px] p-4">
                        <TabsContent value="all" className="mt-0 space-y-2">
                            {sortedPool.length === 0 ? <div className="text-center text-xs text-slate-600 py-8">No hero data</div> :
                                sortedPool.map(stat => <HeroStatRow key={stat.hero.id} stat={stat} />)
                            }
                        </TabsContent>
                        {roles.map(role => (
                            <TabsContent key={role} value={role} className="mt-0 space-y-2">
                                {sortedPool.filter(s => s.roles.includes(role)).length === 0 ?
                                    <div className="text-center text-xs text-slate-600 py-8">No heroes played in {role}</div> :
                                    sortedPool.filter(s => s.roles.includes(role)).map(stat =>
                                        <HeroStatRow key={stat.hero.id} stat={stat} />
                                    )
                                }
                            </TabsContent>
                        ))}
                    </ScrollArea>
                </Tabs>
            </CardContent>
        </Card>
    )
}

function HeroStatRow({ stat }: { stat: any }) {
    return (
        <div className="flex items-center gap-3 p-2 rounded-lg bg-slate-800/40 border border-slate-800/50 hover:bg-slate-800 transition-colors group">
            <div className="relative w-8 h-8 rounded border border-slate-700 overflow-hidden shrink-0">
                <Image src={stat.hero.icon_url} alt={stat.hero.name} fill className="object-cover" />
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-300 truncate group-hover:text-blue-400 transition-colors">{stat.hero.name}</span>
                    <Badge variant="secondary" className="h-4 text-[10px] bg-slate-900 border-slate-700 text-slate-400">
                        {stat.picks} Picks
                    </Badge>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                    <div className="h-1.5 flex-1 bg-slate-900 rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full ${stat.winRate >= 60 ? 'bg-green-500' : stat.winRate >= 50 ? 'bg-blue-500' : 'bg-slate-500'}`}
                            style={{ width: `${stat.winRate}%` }}
                        />
                    </div>
                    <span className={`text-[10px] font-mono ${stat.winRate >= 50 ? 'text-green-400' : 'text-slate-500'}`}>
                        {stat.winRate.toFixed(0)}% WR
                    </span>
                </div>
            </div>
        </div>
    )
}
