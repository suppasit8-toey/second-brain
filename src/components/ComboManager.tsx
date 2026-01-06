'use client'

import { useState, useEffect, useTransition } from 'react'
import { Version, Hero, POSITIONS, HeroCombo } from '@/utils/types'
import { getHeroesByVersion } from '@/app/admin/heroes/actions'
import { getCombos, saveCombo, deleteCombo, updateCombo } from '@/app/admin/combos/actions'
import { Plus, Search, Save, X, Trash2, Link as LinkIcon, Handshake, RefreshCw, AlertCircle, Check, Minus, Edit2, Sliders } from 'lucide-react'
import Image from 'next/image'

interface ComboManagerProps {
    initialVersions: Version[];
}

export default function ComboManager({ initialVersions }: ComboManagerProps) {
    // 1. Data States
    const [selectedVersionId, setSelectedVersionId] = useState<number>(initialVersions.find(v => v.is_active)?.id || initialVersions[0]?.id || 0)
    const [heroes, setHeroes] = useState<Hero[]>([])
    const [combos, setCombos] = useState<HeroCombo[]>([])
    const [isPending, startTransition] = useTransition()
    const [isLoading, setIsLoading] = useState(false)

    // 2. Modal & Selection States
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [heroA, setHeroA] = useState<Hero | null>(null)
    const [heroB, setHeroB] = useState<Hero | null>(null)
    const [positionA, setPositionA] = useState<string>('')
    const [positionB, setPositionB] = useState<string>('')
    const [editingComboId, setEditingComboId] = useState<string | null>(null)
    const [ignorePosition, setIgnorePosition] = useState(false)

    // 3. Form States
    const [description, setDescription] = useState<string>('')

    // 4. Filter States for Grids
    const [searchA, setSearchA] = useState('')
    const [searchB, setSearchB] = useState('')
    const [filterPosA, setFilterPosA] = useState<string>('All')
    const [filterPosB, setFilterPosB] = useState<string>('All')

    // --- EFFECTS ---

    // Fetch Data on Version Change
    useEffect(() => {
        if (!selectedVersionId) return

        setIsLoading(true)
        startTransition(async () => {
            const [fetchedHeroes, fetchedCombos] = await Promise.all([
                getHeroesByVersion(selectedVersionId),
                getCombos(selectedVersionId)
            ])
            setHeroes(fetchedHeroes as any[])
            setCombos(fetchedCombos)
            setIsLoading(false)
            resetForm()
        })
    }, [selectedVersionId])


    // --- HELPERS ---

    const resetForm = () => {
        setHeroA(null)
        setHeroB(null)
        setPositionA('')
        setPositionB('')
        setDescription('')
        setSearchA('')
        setSearchB('')
        setSearchA('')
        setSearchB('')
        setEditingComboId(null)
        setIgnorePosition(false)
    }

    const openModal = () => {
        resetForm()
        setIsModalOpen(true)
    }

    const handleEdit = (combo: HeroCombo) => {
        resetForm()
        setHeroA(combo.hero_a || null)
        setHeroB(combo.hero_b || null)

        const isAny = combo.hero_a_position === 'Any' && combo.hero_b_position === 'Any'
        setIgnorePosition(isAny)

        if (!isAny) {
            setPositionA(combo.hero_a_position)
            setPositionB(combo.hero_b_position)
        }

        setDescription(combo.description || '')
        setEditingComboId(combo.id)
        setIsModalOpen(true)
    }

    const getFilteredHeroes = (search: string, posFilter: string, excludeHeroId?: string) => {
        return heroes.filter(h => {
            // Exclude other selected hero to prevent self-pairing
            if (excludeHeroId && h.id === excludeHeroId) return false

            const matchesSearch = h.name.toLowerCase().includes(search.toLowerCase())

            let matchesPos = true
            if (posFilter !== 'All') {
                let posData = (h as any).position || h.main_position || []
                // Normalize to array
                if (typeof posData === 'string') {
                    try { posData = JSON.parse(posData) } catch { posData = [posData] }
                }
                if (!Array.isArray(posData)) posData = [posData]

                const target = posFilter === 'Abyssal Dragon' ? 'Abyssal' : posFilter
                matchesPos = posData.some((p: string) => p.includes(target) || p === posFilter)
            }

            return matchesSearch && matchesPos
        })
    }

    const getHeroPositions = (hero: Hero | null): string[] => {
        if (!hero) return []
        let posData = (hero as any).position || hero.main_position || []
        if (typeof posData === 'string') {
            try { posData = JSON.parse(posData) } catch { posData = [posData] }
        }
        if (!Array.isArray(posData)) posData = [posData]
        return posData
    }

    const handleSetHeroA = (hero: Hero) => {
        setHeroA(hero)
        const validPositions = getHeroPositions(hero)
        if (validPositions.length === 1) {
            setPositionA(validPositions[0])
        } else {
            setPositionA('')
        }
    }

    const handleSetHeroB = (hero: Hero) => {
        setHeroB(hero)
        const validPositions = getHeroPositions(hero)
        if (validPositions.length === 1) {
            setPositionB(validPositions[0])
        } else {
            setPositionB('')
        }
    }

    const handleSave = async () => {
        if (!heroA || !heroB || ((!positionA || !positionB) && !ignorePosition)) {
            alert("Please select both heroes and their positions.")
            return
        }

        const finalPosA = ignorePosition ? 'Any' : positionA
        const finalPosB = ignorePosition ? 'Any' : positionB

        if (editingComboId) {
            const res = await updateCombo(editingComboId, {
                description,
                hero_a_position: finalPosA,
                hero_b_position: finalPosB
            })
            if (res.success) {
                const newCombos = await getCombos(selectedVersionId)
                setCombos(newCombos)
                setIsModalOpen(false)
                resetForm()
            } else {
                alert("Error updating combo: " + res.message)
            }
            return
        }

        const payload = {
            hero_a_id: heroA.id,
            hero_a_position: finalPosA,
            hero_b_id: heroB.id,
            hero_b_position: finalPosB,
            synergy_score: 100, // Fixed high score as requested
            description: description,
            version_id: selectedVersionId
        }

        const res = await saveCombo(payload)
        if (res.success) {
            // Refresh list
            const newCombos = await getCombos(selectedVersionId)
            setCombos(newCombos)
            setIsModalOpen(false)
            resetForm()
        } else {
            alert("Error: " + res.message)
        }
    }

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation()
        if (!confirm("Are you sure you want to delete this combo?")) return
        const res = await deleteCombo(id)
        if (res.success) {
            setCombos(prev => prev.filter(c => c.id !== id))
        } else {
            alert("Error deleting combo")
        }
    }

    // --- DERIVED STATE ---

    // --- DERIVED STATE ---

    // Check for same position conflict
    const isSamePosition = !ignorePosition && !!(positionA && positionB && positionA === positionB)

    // Auto-correct position logic
    useEffect(() => {
        if (ignorePosition) return
        if (!heroA || !heroB || !positionA || !positionB) return

        if (positionA === positionB) {
            // Try to find a new position for B first
            const positionsB = getHeroPositions(heroB)
            const nextValidB = positionsB.find(p => p !== positionA)

            if (nextValidB) {
                setPositionB(nextValidB)
                return
            }

            // If B can't move, try to move A
            const positionsA = getHeroPositions(heroA)
            const nextValidA = positionsA.find(p => p !== positionB)

            if (nextValidA) {
                setPositionA(nextValidA)
            }
        }
    }, [positionA, positionB, heroA, heroB])

    // Check for symmetrical duplicate
    const isDuplicate = (() => {
        if (!heroA || !heroB) return false
        if (!ignorePosition && (!positionA || !positionB)) return false

        const targetPosA = ignorePosition ? 'Any' : positionA
        const targetPosB = ignorePosition ? 'Any' : positionB

        return combos.some(c => {
            if (editingComboId && c.id === editingComboId) return false

            // Case 1: Direct Match (A=A, B=B)
            const match1 =
                c.hero_a_id === heroA.id && c.hero_a_position === targetPosA &&
                c.hero_b_id === heroB.id && c.hero_b_position === targetPosB

            // Case 2: Swapped Match (A=B, B=A)
            const match2 =
                c.hero_a_id === heroB.id && c.hero_a_position === targetPosB &&
                c.hero_b_id === heroA.id && c.hero_b_position === targetPosA

            return match1 || match2
        })
    })()

    // --- RENDER ---

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* TOP BAR */}
            <div className="glass-card p-4 md:p-6 flex flex-col md:flex-row items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">Combo Duo System</h1>
                    <p className="text-text-muted mt-1">Manage synergy pairs for the selected patch.</p>
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto">
                    <div className="relative w-full md:w-auto flex-1 md:flex-none">
                        <select
                            value={selectedVersionId}
                            onChange={(e) => setSelectedVersionId(Number(e.target.value))}
                            className="dark-input pl-10 pr-4 py-2 w-full md:w-48 appearance-none cursor-pointer"
                        >
                            {initialVersions.map(v => (
                                <option key={v.id} value={v.id}>{v.name} {v.is_active ? '(Active)' : ''}</option>
                            ))}
                        </select>
                        <Sliders size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                    </div>

                    <button
                        onClick={openModal}
                        className="glow-button px-6 py-2 rounded-lg flex items-center gap-2 whitespace-nowrap"
                    >
                        <Plus size={20} /> Add Combo Duo
                    </button>
                </div>
            </div>

            {/* LIST OF COMBOS */}
            <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        Registered Pairs <span className="bg-white/10 px-2 py-0.5 rounded-full text-xs text-text-muted">{combos.length}</span>
                    </h3>
                </div>

                {isLoading ? (
                    <div className="text-center py-20 animate-pulse text-text-muted">Loading version data...</div>
                ) : combos.length === 0 ? (
                    <div className="text-center py-20 glass-card text-text-muted flex flex-col items-center border border-dashed border-white/10">
                        <Handshake className="w-12 h-12 mb-4 opacity-20" />
                        <p className="text-lg font-medium text-white/50">No combos found for this version.</p>
                        <button onClick={openModal} className="mt-4 text-primary hover:text-white underline text-sm">Create the first pair</button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {combos.map(combo => (
                            <div key={combo.id} className="glass-card p-4 flex items-center gap-4 hover:bg-white/5 transition-all group border-l-4 border-l-primary relative overflow-hidden">
                                {/* Hero A */}
                                <div className="flex items-center gap-3 w-[40%]">
                                    <div className="relative w-10 h-10 rounded-full border-2 border-primary/50 overflow-hidden shadow-lg shadow-purple-900/20 shrink-0">
                                        {combo.hero_a?.icon_url && <Image src={combo.hero_a.icon_url} alt="" fill className="object-cover" />}
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                        <span className="text-sm font-bold text-white truncate">{combo.hero_a?.name}</span>
                                        <span className="text-[10px] text-primary uppercase font-bold tracking-wide">
                                            {combo.hero_a_position === 'Any' ? 'Any Lane' : combo.hero_a_position}
                                        </span>
                                    </div>
                                </div>

                                {/* Link */}
                                <div className="flex items-center justify-center w-[20%] opacity-30 group-hover:opacity-100 transition-opacity">
                                    <LinkIcon size={16} className="text-white transform rotate-45" />
                                </div>

                                {/* Hero B */}
                                <div className="flex items-center justify-end gap-3 w-[40%] text-right">
                                    <div className="flex flex-col min-w-0 items-end">
                                        <span className="text-sm font-bold text-white truncate">{combo.hero_b?.name}</span>
                                        <span className="text-[10px] text-blue-400 uppercase font-bold tracking-wide">
                                            {combo.hero_b_position === 'Any' ? 'Any Lane' : combo.hero_b_position}
                                        </span>
                                    </div>
                                    <div className="relative w-10 h-10 rounded-full border-2 border-blue-500/50 overflow-hidden shadow-lg shadow-blue-900/20 shrink-0">
                                        {combo.hero_b?.icon_url && <Image src={combo.hero_b.icon_url} alt="" fill className="object-cover" />}
                                    </div>
                                </div>

                                {/* Hover Analysis Text */}
                                {combo.description && (
                                    <div className="absolute inset-x-0 bottom-0 bg-black/90 text-text-muted text-[10px] italic p-2 transform translate-y-full group-hover:translate-y-0 transition-transform">
                                        {combo.description}
                                    </div>
                                )}

                                <button
                                    onClick={(e) => handleDelete(combo.id, e)}
                                    className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 hover:bg-red-500 text-white/50 hover:text-white opacity-0 group-hover:opacity-100 transition-all z-20"
                                >
                                    <Trash2 size={12} />
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleEdit(combo); }}
                                    className="absolute top-2 right-8 p-1.5 rounded-full bg-black/60 hover:bg-primary text-white/50 hover:text-white opacity-0 group-hover:opacity-100 transition-all z-20"
                                >
                                    <Edit2 size={12} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* MODAL */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="glass-card w-full max-w-6xl max-h-[90vh] flex flex-col outline-none shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden border border-white/10">
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-white/5">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                {editingComboId ? <Edit2 className="text-primary" /> : <Plus className="text-primary" />}
                                {editingComboId ? 'Edit Combo Note' : 'New Combo Duo'}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-text-muted hover:text-white transition-colors">
                                <X size={24} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">

                            {/* LEFT: HERO SELECTION (Wait, need 2 columns for A and B) */}
                            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-white/10 overflow-hidden">

                                {/* HERO A COLUMN */}
                                <div className={`flex flex-col h-full overflow-hidden ${editingComboId ? 'bg-black/40 opacity-70 pointer-events-none grayscale-[0.5]' : 'bg-black/20'}`}>
                                    <div className="p-3 border-b border-white/5 flex items-center gap-2 bg-primary/5">
                                        <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-xs font-bold text-white">A</div>
                                        <div className="flex-1">
                                            <div className="text-sm font-bold text-white">{heroA ? heroA.name : 'Select Hero A'}</div>
                                            {heroA && <div className="text-[10px] text-primary">{positionA || 'No Position'}</div>}
                                        </div>
                                        {heroA && <button onClick={() => setHeroA(null)} className="text-xs text-red-400 hover:text-white">Change</button>}
                                    </div>

                                    {!heroA ? (
                                        <div className="flex-1 flex flex-col overflow-hidden p-3 gap-3">
                                            <div className="flex gap-2">
                                                <input type="text" placeholder="Search A..." value={searchA} onChange={e => setSearchA(e.target.value)} className="dark-input flex-1 py-1 px-3 text-sm" />
                                                <select value={filterPosA} onChange={e => setFilterPosA(e.target.value)} className="dark-input w-24 py-1 text-sm">
                                                    <option value="All">All</option>
                                                    {POSITIONS.map(p => <option key={p} value={p}>{p.replace(' Dragon', '')}</option>)}
                                                </select>
                                            </div>
                                            <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
                                                <div className="grid grid-cols-6 gap-1.5">
                                                    {getFilteredHeroes(searchA, filterPosA, heroB?.id).map(h => (
                                                        <button key={h.id} onClick={() => handleSetHeroA(h)} className="relative aspect-square rounded overflow-hidden border border-transparent hover:border-white/50 group bg-surface shadow-black shadow-md">
                                                            {h.icon_url ? <Image src={h.icon_url} alt="" fill className="object-cover transition-transform group-hover:scale-110" /> : <div className="w-full h-full bg-slate-800" />}
                                                            <div className="absolute bottom-0 inset-x-0 pb-0.5 text-[8px] font-bold text-center text-white truncate drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] z-10">{h.name}</div>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex-1 p-6 flex flex-col justify-center items-center animate-in fade-in">
                                            <div className="relative w-24 h-24 rounded-full border-4 border-primary shadow-2xl overflow-hidden mb-4">
                                                {heroA.icon_url && <Image src={heroA.icon_url} alt="" fill className="object-cover" />}
                                            </div>
                                            <label className="text-xs font-bold text-text-muted uppercase mb-1">Position A</label>
                                            <div className="relative">
                                                <select
                                                    value={ignorePosition ? 'Any' : positionA}
                                                    onChange={e => setPositionA(e.target.value)}
                                                    className={`dark-input w-48 text-center appearance-none ${isSamePosition ? 'border-red-500 ring-1 ring-red-500' : ''} ${ignorePosition ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                    autoFocus
                                                    disabled={ignorePosition}
                                                >
                                                    {ignorePosition ? (
                                                        <option>Any Lane</option>
                                                    ) : (
                                                        <>
                                                            <option value="">-- Select --</option>
                                                            {getHeroPositions(heroA).map(p => (
                                                                <option key={p} value={p} disabled={p === positionB}>{p} {p === positionB ? '(Taken)' : ''}</option>
                                                            ))}
                                                        </>
                                                    )}
                                                </select>
                                                {!ignorePosition && isSamePosition && <AlertCircle size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-red-500" />}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* HERO B COLUMN */}
                                <div className={`flex flex-col h-full overflow-hidden ${editingComboId ? 'bg-black/40 opacity-70 pointer-events-none grayscale-[0.5]' : 'bg-black/20'}`}>
                                    <div className="p-3 border-b border-white/5 flex items-center gap-2 bg-blue-500/5">
                                        <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-xs font-bold text-white">B</div>
                                        <div className="flex-1">
                                            <div className="text-sm font-bold text-white">{heroB ? heroB.name : 'Select Hero B'}</div>
                                            {heroB && <div className="text-[10px] text-blue-400">{positionB || 'No Position'}</div>}
                                        </div>
                                        {heroB && <button onClick={() => setHeroB(null)} className="text-xs text-red-400 hover:text-white">Change</button>}
                                    </div>

                                    {!heroB ? (
                                        <div className="flex-1 flex flex-col overflow-hidden p-3 gap-3">
                                            <div className="flex gap-2">
                                                <input type="text" placeholder="Search B..." value={searchB} onChange={e => setSearchB(e.target.value)} className="dark-input flex-1 py-1 px-3 text-sm" />
                                                <select value={filterPosB} onChange={e => setFilterPosB(e.target.value)} className="dark-input w-24 py-1 text-sm">
                                                    <option value="All">All</option>
                                                    {POSITIONS.map(p => <option key={p} value={p}>{p.replace(' Dragon', '')}</option>)}
                                                </select>
                                            </div>
                                            <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
                                                <div className="grid grid-cols-6 gap-1.5">
                                                    {getFilteredHeroes(searchB, filterPosB, heroA?.id).map(h => (
                                                        <button key={h.id} onClick={() => handleSetHeroB(h)} className="relative aspect-square rounded overflow-hidden border border-transparent hover:border-white/50 group bg-surface shadow-black shadow-md">
                                                            {h.icon_url ? <Image src={h.icon_url} alt="" fill className="object-cover transition-transform group-hover:scale-110" /> : <div className="w-full h-full bg-slate-800" />}
                                                            <div className="absolute bottom-0 inset-x-0 pb-0.5 text-[8px] font-bold text-center text-white truncate drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] z-10">{h.name}</div>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex-1 p-6 flex flex-col justify-center items-center animate-in fade-in">
                                            <div className="relative w-24 h-24 rounded-full border-4 border-blue-500 shadow-2xl overflow-hidden mb-4">
                                                {heroB.icon_url && <Image src={heroB.icon_url} alt="" fill className="object-cover" />}
                                            </div>
                                            <label className="text-xs font-bold text-text-muted uppercase mb-1">Position B</label>
                                            <div className="relative">
                                                <select
                                                    value={ignorePosition ? 'Any' : positionB}
                                                    onChange={e => setPositionB(e.target.value)}
                                                    className={`dark-input w-48 text-center appearance-none ${isSamePosition ? 'border-red-500 ring-1 ring-red-500' : ''} ${ignorePosition ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                    autoFocus
                                                    disabled={ignorePosition}
                                                >
                                                    {ignorePosition ? (
                                                        <option>Any Lane</option>
                                                    ) : (
                                                        <>
                                                            <option value="">-- Select --</option>
                                                            {getHeroPositions(heroB).map(p => (
                                                                <option key={p} value={p} disabled={p === positionA}>{p} {p === positionA ? '(Taken)' : ''}</option>
                                                            ))}
                                                        </>
                                                    )}
                                                </select>
                                                {!ignorePosition && isSamePosition && <AlertCircle size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-red-500" />}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* RIGHT: DETAILS FORM (1/3 Width on Desktop) */}
                            <div className="w-full lg:w-80 bg-surface/50 border-l border-white/10 p-6 flex flex-col gap-6 shrink-0">
                                <div>
                                    <label className="block text-xs font-bold text-text-muted uppercase mb-2">Combo Description</label>
                                    <textarea
                                        value={description}
                                        onChange={e => setDescription(e.target.value)}
                                        placeholder="Note on synergy..."
                                        className="dark-input w-full h-32 resize-none text-sm"
                                    />

                                    <div className="flex items-center gap-2 pt-2">
                                        <button
                                            onClick={() => setIgnorePosition(!ignorePosition)}
                                            className={`w-10 h-6 rounded-full flex items-center p-1 transition-colors ${ignorePosition ? 'bg-primary' : 'bg-white/10'}`}
                                        >
                                            <div className={`w-4 h-4 rounded-full bg-white transition-transform ${ignorePosition ? 'translate-x-4' : ''}`} />
                                        </button>
                                        <span className="text-sm font-medium text-white">Ignore Position (Any Lane)</span>
                                    </div>
                                </div>

                                <div className="mt-auto flex flex-col gap-3">
                                    {isSamePosition && (
                                        <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3 flex items-start gap-2">
                                            <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
                                            <span className="text-xs text-red-200">Hero A and Hero B cannot occupy the same position.</span>
                                        </div>
                                    )}

                                    <button
                                        onClick={handleSave}
                                        disabled={!heroA || !heroB || ((!positionA || !positionB) && !ignorePosition) || isPending || isDuplicate || isSamePosition}
                                        className={`
                                            w-full py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-all
                                            ${(!heroA || !heroB || ((!positionA || !positionB) && !ignorePosition) || isDuplicate || isSamePosition)
                                                ? 'bg-white/5 text-white/20 cursor-not-allowed'
                                                : 'glow-button text-white shadow-xl'
                                            }
                                        `}
                                    >
                                        {isSamePosition ? (
                                            <> <X size={18} /> Invalid Positions </>
                                        ) : isDuplicate ? (
                                            <> <AlertCircle size={18} /> Already Added </>
                                        ) : (
                                            <> <Save size={18} /> {editingComboId ? 'Update Note' : 'Save Combo'} </>
                                        )}
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
