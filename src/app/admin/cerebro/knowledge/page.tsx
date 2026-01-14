'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
    Brain,
    Database,
    Globe,
    Users,
    Swords,
    Link as LinkIcon,
    ShieldBan,
    Target,
    History,
    Save,
    Info,
    ChevronLeft
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface DataLayer {
    id: string;
    title: string;
    description: string;
    icon: any;
    color: string;
    isActive: boolean;
}

export default function CerebroKnowledgeBase() {
    const router = useRouter()

    // Default State - In the future, load from localStorage/DB
    const [layers, setLayers] = useState<DataLayer[]>([
        {
            id: 'team_pool',
            title: 'Team Hero Pool',
            description: 'Analyzes historical pick rates and win rates for the specific team to identify comfort picks.',
            icon: Users,
            color: 'text-blue-400',
            isActive: true
        },
        {
            id: 'meta_analysis',
            title: 'Meta Analysis',
            description: 'Evaluates global and tournament-specific pick/ban rates to prioritize high-value meta heroes.',
            icon: Globe,
            color: 'text-purple-400',
            isActive: true
        },
        {
            id: 'matchups',
            title: 'Counter Matchups',
            description: 'Identifies heroes with >50% win rate against the enemy composition (Lane & Global).',
            icon: Swords,
            color: 'text-red-400',
            isActive: true
        },
        {
            id: 'synergies',
            title: 'Hero Synergies',
            description: 'Suggests heroes that form strong registered combos with current ally picks.',
            icon: LinkIcon,
            color: 'text-emerald-400',
            isActive: true
        },
        {
            id: 'roster_dominance',
            title: 'Roster Dominance',
            description: 'Prioritizes heroes that specific players on the roster are famous for (Signature Picks).',
            icon: Target,
            color: 'text-cyan-400',
            isActive: true
        },
        {
            id: 'ban_strategy',
            title: 'Ban Strategy',
            description: 'Detects enemy key players and One-Trick-Ponies to suggest targeted bans.',
            icon: ShieldBan,
            color: 'text-orange-400',
            isActive: true
        },
        {
            id: 'draft_logic',
            title: 'Draft Composition',
            description: 'Ensures a balanced team with all 5 roles (DS, JG, Mid, Abyssal, roam) filled.',
            icon: Brain,
            color: 'text-pink-400',
            isActive: true
        },
        {
            id: 'recent_history',
            title: 'Recent Trend',
            description: 'Considers performance in the last 10 matches to catch shifting trends.',
            icon: History,
            color: 'text-yellow-400',
            isActive: true
        },
    ])

    const toggleLayer = (id: string) => {
        setLayers(prev => prev.map(l => l.id === id ? { ...l, isActive: !l.isActive } : l))
    }

    const handleSave = () => {
        // Save to localStorage for simulator to read
        const activeIds = layers.filter(l => l.isActive).map(l => l.id)
        localStorage.setItem('cerebro_active_layers', JSON.stringify(activeIds))
        alert('Cerebro Logic Configuration Saved!')
    }

    // Load on mount
    useEffect(() => {
        const saved = localStorage.getItem('cerebro_active_layers')
        if (saved) {
            try {
                const activeIds = JSON.parse(saved)
                setLayers(prev => prev.map(l => ({ ...l, isActive: activeIds.includes(l.id) })))
            } catch (e) {
                console.error("Failed to load settings", e)
            }
        }
    }, [])

    return (
        <div className="min-h-screen bg-[#0B0E14] text-slate-200 p-4 lg:p-8">
            <div className="max-w-6xl mx-auto space-y-6">

                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-slate-400 hover:text-slate-200 transition-colors mb-2">
                            <Link href="/admin/cerebro">
                                <span className="flex items-center gap-1 text-sm cursor-pointer">
                                    <ChevronLeft className="w-4 h-4" /> Back to Dashboard
                                </span>
                            </Link>
                        </div>
                        <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
                            <div className="p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
                                <Brain className="w-8 h-8 text-indigo-400" />
                            </div>
                            Cerebro Knowledge Base
                        </h1>
                        <p className="text-slate-400 text-lg max-w-2xl">
                            Configure the logical layers that power the Draft Simulator AI. Disable layers to simplify the bot for specific testing scenarios.
                        </p>
                    </div>
                    <Button onClick={handleSave} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold gap-2">
                        <Save className="w-4 h-4" />
                        Save Configuration
                    </Button>
                </div>

                {/* Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {layers.map(layer => {
                        const Icon = layer.icon
                        return (
                            <div
                                key={layer.id}
                                onClick={() => layer.id === 'team_pool' ? router.push('/admin/cerebro/knowledge/TeamHeroPool') : toggleLayer(layer.id)}
                                className={`
                                    relative p-5 rounded-xl border cursor-pointer transition-all duration-200 group
                                    ${layer.isActive
                                        ? 'bg-slate-800/60 border-indigo-500/30 hover:bg-slate-800 hover:border-indigo-500/50'
                                        : 'bg-slate-900/40 border-slate-800 grayscale opacity-60 hover:opacity-100 hover:grayscale-0'
                                    }
                                `}
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <div className={`p-2 rounded-lg ${layer.isActive ? 'bg-slate-900 shadow-inner' : 'bg-slate-800'}`}>
                                        <Icon className={`w-6 h-6 ${layer.color}`} />
                                    </div>
                                    <div className={`
                                        w-10 h-5 rounded-full p-1 transition-colors relative
                                        ${layer.isActive ? 'bg-indigo-500' : 'bg-slate-700'}
                                    `}>
                                        <div className={`
                                            w-3 h-3 rounded-full bg-white shadow-sm transition-transform duration-200
                                            ${layer.isActive ? 'translate-x-5' : 'translate-x-0'}
                                        `} />
                                    </div>
                                </div>

                                <h3 className={`font-bold text-lg mb-2 ${layer.isActive ? 'text-white' : 'text-slate-400'}`}>
                                    {layer.title}
                                </h3>
                                <p className="text-sm text-slate-400 leading-relaxed">
                                    {layer.description}
                                </p>

                                {layer.isActive && (
                                    <div className="absolute inset-0 rounded-xl ring-1 ring-inset ring-indigo-500/20 pointer-events-none" />
                                )}
                            </div>
                        )
                    })}
                </div>

                {/* Note */}
                <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4 flex items-start gap-3">
                    <Info className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                    <div className="text-sm text-slate-400">
                        <strong className="text-slate-200 block mb-1">How Logic Blending Works</strong>
                        Cerebro calculates a weighted score for every hero based on all active layers.
                        Disabling a layer sets its weight to zero. For "Bot vs Human" matches, these settings determine the Bot's personality.
                        For example, disabling valid <b>Meta Analysis</b> might make the bot pick weird off-meta heroes that theoretically counter your picks.
                    </div>
                </div>

            </div>
        </div>
    )
}
