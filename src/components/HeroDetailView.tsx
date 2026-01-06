'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft, Edit, ArrowUpCircle, ArrowDownCircle } from 'lucide-react'
import EditHeroModal from './EditHeroModal'
import HeroMatchupAnalysis from './HeroMatchupAnalysis'

import { Handshake } from 'lucide-react'

export default function HeroDetailView({ hero, matchups = [], combos = [] }: { hero: any, matchups?: any[], combos?: any[] }) {
    const [isEditOpen, setIsEditOpen] = useState(false)
    const [activeTab, setActiveTab] = useState<'matchups' | 'combos'>('matchups')

    // Current stats logic for display
    const currentStats = Array.isArray(hero.hero_stats) ? (hero.hero_stats[0] || {}) : (hero.hero_stats || {})
    const versionId = currentStats.version_id // We might need a better way to get global active version if stats are missing, but for now use what we have or 0

    return (
        <div className="min-h-screen bg-[#090312] text-[#f3e8ff] p-8">
            {/* Back Button */}
            <Link href="/admin/heroes" className="inline-flex items-center gap-2 text-gray-400 hover:text-primary mb-8 transition-colors">
                <ArrowLeft size={20} />
                Back to Roster
            </Link>

            {/* Hero Header Card */}
            <div className="glass-card p-8 flex flex-col md:flex-row items-center gap-8 mb-8 relative group">
                {/* Large Icon */}
                <div className="relative w-32 h-32 rounded-full border-4 border-primary shadow-[0_0_30px_rgba(168,85,247,0.4)] overflow-hidden bg-black/40">
                    {hero.icon_url ? (
                        <Image src={hero.icon_url} alt={hero.name} fill className="object-cover" />
                    ) : (
                        <div className="w-full h-full bg-slate-800 flex items-center justify-center text-4xl font-bold">{hero.name[0]}</div>
                    )}
                </div>

                {/* Info */}
                <div className="text-center md:text-left flex-1">
                    <h1 className="text-4xl font-bold text-white mb-2">{hero.name}</h1>
                    <div className="flex gap-2 justify-center md:justify-start">
                        <span className="px-3 py-1 rounded-full bg-purple-900/50 border border-purple-500/30 text-purple-300 text-sm">
                            {hero.damage_type || 'Physical'}
                        </span>
                        <span className="px-3 py-1 rounded-full bg-blue-900/50 border border-blue-500/30 text-blue-300 text-sm">
                            {hero.main_position ? (Array.isArray(hero.main_position) ? hero.main_position.join(', ') : hero.main_position) : 'Flex'}
                        </span>
                    </div>
                </div>

                {/* Edit Button */}
                <button
                    onClick={() => setIsEditOpen(true)}
                    className="absolute top-8 right-8 p-2 rounded-lg bg-white/5 hover:bg-white/10 text-text-muted hover:text-white transition-colors border border-white/5 hover:border-white/20"
                    title="Edit Hero"
                >
                    <Edit size={20} />
                </button>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass-card p-6 text-center">
                    <h3 className="text-text-muted text-sm uppercase tracking-wider mb-2">Power Spike</h3>
                    <p className="text-2xl font-bold text-primary">{currentStats.power_spike || 'Balanced'}</p>
                </div>
                <div className="glass-card p-6 text-center">
                    <h3 className="text-text-muted text-sm uppercase tracking-wider mb-2">Current Tier</h3>
                    <span className={`text-2xl font-bold px-3 py-1 rounded ${currentStats.tier === 'S' ? 'text-yellow-400 bg-yellow-400/10' :
                        currentStats.tier === 'A' ? 'text-red-400 bg-red-400/10' :
                            currentStats.tier === 'B' ? 'text-blue-400 bg-blue-400/10' :
                                'text-gray-400'
                        }`}>
                        {currentStats.tier || 'Unranked'}
                    </span>
                </div>
                {/* Stats for debugging or future expansion */}
                <div className="glass-card p-6 text-center">
                    <h3 className="text-text-muted text-sm uppercase tracking-wider mb-2">Win Rate</h3>
                    <p className="text-2xl font-bold text-green-400">{currentStats.win_rate || 50}%</p>
                </div>
            </div>

            {/* TABS HEADER */}
            <div className="flex items-center gap-6 border-b border-white/10 mb-8">
                <button
                    onClick={() => setActiveTab('matchups')}
                    className={`pb-4 px-2 text-sm font-bold uppercase tracking-wider transition-colors relative ${activeTab === 'matchups' ? 'text-white' : 'text-text-muted hover:text-white'}`}
                >
                    Matchups
                    {activeTab === 'matchups' && <div className="absolute bottom-0 inset-x-0 h-0.5 bg-primary shadow-[0_0_10px_rgba(168,85,247,0.8)]" />}
                </button>

                <button
                    onClick={() => setActiveTab('combos')}
                    className={`pb-4 px-2 text-sm font-bold uppercase tracking-wider transition-colors relative ${activeTab === 'combos' ? 'text-white' : 'text-text-muted hover:text-white'}`}
                >
                    Combo Duo
                    {activeTab === 'combos' && <div className="absolute bottom-0 inset-x-0 h-0.5 bg-primary shadow-[0_0_10px_rgba(168,85,247,0.8)]" />}
                </button>
            </div>

            {/* TAB CONTENT */}
            <div className="min-h-[300px]">
                {activeTab === 'matchups' ? (
                    <HeroMatchupAnalysis matchups={matchups} heroPositions={
                        Array.isArray(hero.main_position) ? hero.main_position :
                            (typeof hero.main_position === 'string' ? JSON.parse(hero.main_position) : [])
                    } />
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        {combos && combos.length > 0 ? (
                            combos.map(combo => {
                                const isHeroA = combo.hero_a_id === hero.id
                                const partner = isHeroA ? combo.hero_b : combo.hero_a
                                const partnerPos = isHeroA ? combo.hero_b_position : combo.hero_a_position

                                return (
                                    <div key={combo.id} className="glass-card p-4 flex items-center gap-4 group hover:bg-white/5 transition-colors border border-white/5">
                                        <div className="relative w-16 h-16 rounded-full border-2 border-primary/50 overflow-hidden shadow-lg shadow-purple-900/20 shrink-0">
                                            {partner.icon_url ? (
                                                <Image src={partner.icon_url} alt="" fill className="object-cover" />
                                            ) : (
                                                <div className="w-full h-full bg-slate-800" />
                                            )}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h3 className="font-bold text-lg text-white truncate">{partner.name}</h3>
                                                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-primary/20 text-primary border border-primary/20">
                                                    {partnerPos === 'Any' ? 'Any Lane' : partnerPos}
                                                </span>
                                            </div>

                                            {combo.description ? (
                                                <p className="text-sm text-text-muted line-clamp-2">{combo.description}</p>
                                            ) : (
                                                <p className="text-xs text-text-muted italic">Great synergy partner.</p>
                                            )}
                                        </div>

                                        <div className="flex flex-col items-center justify-center pl-4 border-l border-white/10 text-primary">
                                            <Handshake size={20} className="mb-1 opacity-50" />
                                        </div>
                                    </div>
                                )
                            })
                        ) : (
                            <div className="col-span-full py-12 flex flex-col items-center justify-center text-text-muted border border-dashed border-white/10 rounded-xl bg-white/5">
                                <Handshake size={48} className="mb-4 opacity-20" />
                                <p>No combo duos found for this patch.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Render Modal */}
            {isEditOpen && (
                <EditHeroModal
                    hero={hero}
                    versionId={versionId || 0} // If 0, stats helper in action might likely assume "any" or fail, but better than null check crash
                    onClose={() => setIsEditOpen(false)}
                />
            )}
        </div>
    )
}
