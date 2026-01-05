'use client'

import { useState, useMemo } from 'react'
import { Hero, Matchup } from '@/utils/types'
import { Plus, X, Sword, Shield, Zap, Search } from 'lucide-react'

interface DraftAnalysisProps {
    heroes: Hero[]
    matchups: Matchup[]
}

export default function DraftAnalysis({ heroes, matchups }: DraftAnalysisProps) {
    const [enemyTeam, setEnemyTeam] = useState<(Hero | null)[]>([null, null, null, null, null])

    // Calculate Suggestions (Logic unchanged, only UI)
    const suggestions = useMemo(() => {
        const selectedEnemies = enemyTeam.filter((h): h is Hero => h !== null)
        if (selectedEnemies.length === 0) return []

        const stats: Record<string, { totalWinRate: number; count: number; hero: Hero }> = {}

        heroes.forEach(h => {
            if (selectedEnemies.find(e => e.id === h.id)) return;
            stats[h.id] = { totalWinRate: 0, count: 0, hero: h }
        })

        selectedEnemies.forEach(enemy => {
            const relevantMatchups = matchups.filter(m => m.opponent_id === enemy.id)
            relevantMatchups.forEach(m => {
                if (stats[m.hero_id]) {
                    stats[m.hero_id].totalWinRate += m.win_rate
                    stats[m.hero_id].count += 1
                }
            })
        })

        const results = Object.values(stats)
            .map(s => ({
                hero: s.hero,
                avgWinRate: s.count > 0 ? s.totalWinRate / s.count : 50,
                matchupCount: s.count
            }))
            .sort((a, b) => b.avgWinRate - a.avgWinRate)
            .slice(0, 5)

        return results
    }, [enemyTeam, heroes, matchups])

    const handleSelectEnemy = (index: number, heroId: string) => {
        const hero = heroes.find(h => h.id === heroId) || null
        const newTeam = [...enemyTeam]
        newTeam[index] = hero
        setEnemyTeam(newTeam)
    }

    const handleRemoveEnemy = (index: number) => {
        const newTeam = [...enemyTeam]
        newTeam[index] = null
        setEnemyTeam(newTeam)
    }

    return (
        <div className="flex flex-col lg:flex-row gap-8 min-h-[600px]">
            {/* Left Panel: Enemy Team Selection */}
            <div className="lg:w-1/2 flex flex-col gap-6">
                <div className="glass-card p-6 h-full relative overflow-hidden">
                    {/* Background Decor */}
                    <div className="absolute top-0 right-0 w-96 h-96 bg-red-600/5 rounded-full blur-[120px] pointer-events-none"></div>

                    <h2 className="text-xl font-bold text-red-500 mb-6 flex items-center gap-3 drop-shadow-[0_0_10px_rgba(239,68,68,0.4)]">
                        <span className="bg-red-500/10 p-2 rounded-lg border border-red-500/20"><Sword size={24} /></span>
                        Enemy Lineup
                    </h2>
                    <div className="space-y-4 relative z-10">
                        {enemyTeam.map((slot, index) => (
                            <div key={index} className={`flex items-center gap-4 p-3 rounded-xl border transition-all duration-300 group ${slot ? 'bg-surface/50 border-red-500/30 hover:bg-surface hover:border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.1)]' : 'bg-black/20 border-white/5 hover:border-white/10'}`}>
                                {slot ? (
                                    <>
                                        <div className="relative">
                                            <img src={slot.icon_url} alt={slot.name} className="w-14 h-14 rounded-full border-2 border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.4)]" />
                                            <div className="absolute -bottom-1 -right-1 bg-black/80 text-[10px] text-red-400 px-1.5 rounded border border-red-500/30">ENM</div>
                                        </div>
                                        <div className="flex-1">
                                            <h4 className="font-bold text-lg text-white group-hover:text-red-400 transition-colors">{slot.name}</h4>
                                            <p className="text-xs text-text-muted">{slot.damage_type}</p>
                                        </div>
                                        <button
                                            onClick={() => handleRemoveEnemy(index)}
                                            className="p-2 text-text-muted hover:text-red-500 rounded-full hover:bg-white/5 transition"
                                        >
                                            <X size={20} />
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center text-white/20 border border-white/5 group-hover:border-white/10 group-hover:text-white/40 transition-all">
                                            <span className="text-lg font-bold font-mono">0{index + 1}</span>
                                        </div>
                                        <div className="flex-1 relative group-hover:pl-2 transition-all">
                                            <select
                                                className="w-full bg-transparent border-none text-text-muted focus:ring-0 cursor-pointer appearance-none font-medium hover:text-white transition-colors"
                                                onChange={(e) => handleSelectEnemy(index, e.target.value)}
                                                value=""
                                            >
                                                <option value="" disabled className="bg-background text-text-muted">Select Enemy Hero...</option>
                                                {heroes.map(h => (
                                                    <option key={h.id} value={h.id} className="bg-background text-white">{h.name}</option>
                                                ))}
                                            </select>
                                            <Plus size={16} className="absolute right-0 top-1/2 -translate-y-1/2 text-white/20 pointer-events-none group-hover:text-white/50" />
                                        </div>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Right Panel: Suggestions */}
            <div className="lg:w-1/2">
                <div className="glass-card p-0 overflow-hidden h-full flex flex-col border-primary/20 shadow-[0_0_30px_rgba(0,0,0,0.5)]">
                    <div className="p-6 border-b border-white/10 bg-surface-highlight/30 relative overflow-hidden">
                        <div className="absolute inset-0 bg-primary/5"></div>
                        <div className="relative z-10">
                            <h2 className="text-2xl font-bold flex items-center gap-3 text-white drop-shadow-[0_0_10px_rgba(168,85,247,0.5)]">
                                <Shield size={28} className="text-primary fill-primary/20" />
                                Analysis Result
                            </h2>
                            <p className="text-text-muted text-sm mt-1 ml-10">
                                Top counters based on aggregate win-rates.
                            </p>
                        </div>
                    </div>

                    <div className="p-6 space-y-4 flex-1 overflow-y-auto custom-scrollbar">
                        {suggestions.length > 0 ? (
                            suggestions.map((item, idx) => (
                                <div key={item.hero.id} className="group relative overflow-hidden bg-white/5 hover:bg-primary/10 rounded-xl p-4 transition-all duration-300 border border-white/5 hover:border-primary/50 hover:shadow-[0_0_20px_rgba(168,85,247,0.15)] transform hover:-translate-y-1">
                                    <div className="flex items-center gap-4 relative z-10">
                                        <div className="text-4xl font-black text-white/5 group-hover:text-primary/20 w-12 transition-colors italic">#{idx + 1}</div>

                                        <div className="relative">
                                            <img src={item.hero.icon_url} alt={item.hero.name} className="w-16 h-16 rounded-xl border-2 border-primary/30 group-hover:border-primary shadow-lg transition-colors" />
                                            <div className="absolute -bottom-2 -right-2 bg-primary text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity">PICK</div>
                                        </div>

                                        <div className="flex-1">
                                            <h3 className="text-xl font-bold text-white group-hover:text-primary transition-colors">{item.hero.name}</h3>
                                            <div className="flex gap-2 mt-1">
                                                {item.hero.main_position.map(p => (
                                                    <span key={p} className="text-[10px] bg-white/5 group-hover:bg-primary/20 px-2 py-0.5 rounded text-text-muted group-hover:text-white transition-colors border border-white/5">{p}</span>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-br from-green-400 to-emerald-600 drop-shadow-[0_0_5px_rgba(52,211,153,0.5)]">
                                                {Math.round(item.avgWinRate)}%
                                            </div>
                                            <div className="text-[10px] text-text-muted uppercase tracking-wider">Win Chance</div>
                                        </div>
                                    </div>
                                    {/* Hover Glow */}
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full blur-[50px] -mr-16 -mt-16 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                                </div>
                            ))
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-text-muted/30 py-12">
                                <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center mb-6 animate-pulse">
                                    <Zap size={48} className="opacity-50" />
                                </div>
                                <p className="text-lg font-medium">Awaiting Enemy Team...</p>
                                <p className="text-sm">Select heroes on the left to begin analysis.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
