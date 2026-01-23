'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Plus, Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"

import { ConditionItem, Hero, WinCondition } from './types'
import { HeroSelectionDialog } from './HeroSelectionDialog'

interface WinConditionDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    heroes: Hero[];
    versions: string[];
    tournaments?: { id: string; name: string }[];
    onSave: (condition: Omit<WinCondition, 'id' | 'createdAt'>) => void;
    initialValues?: WinCondition;
}

export function WinConditionDialog({ open, onOpenChange, heroes, versions, tournaments = [], onSave, initialValues }: WinConditionDialogProps) {
    const [selectedVersion, setSelectedVersion] = useState<string>(versions[0] || "")
    const [selectedTournament, setSelectedTournament] = useState<string>(() => {
        const target = tournaments.find(t => t.name.toUpperCase().includes("RPL SUMMER 2026"))
        return target ? target.id : "all"
    })
    const [name, setName] = useState("")

    // Ally Conditions
    const [allyConditions, setAllyConditions] = useState<ConditionItem[]>([])

    // Enemy Conditions (Must Not Have)
    const [enemyConditions, setEnemyConditions] = useState<ConditionItem[]>([])

    // Hero Selection Dialog State
    const [isHeroSelectOpen, setIsHeroSelectOpen] = useState(false)
    const [selectionType, setSelectionType] = useState<'ally' | 'enemy' | null>(null)

    // Initialize from initialValues
    useEffect(() => {
        if (open) {
            if (initialValues) {
                setName(initialValues.name || "")
                setSelectedVersion(initialValues.version)
                setSelectedTournament(initialValues.tournamentId || "all")
                setAllyConditions(initialValues.allyConditions || [])
                setEnemyConditions(initialValues.enemyConditions || [])
            } else {
                // Reset defaults for creation
                setName("")
                // Keep version/tournament persistence or reset? Resetting is safer.
                setSelectedVersion(versions[0] || "")
                const target = tournaments.find(t => t.name.toUpperCase().includes("RPL SUMMER 2026"))
                setSelectedTournament(target ? target.id : "all")
                setAllyConditions([])
                setEnemyConditions([])
            }
        }
    }, [open, initialValues, versions, tournaments])


    const openHeroSelection = (type: 'ally' | 'enemy') => {
        setSelectionType(type)
        setIsHeroSelectOpen(true)
    }

    const handleHeroSelect = (heroId: string) => {
        if (selectionType === 'ally') {
            if (allyConditions.length >= 3) return
            setAllyConditions([...allyConditions, { id: Math.random().toString(), heroId, role: "ANY" }])
        } else if (selectionType === 'enemy') {
            if (enemyConditions.length >= 15) return
            setEnemyConditions([...enemyConditions, { id: Math.random().toString(), heroId, role: "ANY" }])
        }
        setIsHeroSelectOpen(false)
    }

    const removeAllyCondition = (id: string) => {
        setAllyConditions(allyConditions.filter(c => c.id !== id))
    }

    const updateAllyCondition = (id: string, field: 'heroId' | 'role', value: string) => {
        setAllyConditions(allyConditions.map(c => c.id === id ? { ...c, [field]: value } : c))
    }

    const removeEnemyCondition = (id: string) => {
        setEnemyConditions(enemyConditions.filter(c => c.id !== id))
    }

    const updateEnemyCondition = (id: string, field: 'heroId' | 'role', value: string) => {
        setEnemyConditions(enemyConditions.map(c => c.id === id ? { ...c, [field]: value } : c))
    }

    const handleSave = () => {
        onSave({
            name,
            version: selectedVersion,
            tournamentId: selectedTournament === "all" ? undefined : selectedTournament,
            allyConditions,
            enemyConditions
        })
        onOpenChange(false)
    }

    const roles = ['ANY', 'Dark Slayer', 'Jungle', 'Mid', 'Abyssal', 'Roam']

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl bg-[#0B0E14] border-slate-800 text-slate-200 h-[85vh] flex flex-col p-0 gap-0 overflow-hidden shadow-[0_0_50px_-12px_rgba(124,58,237,0.2)]">
                {/* Header Pattern */}
                <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-violet-500/10 to-transparent pointer-events-none" />

                <DialogHeader className="p-8 pb-4 relative z-10">
                    <DialogTitle className="text-3xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400">
                        {initialValues ? 'EDIT WIN CONDITION' : 'NEW WIN CONDITION'}
                    </DialogTitle>
                    <DialogDescription className="text-slate-400 text-base">
                        {initialValues ? 'Modify the team composition rules.' : 'Define the team composition rules to analyze.'}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto p-8 pt-2 space-y-8 relative z-10">
                    {/* Basic Info */}
                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Version</label>
                            <Select value={selectedVersion} onValueChange={setSelectedVersion}>
                                <SelectTrigger className="h-12 bg-slate-900/50 border-slate-800 text-slate-100 focus:border-violet-500/50 focus:ring-violet-500/20">
                                    <SelectValue placeholder="Select Version" />
                                </SelectTrigger>
                                <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                                    {versions.map(v => (
                                        <SelectItem key={v} value={v}>{v}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Tournament</label>
                            <Select value={selectedTournament} onValueChange={setSelectedTournament}>
                                <SelectTrigger className="h-12 bg-slate-900/50 border-slate-800 text-slate-100 focus:border-violet-500/50 focus:ring-violet-500/20">
                                    <SelectValue placeholder="All Tournaments">
                                        {selectedTournament === "all"
                                            ? "All Tournaments"
                                            : tournaments.find(t => t.id === selectedTournament)?.name || selectedTournament}
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                                    <SelectItem value="all">All Tournaments</SelectItem>
                                    {tournaments.map(t => (
                                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-8">
                        {/* ALLY TEAM CONDITIONS */}
                        <div className="rounded-xl border border-cyan-500/20 bg-gradient-to-br from-cyan-950/10 to-transparent">
                            <div className="p-2 px-3 border-b border-cyan-500/10 bg-cyan-950/20 flex items-center justify-between rounded-t-xl">
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20 shadow-[0_0_10px_rgba(6,182,212,0.15)]">
                                        <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_5px_cyan]" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-black italic tracking-tighter text-cyan-100 leading-none">OUR TEAM</h3>
                                    </div>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => openHeroSelection('ally')}
                                    disabled={allyConditions.length >= 3}
                                    className="bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/20 hover:border-cyan-500/40 h-6 px-2 text-[10px] font-bold tracking-wide transition-all shadow-md shadow-cyan-900/10"
                                >
                                    <Plus className="w-3 h-3 mr-1" /> ADD
                                </Button>
                            </div>

                            <div className="p-2 space-y-2">
                                {allyConditions.length === 0 && (
                                    <div className="h-16 flex flex-col items-center justify-center border border-dashed border-cyan-500/10 rounded-lg bg-cyan-500/5">
                                        <span className="text-cyan-200/40 text-[10px] font-medium">No heroes selected</span>
                                    </div>
                                )}
                                {allyConditions.map((condition) => {
                                    const hero = heroes.find(h => h.id === condition.heroId)
                                    return (
                                        <div key={condition.id} className="group flex gap-3 items-center bg-slate-900/60 p-1.5 pr-2 rounded-lg border border-slate-800 hover:border-cyan-500/30 hover:bg-cyan-950/10 transition-all shadow-sm">
                                            {/* Hero Image */}
                                            <div className="relative w-9 h-9 rounded overflow-hidden border border-slate-700 shadow-sm shrink-0 group-hover:scale-105 transition-transform">
                                                {hero ? (
                                                    // eslint-disable-next-line @next/next/no-img-element
                                                    <img src={hero.image_url} alt={hero.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full bg-slate-800" />
                                                )}
                                                <div className="absolute inset-0 ring-1 ring-inset ring-black/20" />
                                            </div>

                                            <div className="flex-1 min-w-0 flex flex-col justify-center">
                                                <div className="text-sm font-bold text-slate-100 truncate flex items-center gap-2">
                                                    {hero?.name || 'Unknown'}
                                                </div>
                                            </div>

                                            <div className="w-32">
                                                <Select value={condition.role} onValueChange={(v) => updateAllyCondition(condition.id, 'role', v)}>
                                                    <SelectTrigger className="h-7 bg-slate-950/50 border-slate-800 text-slate-300 text-[10px] focus:ring-0 focus:border-cyan-500/50">
                                                        <SelectValue placeholder="Any Role" />
                                                    </SelectTrigger>
                                                    <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                                                        {roles.map(r => (
                                                            <SelectItem key={r} value={r} className="text-xs">{r === 'ANY' ? 'Any Role' : r}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7 text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 rounded opacity-50 group-hover:opacity-100 transition-opacity ml-1"
                                                onClick={() => removeAllyCondition(condition.id)}
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </Button>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>

                        {/* ENEMY TEAM CONDITIONS */}
                        <div className="rounded-xl border border-rose-500/20 bg-gradient-to-br from-rose-950/10 to-transparent">
                            <div className="p-2 px-3 border-b border-rose-500/10 bg-rose-950/20 flex items-center justify-between rounded-t-xl">
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded bg-rose-500/10 flex items-center justify-center border border-rose-500/20 shadow-[0_0_10px_rgba(244,63,94,0.15)]">
                                        <div className="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-[0_0_5px_rose]" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-black italic tracking-tighter text-rose-100 leading-none">ENEMY AVOID</h3>
                                    </div>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => openHeroSelection('enemy')}
                                    disabled={enemyConditions.length >= 15}
                                    className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 hover:border-rose-500/40 h-6 px-2 text-[10px] font-bold tracking-wide transition-all shadow-md shadow-rose-900/10"
                                >
                                    <Plus className="w-3 h-3 mr-1" /> ADD
                                </Button>
                            </div>

                            <div className="p-2 space-y-2">
                                {enemyConditions.length === 0 && (
                                    <div className="h-16 flex flex-col items-center justify-center border border-dashed border-rose-500/10 rounded-lg bg-rose-500/5">
                                        <span className="text-rose-200/40 text-[10px] font-medium">No exclusions added</span>
                                    </div>
                                )}
                                {enemyConditions.map((condition) => {
                                    const hero = heroes.find(h => h.id === condition.heroId)
                                    return (
                                        <div key={condition.id} className="group flex gap-3 items-center bg-slate-900/60 p-1.5 pr-2 rounded-lg border border-slate-800 hover:border-rose-500/30 hover:bg-rose-950/10 transition-all shadow-sm">
                                            {/* Hero Image */}
                                            <div className="relative w-9 h-9 rounded overflow-hidden border border-slate-700 shadow-sm shrink-0 group-hover:scale-105 transition-transform">
                                                {hero ? (
                                                    // eslint-disable-next-line @next/next/no-img-element
                                                    <img src={hero.image_url} alt={hero.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full bg-slate-800" />
                                                )}
                                                <div className="absolute inset-0 ring-1 ring-inset ring-black/20" />
                                            </div>

                                            <div className="flex-1 min-w-0 flex flex-col justify-center">
                                                <div className="text-sm font-bold text-slate-100 truncate flex items-center gap-2">
                                                    {hero?.name || 'Unknown'}
                                                </div>
                                            </div>

                                            <div className="w-32">
                                                <Select value={condition.role} onValueChange={(v) => updateEnemyCondition(condition.id, 'role', v)}>
                                                    <SelectTrigger className="h-7 bg-slate-950/50 border-slate-800 text-slate-300 text-[10px] focus:ring-0 focus:border-rose-500/50">
                                                        <SelectValue placeholder="Any Role" />
                                                    </SelectTrigger>
                                                    <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                                                        {roles.map(r => (
                                                            <SelectItem key={r} value={r} className="text-xs">{r === 'ANY' ? 'Any Role' : r}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7 text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 rounded opacity-50 group-hover:opacity-100 transition-opacity ml-1"
                                                onClick={() => removeEnemyCondition(condition.id)}
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </Button>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                </div>

                <DialogFooter className="p-6 border-t border-slate-800 bg-slate-950/50 backdrop-blur-xl relative z-20 flex items-center justify-between gap-4">
                    <Button
                        variant="ghost"
                        onClick={() => onOpenChange(false)}
                        className="text-slate-400 hover:text-white hover:bg-slate-800/50 h-12 px-6 font-medium transition-colors"
                    >
                        CANCEL
                    </Button>
                    <Button
                        onClick={handleSave}
                        className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-[0_0_20px_rgba(124,58,237,0.3)] hover:shadow-[0_0_30px_rgba(124,58,237,0.5)] transition-all font-bold h-12 px-8 rounded-lg tracking-wide"
                    >
                        {initialValues ? 'SAVE CHANGES' : 'CREATE CONDITION'}
                    </Button>
                </DialogFooter>

                <HeroSelectionDialog
                    open={isHeroSelectOpen}
                    onOpenChange={setIsHeroSelectOpen}
                    heroes={heroes}
                    onSelect={handleHeroSelect}
                    title={selectionType === 'ally' ? 'Select Ally Hero' : 'Select Enemy to Avoid'}
                />
            </DialogContent>
        </Dialog>
    )
}
