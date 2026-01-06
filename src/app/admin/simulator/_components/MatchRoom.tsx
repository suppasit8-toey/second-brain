'use client'

import { useState } from 'react'
import { DraftMatch, DraftGame, Hero } from '@/utils/types'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import NewGameModal from './NewGameModal'
import DraftInterface from './DraftInterface'
import { Badge } from '@/components/ui/badge'

interface MatchRoomProps {
    match: DraftMatch;
    heroes: Hero[];
}

export default function MatchRoom({ match, heroes }: MatchRoomProps) {
    const games = match.games || []
    const [activeTab, setActiveTab] = useState<string>(games.length > 0 ? games[games.length - 1].id : 'overview')

    const nextGameNumber = games.length + 1

    return (
        <div className="flex flex-col h-[calc(100vh-6rem)]">
            {/* Match Header */}
            <div className="shrink-0 bg-slate-900 border-b border-slate-800 p-4 flex items-center justify-between">
                <div className="flex items-center gap-8">
                    <div className="text-right">
                        <h2 className="text-2xl font-black text-white">{match.team_a_name}</h2>
                        <p className="text-xs text-slate-500 uppercase tracking-wider">Team A</p>
                    </div>

                    <div className="px-6 py-2 bg-slate-800 rounded-lg border border-slate-700 flex flex-col items-center">
                        <span className="text-xs text-slate-500 font-mono mb-1">{match.mode}</span>
                        <div className="text-3xl font-bold font-mono leading-none tracking-widest text-indigo-400">
                            0 - 0
                        </div>
                    </div>

                    <div className="text-left">
                        <h2 className="text-2xl font-black text-white">{match.team_b_name}</h2>
                        <p className="text-xs text-slate-500 uppercase tracking-wider">Team B</p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <Badge variant="outline" className="h-8 px-3 border-indigo-500/30 text-indigo-300 bg-indigo-500/10">
                        Patch {match.version?.name}
                    </Badge>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden flex flex-col">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
                    <div className="shrink-0 px-6 py-2 border-b border-slate-800 bg-slate-900/50 flex items-center gap-2">
                        <TabsList className="bg-slate-800 text-slate-400">
                            {games.map((game) => (
                                <TabsTrigger key={game.id} value={game.id}>
                                    Game {game.game_number}
                                </TabsTrigger>
                            ))}
                        </TabsList>

                        <NewGameModal match={match} nextGameNumber={nextGameNumber} />
                    </div>

                    {games.length === 0 && (
                        <div className="flex-1 flex items-center justify-center p-12">
                            <div className="text-center space-y-4 max-w-md">
                                <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto text-3xl">🎮</div>
                                <h3 className="text-xl font-bold text-white">Ready to Start?</h3>
                                <p className="text-slate-400">The match lobby is set up. Click "Start Game 1" to begin the first draft phase.</p>
                            </div>
                        </div>
                    )}

                    {games.map((game) => (
                        <TabsContent key={game.id} value={game.id} className="flex-1 p-0 m-0 data-[state=active]:flex flex-col">
                            <DraftInterface match={match} game={game} initialHeroes={heroes} />
                        </TabsContent>
                    ))}
                </Tabs>
            </div>
        </div>
    )
}
