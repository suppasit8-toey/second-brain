'use client'

import { useState, useEffect, useTransition } from 'react'
import { Version, Hero, POSITIONS } from '@/utils/types'
import { getHeroesByVersion } from '@/app/admin/heroes/actions'
import { saveMatchups, getMatchups } from '@/app/admin/matchups/actions'
import { Plus, Search, Shield, Sword, Save, X, Trash2, Filter, AlertCircle, Pencil, ChevronDown, Check, CheckCircle2, Minus } from 'lucide-react'
import Image from 'next/image'

interface MatchupManagerProps {
    initialVersions: Version[];
}

interface MatchupRow {
    id: string;
    // Relations from join
    opponent?: {
        id: string;
        name: string;
        icon_url: string;
    };
    hero_id: string; // My hero
    enemy_hero_id: string;
    enemy_position: string;
    win_rate: number;
    position: string; // My position
}

interface SelectedEnemy {
    id: string;
    name: string;
    icon_url: string;
    winRate: number;
    position: string;
}

export default function MatchupManager({ initialVersions }: MatchupManagerProps) {
    // 1. Filter States
    const [selectedVersionId, setSelectedVersionId] = useState<number>(initialVersions.find(v => v.is_active)?.id || initialVersions[0]?.id || 0)
    const [heroes, setHeroes] = useState<Hero[]>([])
    const [selectedHeroId, setSelectedHeroId] = useState<string>('')
    const [availablePositions, setAvailablePositions] = useState<string[]>([])
    const [selectedPosition, setSelectedPosition] = useState<string>('')
    // New: View Filter for Enemy Position in Matchups List
    const [viewFilter, setViewFilter] = useState('All')

    // New: Visual Hero Dropdown State
    const [isHeroDropdownOpen, setIsHeroDropdownOpen] = useState(false)
    const [heroSearchQuery, setHeroSearchQuery] = useState('')

    // 2. Data States
    const [matchups, setMatchups] = useState<MatchupRow[]>([])
    const [isPending, startTransition] = useTransition()
    const [isLoadingData, setIsLoadingData] = useState(false)

    // 3. Modal States
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [modalEnemyPosition, setModalEnemyPosition] = useState<string>('Roam') // Default
    const [modalSearch, setModalSearch] = useState('')
    const [selectedEnemies, setSelectedEnemies] = useState<SelectedEnemy[]>([])

    // Constants
    const WIN_RATES = Array.from({ length: 19 }, (_, i) => (i + 1) * 5); // [5, 10, ... 95]

    // --- EFFECTS ---

    // A. Fetch Heroes when Version Changes
    useEffect(() => {
        if (!selectedVersionId) return
        startTransition(async () => {
            const data = await getHeroesByVersion(selectedVersionId)
            // Fix type cast if needed
            setHeroes(data as any[])
            // Reset selection to force re-flow
            setSelectedHeroId('')
            setAvailablePositions([])
            setSelectedPosition('')
        })
    }, [selectedVersionId])

    // B. Hero Selection Effect -> Update Postions
    useEffect(() => {
        if (!selectedHeroId) {
            setAvailablePositions([])
            setSelectedPosition('')
            return
        }

        const hero = heroes.find(h => h.id.toString() === selectedHeroId)
        if (hero) {
            // Robust parsing of position data
            let posData = (hero as any).position || hero.main_position || []

            if (typeof posData === 'string') {
                try {
                    if (posData.startsWith('[')) {
                        posData = JSON.parse(posData)
                    } else {
                        posData = [posData]
                    }
                } catch (e) {
                    posData = [posData] // Fallback
                }
            }

            let cleanPositions = Array.isArray(posData) ? posData : [posData]

            // If empty, fallback to ALL POSITIONS
            if (cleanPositions.length === 0) {
                cleanPositions = [...POSITIONS]
            }

            setAvailablePositions(cleanPositions)

            // Auto-select if there's only one position
            if (cleanPositions.length === 1) {
                setSelectedPosition(cleanPositions[0])
            } else {
                setSelectedPosition('')
            }
        }
    }, [selectedHeroId, heroes])

    // C. Fetch Matchups when Context Changes
    useEffect(() => {
        if (!selectedVersionId || !selectedHeroId || !selectedPosition) {
            setMatchups([])
            return
        }

        setIsLoadingData(true)
        startTransition(async () => {
            const data = await getMatchups(selectedVersionId, selectedHeroId, selectedPosition)
            setMatchups(data as any[])
            setIsLoadingData(false)
        })
    }, [selectedVersionId, selectedHeroId, selectedPosition])


    // --- HANDLERS ---

    const handleOpenModal = (initialData?: SelectedEnemy[]) => {
        if (!selectedHeroId) {
            alert("Please select a My Hero first.")
            return
        }

        if (initialData && initialData.length > 0) {
            // Edit Mode: Use active context from first item or default
            setModalEnemyPosition(initialData[0].position || 'Mid')
            setSelectedEnemies(initialData)
        } else {
            // Add Mode: Reset
            setModalEnemyPosition('Mid')
            setSelectedEnemies([])
        }
        setModalSearch('')
        setIsModalOpen(true)
    }

    const handleEdit = (matchup: MatchupRow) => {
        // Construct the SelectedEnemy object from the matchup row
        const editData: SelectedEnemy = {
            id: matchup.enemy_hero_id,
            name: matchup.opponent?.name || 'Unknown',
            icon_url: matchup.opponent?.icon_url || '',
            winRate: matchup.win_rate,
            position: matchup.enemy_position
        }
        // Open modal with this data
        handleOpenModal([editData])
    }

    const toggleEnemySelection = (hero: Hero) => {
        // Prevent selecting self as enemy
        if (hero.id === selectedHeroId) return

        setSelectedEnemies(prev => {
            // Check if this specific Hero + Position combo is already selected
            const exists = prev.find(e => e.id === hero.id && e.position === modalEnemyPosition)

            if (exists) {
                // Remove specific combo
                return prev.filter(e => !(e.id === hero.id && e.position === modalEnemyPosition))
            } else {
                // Check if we have saved data for this specific combo
                const existingMatchup = matchups.find(m =>
                    m.enemy_hero_id === hero.id &&
                    m.enemy_position === modalEnemyPosition
                );

                return [...prev, {
                    id: hero.id,
                    name: hero.name,
                    icon_url: hero.icon_url,
                    winRate: existingMatchup ? existingMatchup.win_rate : 50,
                    position: modalEnemyPosition
                }]
            }
        })
    }

    const updateEnemyWinRate = (id: string, position: string, rate: number) => {
        setSelectedEnemies(prev => prev.map(e => (e.id === id && e.position === position) ? { ...e, winRate: rate } : e))
    }

    const removeSelectedEnemy = (id: string, position: string) => {
        setSelectedEnemies(prev => prev.filter(e => !(e.id === id && e.position === position)))
    }

    const handleSaveMatchups = async () => {
        if (selectedEnemies.length === 0) {
            alert("Please select at least one enemy.")
            return
        }

        // Prepare Payload
        const payload = selectedEnemies.map(e => ({
            enemyId: e.id,
            enemyPosition: e.position,
            winRate: e.winRate
        }))

        // Call Server Action
        const result = await saveMatchups(selectedVersionId, selectedHeroId, selectedPosition, payload)

        if (result.success) {
            setIsModalOpen(false)
            // Refresh list
            const newData = await getMatchups(selectedVersionId, selectedHeroId, selectedPosition)
            setMatchups(newData as any[])
        } else {
            alert("Error: " + result.message)
        }
    }


    // --- RENDER HELPERS ---
    const myHero = heroes.find(h => String(h.id) === String(selectedHeroId))

    // Filter Matchups based on viewFilter
    const filteredMatchups = matchups.filter(m =>
        viewFilter === 'All' ? true : m.enemy_position === viewFilter
    )

    // --- SORTING & FILTERING FOR MODAL ---
    // 1. Filter heroes first (Exclude self, apply Search, apply Position Filter context)
    const baseModalHeroes = heroes.filter(h => {
        // Exclude Self
        if (String(h.id) === String(selectedHeroId)) return false;

        // Search Filter
        if (!h.name.toLowerCase().includes(modalSearch.toLowerCase())) return false;

        // Position Filter (Strict based on User Request)
        if (!modalEnemyPosition) return true;

        let posData = (h as any).position || h.main_position || [];
        let heroPositions: string[] = [];

        if (typeof posData === 'string') {
            try {
                if (posData.startsWith('[')) {
                    heroPositions = JSON.parse(posData);
                } else {
                    heroPositions = [posData];
                }
            } catch {
                heroPositions = [posData];
            }
        } else if (Array.isArray(posData)) {
            heroPositions = posData;
        }

        const targetPos = modalEnemyPosition.toLowerCase() === 'abyssal' ? 'abyssal' : modalEnemyPosition.toLowerCase();

        return heroPositions.some(p => {
            const pLow = p.toLowerCase();
            if (targetPos === 'abyssal') {
                return pLow.includes('abyssal');
            }
            return pLow === targetPos;
        });
    });

    // 2. Split into Pending and Completed
    const completedHeroes: Hero[] = [];
    const pendingHeroes: Hero[] = [];

    baseModalHeroes.forEach(h => {
        // Check if I have a matchup recorded for this hero AT THE CURRENT modalEnemyPosition
        const isCompleted = matchups.some(m =>
            m.enemy_hero_id === h.id &&
            m.enemy_position === modalEnemyPosition
        );

        if (isCompleted) {
            completedHeroes.push(h);
        } else {
            pendingHeroes.push(h);
        }
    });

    // 3. Combine for render (Pending first)
    const displayHeroes = [...pendingHeroes, ...completedHeroes];


    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* 1. TOP TOOLBAR */}
            <div className="glass-card p-4 md:p-6 flex flex-col gap-6 relative overflow-hidden">
                <div className="flex flex-col md:flex-row items-end md:items-center gap-4 z-10">

                    {/* Version Selector */}
                    <div className="w-full md:w-auto">
                        <label className="text-xs font-bold text-text-muted uppercase mb-1 block">Game Version</label>
                        <select
                            value={selectedVersionId}
                            onChange={(e) => setSelectedVersionId(Number(e.target.value))}
                            className="dark-input w-full md:w-48"
                        >
                            {initialVersions.map(v => (
                                <option key={v.id} value={v.id}>{v.name} {v.is_active ? '(Active)' : ''}</option>
                            ))}
                        </select>
                    </div>

                    {/* My Hero Selector */}
                    <div className="min-w-[200px] w-full md:w-64">
                        <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1">
                            My Hero
                        </label>
                        <div className="relative">
                            <select
                                value={selectedHeroId}
                                onChange={(e) => setSelectedHeroId(e.target.value)}
                                className="w-full appearance-none bg-[#1a1b26] border border-white/10 hover:border-purple-500 text-white rounded-lg px-4 py-2.5 pr-8 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all cursor-pointer"
                            >
                                <option value="">-- Select Hero --</option>
                                {heroes.map((hero) => (
                                    <option key={hero.id} value={hero.id} className="bg-[#1a1b26] text-white py-2">
                                        {hero.name}
                                    </option>
                                ))}
                            </select>
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                                <ChevronDown size={16} />
                            </div>
                        </div>
                    </div>

                    {/* My Position Selector */}
                    <div className="w-full md:w-auto">
                        <label className="text-xs font-bold text-text-muted uppercase mb-1 block">My Position</label>
                        <select
                            value={selectedPosition}
                            onChange={(e) => setSelectedPosition(e.target.value)}
                            className="dark-input w-full md:w-40"
                            disabled={!selectedHeroId}
                        >
                            <option value="">-- Select --</option>
                            {availablePositions.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                    </div>

                    <div className="flex-1"></div>

                    {/* Add Button */}
                    <button
                        onClick={() => handleOpenModal()}
                        disabled={!selectedHeroId || !selectedPosition}
                        className={`px-6 py-2.5 rounded-lg flex items-center justify-center gap-2 whitespace-nowrap transition-all font-bold w-full md:w-auto
                            ${(!selectedHeroId || !selectedPosition)
                                ? 'bg-purple-600/50 text-white/50 cursor-not-allowed'
                                : 'glow-button text-white shadow-lg shadow-purple-600/20'
                            }`}
                    >
                        <Plus size={20} /> Add Matchup
                    </button>
                </div>

                <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
            </div>

            {/* 2. MAIN CONTENT AREA (Grid) */}
            <div>
                {/* View Filter Bar */}
                {selectedHeroId && matchups.length > 0 && (
                    <div className="mt-8 flex flex-col md:flex-row md:items-center gap-6 border-b border-white/5 pb-6 animate-in slide-in-from-top-2">
                        <div className="flex items-center gap-4 pr-0 md:pr-6 md:border-r border-white/10 border-b md:border-b-0 pb-4 md:pb-0 w-full md:w-auto">
                            <div className="relative w-12 h-12 rounded-full overflow-hidden border-2 border-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.3)]">
                                {myHero?.icon_url ? (
                                    <Image src={myHero.icon_url} alt={myHero.name} fill className="object-cover" />
                                ) : (
                                    <div className="w-full h-full bg-slate-800" />
                                )}
                            </div>
                            <div>
                                <h3 className="font-bold text-white leading-tight text-lg">{myHero?.name}</h3>
                                <span className="text-xs text-purple-300 font-medium bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                                    {selectedPosition}
                                </span>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2 items-center">
                            <span className="text-xs font-bold text-gray-500 mr-2 uppercase tracking-wider">VS ENEMY:</span>
                            {['All', 'Dark Slayer', 'Jungle', 'Mid', 'Abyssal', 'Roam'].map(pos => (
                                <button
                                    key={pos}
                                    onClick={() => setViewFilter(pos)}
                                    className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all border ${viewFilter === pos
                                        ? 'bg-purple-600 border-purple-500 text-white shadow-[0_0_10px_rgba(147,51,234,0.4)]'
                                        : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white'
                                        }`}
                                >
                                    {pos}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Matchup Grid */}
                {!selectedHeroId ? (
                    <div className="text-center py-20 text-text-muted opacity-50 flex flex-col items-center">
                        <Filter size={48} className="mb-4" />
                        <p>Select a Hero and Position to view matchups.</p>
                    </div>
                ) : isLoadingData ? (
                    <div className="text-center py-20 text-text-muted animate-pulse">Loading data...</div>
                ) : matchups.length === 0 ? (
                    <div className="text-center py-20 bg-surface/30 rounded-xl border border-dashed border-white/5 flex flex-col items-center">
                        <AlertCircle size={48} className="mb-4 text-white/20" />
                        <p className="text-text-muted">No matchups managed specifically for {myHero?.name} ({selectedPosition}) in this version.</p>
                        <button onClick={() => handleOpenModal()} className="mt-4 text-primary hover:underline">Add First Matchup</button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {filteredMatchups.map(m => (
                            <div key={m.id} className="glass-card p-4 flex items-center gap-4 hover:bg-white/5 transition-all group relative overflow-hidden border-l-4"
                                style={{ borderLeftColor: m.win_rate >= 50 ? '#4ade80' : '#f87171' }}>

                                <div className="relative w-12 h-12 rounded-full overflow-hidden border border-white/10 shrink-0">
                                    {m.opponent?.icon_url ? (
                                        <Image src={m.opponent.icon_url} alt={m.opponent.name} fill className="object-cover" />
                                    ) : (
                                        <div className="w-full h-full bg-slate-800" />
                                    )}
                                </div>

                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleEdit(m);
                                    }}
                                    className="absolute top-2 right-2 p-1.5 rounded-full bg-black/40 text-gray-400 opacity-0 group-hover:opacity-100 hover:bg-purple-600 hover:text-white transition-all z-20"
                                    title="Edit Win Rate"
                                >
                                    <Pencil className="w-3.5 h-3.5" />
                                </button>

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between">
                                        <h4 className="font-bold text-white truncate">{m.opponent?.name}</h4>
                                        <span className="text-xs text-text-muted bg-black/30 px-1.5 py-0.5 rounded">{m.enemy_position}</span>
                                    </div>
                                    <div className="flex items-center mt-1 gap-2">
                                        <div className="flex-1 h-1.5 bg-black/50 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full ${m.win_rate >= 50 ? 'bg-green-500' : 'bg-red-500'}`}
                                                style={{ width: `${m.win_rate}%` }}
                                            />
                                        </div>
                                        <span className={`text-xs font-bold ${m.win_rate >= 50 ? 'text-green-400' : 'text-red-400'}`}>{m.win_rate}%</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* 3. MODAL */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="glass-card w-full max-w-4xl max-h-[90vh] flex flex-col outline-none shadow-2xl animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="flex items-center gap-4 p-4 md:p-6 bg-white/5 border-b border-white/10 shrink-0 relative">
                            <div className="relative w-14 h-14 rounded-full overflow-hidden border-2 border-primary/40 shadow-sm shrink-0">
                                {myHero?.icon_url ? (
                                    <Image src={myHero.icon_url} alt={myHero.name} fill className="object-cover" />
                                ) : (
                                    <div className="w-full h-full bg-slate-700 animate-pulse" />
                                )}
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-white leading-tight">
                                    {myHero?.name}
                                </h2>
                                <p className="text-sm font-medium text-primary/80">
                                    Playing as <span className="text-primary font-bold uppercase">{selectedPosition}</span>
                                </p>
                            </div>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="absolute right-6 top-6 text-text-muted hover:text-white p-1 rounded-md hover:bg-white/10 transition-colors"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        {/* Split View */}
                        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                            {/* Left: Hero Selection with Custom Grid */}
                            <div className="w-full md:w-1/2 p-4 md:p-6 border-r-0 md:border-r border-b md:border-b-0 border-white/10 flex flex-col gap-4 overflow-y-auto max-h-[40vh] md:max-h-full">
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-xs font-bold text-text-muted uppercase block mb-1">Enemy Position</label>
                                        <select
                                            value={modalEnemyPosition}
                                            onChange={(e) => setModalEnemyPosition(e.target.value)}
                                            className="dark-input w-full"
                                        >
                                            {POSITIONS.map(p => (
                                                <option key={p} value={p === 'Abyssal Dragon' ? 'Abyssal' : p}>
                                                    {p === 'Abyssal Dragon' ? 'Abyssal' : p}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
                                        <input
                                            type="text"
                                            placeholder="Search enemy..."
                                            value={modalSearch}
                                            onChange={e => setModalSearch(e.target.value)}
                                            className="dark-input pl-9 w-full"
                                        />
                                    </div>
                                </div>

                                {/* SCROLLABLE GRID CONTAINER */}
                                <div className="flex-1 overflow-y-auto min-h-0 pr-2">
                                    <div className="grid grid-cols-6 gap-2">
                                        {displayHeroes.map(h => {
                                            // Check if selected for the CURRENT modal position
                                            const isSelected = selectedEnemies.some(e => e.id === h.id && e.position === modalEnemyPosition);

                                            // Check Completed Status (Database)
                                            const existingMatchup = matchups.find(m =>
                                                m.enemy_hero_id === h.id &&
                                                m.enemy_position === modalEnemyPosition
                                            );
                                            const isCompleted = !!existingMatchup;
                                            const winRate = existingMatchup?.win_rate || 50;

                                            // 3-State Logic
                                            let borderClass = 'border-transparent hover:border-white/20';
                                            let iconColorClass = 'text-white';
                                            let statusIcon = null;

                                            if (isCompleted) {
                                                if (winRate > 50) {
                                                    // WIN
                                                    borderClass = 'border-green-500 opacity-100 shadow-[0_0_10px_rgba(34,197,94,0.3)]';
                                                    iconColorClass = 'text-green-500';
                                                    statusIcon = <Check size={12} className={iconColorClass} strokeWidth={4} />;
                                                } else if (winRate === 50) {
                                                    // DRAW
                                                    borderClass = 'border-white opacity-100 shadow-[0_0_10px_rgba(255,255,255,0.3)]';
                                                    iconColorClass = 'text-white';
                                                    statusIcon = <Minus size={12} className={iconColorClass} strokeWidth={4} />; // Changed to Minus for Draw
                                                } else {
                                                    // LOSE
                                                    borderClass = 'border-red-500 opacity-100 shadow-[0_0_10px_rgba(239,68,68,0.3)]';
                                                    iconColorClass = 'text-red-500';
                                                    statusIcon = <X size={12} className={iconColorClass} strokeWidth={4} />; // Changed to X for Lose
                                                }
                                            }

                                            return (
                                                <button
                                                    key={h.id}
                                                    onClick={() => toggleEnemySelection(h)}
                                                    className={`
                                                        relative aspect-square rounded-md overflow-hidden border-2 transition-all group
                                                        ${isSelected
                                                            ? 'border-primary ring-2 ring-primary/30 z-10'
                                                            : borderClass
                                                        }
                                                    `}
                                                    title={isCompleted ? `${h.name} (${winRate}%)` : h.name}
                                                >
                                                    {h.icon_url ? (
                                                        <Image src={h.icon_url} alt={h.name} fill className="object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full bg-slate-800 flex items-center justify-center text-xs text-white">{h.name[0]}</div>
                                                    )}

                                                    {/* Selection Overlay */}
                                                    {isSelected && (
                                                        <div className="absolute inset-0 bg-primary/40 flex items-center justify-center backdrop-blur-[1px]">
                                                            <div className="w-2.5 h-2.5 bg-white rounded-full shadow-[0_0_10px_white]"></div>
                                                        </div>
                                                    )}

                                                    {/* Completed Checkmark Badge */}
                                                    {isCompleted && !isSelected && (
                                                        <div className="absolute top-0 right-0 p-1 bg-black/60 rounded-bl-md backdrop-blur-[2px] z-20">
                                                            {statusIcon}
                                                        </div>
                                                    )}

                                                    <div className="absolute bottom-0 inset-x-0 p-0.5 text-[9px] font-bold text-center text-white truncate drop-shadow-[0_1.2px_1.2px_rgba(0,0,0,0.8)] z-10">{h.name}</div>
                                                </button>
                                            )
                                        })}

                                        {displayHeroes.length === 0 && (
                                            <div className="col-span-full text-center py-8 text-text-muted text-xs">
                                                No heroes found.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Right: Review & Settings */}
                            <div className="w-full md:w-1/2 p-4 md:p-6 flex flex-col bg-surface/20 max-h-[40vh] md:max-h-full">
                                <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                                    {selectedEnemies.length > 0 ? (
                                        <>Editing <span className="bg-primary px-1.5 rounded text-[10px]">{selectedEnemies.length}</span> Matchups</>
                                    ) : (
                                        "Select Enemies"
                                    )}
                                </h3>

                                <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                                    {selectedEnemies.length === 0 ? (
                                        <div className="text-center py-10 text-text-muted text-sm italic flex flex-col items-center gap-2">
                                            <ArrowUpLeftIcon className="w-6 h-6 rotate-45" />
                                            <p>Select enemies from the grid to add or update matchups.</p>
                                        </div>
                                    ) : (
                                        selectedEnemies.map(enemy => (
                                            <div key={`${enemy.id}-${enemy.position}`} className="bg-white/5 rounded-lg p-3 flex items-center gap-3 animate-in slide-in-from-left-2 duration-200">
                                                <div className="relative w-10 h-10 rounded-full overflow-hidden border border-white/10 shrink-0">
                                                    {enemy.icon_url && <Image src={enemy.icon_url} alt={enemy.name} fill className="object-cover" />
                                                    }
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-medium text-white text-sm truncate">{enemy.name}</div>
                                                    <div className="text-xs text-text-muted">vs <span className="text-primary">{enemy.position}</span></div>
                                                </div>
                                                <div className="flex flex-col items-end gap-1">
                                                    <div className="flex items-center gap-3">
                                                        <button
                                                            onClick={() => {
                                                                const newVal = Math.max(0, enemy.winRate - 5);
                                                                updateEnemyWinRate(enemy.id, enemy.position, newVal);
                                                            }}
                                                            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
                                                            type="button"
                                                        >
                                                            -
                                                        </button>

                                                        <span className={`text-lg font-bold w-12 text-center ${enemy.winRate > 50 ? 'text-green-400' : enemy.winRate < 50 ? 'text-red-400' : 'text-gray-200'}`}>
                                                            {enemy.winRate}%
                                                        </span>

                                                        <button
                                                            onClick={() => {
                                                                const newVal = Math.min(100, enemy.winRate + 5);
                                                                updateEnemyWinRate(enemy.id, enemy.position, newVal);
                                                            }}
                                                            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
                                                            type="button"
                                                        >
                                                            +
                                                        </button>
                                                    </div>
                                                </div>
                                                <button onClick={() => removeSelectedEnemy(enemy.id, enemy.position)} className="text-text-muted hover:text-red-400 p-1"><X size={16} /></button>
                                            </div>
                                        ))
                                    )}
                                </div>

                                <div className="pt-4 border-t border-white/10 mt-4 flex justify-end gap-3">
                                    <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm text-text-muted hover:text-white">Cancel</button>
                                    <button
                                        onClick={handleSaveMatchups}
                                        className="glow-button px-6 py-2 rounded-lg text-sm flex items-center gap-2"
                                    >
                                        <Save size={16} />
                                        {selectedEnemies.some(e => matchups.some(m => m.enemy_hero_id === e.id && m.enemy_position === e.position))
                                            ? "Update Matchups"
                                            : "Save New Matchups"
                                        }
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

function ArrowUpLeftIcon({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M7 17V7h10" />
            <path d="M17 17 7 7" />
        </svg>
    )
}
