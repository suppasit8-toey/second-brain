'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft, Edit, ArrowUpCircle, ArrowDownCircle } from 'lucide-react'
import EditHeroModal from './EditHeroModal'
import HeroMatchupAnalysis from './HeroMatchupAnalysis'

export default function HeroDetailView({ hero, matchups = [] }: { hero: any, matchups?: any[] }) {
    const [isEditOpen, setIsEditOpen] = useState(false)

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

            {/* Matchup Analysis */}
            <HeroMatchupAnalysis matchups={matchups} heroPositions={
                Array.isArray(hero.main_position) ? hero.main_position :
                    (typeof hero.main_position === 'string' ? JSON.parse(hero.main_position) : [])
            } />

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
