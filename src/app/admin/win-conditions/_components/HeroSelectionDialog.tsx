'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogHeader, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, X, ChevronLeft } from 'lucide-react'
import { Hero } from './types'

interface HeroSelectionDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    heroes: Hero[]
    onSelect: (heroId: string) => void
    title?: string
}

export function HeroSelectionDialog({ open, onOpenChange, heroes, onSelect, title = "Select Hero" }: HeroSelectionDialogProps) {
    const [search, setSearch] = useState("")
    const [selectedRole, setSelectedRole] = useState<string>("All")

    useEffect(() => {
        if (open) {
            setSearch("")
            setSelectedRole("All")
        }
    }, [open])

    const POSITIONS = ['All', 'Dark Slayer', 'Jungle', 'Mid', 'Abyssal', 'Roam']

    const filteredHeroes = heroes.filter(h => {
        const matchesSearch = h.name.toLowerCase().includes(search.toLowerCase())
        const matchesRole = selectedRole === 'All' || (h.roles && h.roles.includes(selectedRole))
        return matchesSearch && matchesRole
    })

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl bg-[#0B0E14]/95 backdrop-blur-xl border-slate-800 text-slate-200 h-[85vh] flex flex-col p-0 gap-0 overflow-hidden shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)]">
                {/* Header Background */}
                <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-indigo-500/10 to-transparent pointer-events-none" />

                <DialogHeader className="p-6 pb-4 relative z-10 border-b border-slate-800/60 flex flex-row items-center gap-4 space-y-0">
                    <button
                        onClick={() => onOpenChange(false)}
                        className="w-8 h-8 rounded-full bg-slate-800/50 hover:bg-slate-700/50 flex items-center justify-center text-slate-400 hover:text-white transition-all border border-slate-700/50 hover:border-slate-600"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <DialogTitle className="text-2xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400">
                        {title}
                    </DialogTitle>
                </DialogHeader>

                <div className="p-6 pb-2 space-y-5 relative z-20">
                    {/* Controls Row */}
                    <div className="flex flex-col md:flex-row gap-4">
                        {/* Position Filter */}
                        <div className="w-full md:w-56 space-y-2">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">Position</label>
                            <Select value={selectedRole} onValueChange={setSelectedRole}>
                                <SelectTrigger className="h-11 bg-slate-900/60 border-slate-800 text-slate-200 focus:ring-indigo-500/20 focus:border-indigo-500/50 hover:border-slate-700 transition-all font-medium">
                                    <SelectValue placeholder="Position" />
                                </SelectTrigger>
                                <SelectContent className="bg-[#0B0E14] border-slate-800 text-slate-200 shadow-xl">
                                    {POSITIONS.map(p => (
                                        <SelectItem key={p} value={p} className="focus:bg-slate-800 focus:text-white font-medium">{p}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Search */}
                        <div className="flex-1 space-y-2">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">Search</label>
                            <div className="relative group">
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-hover:text-slate-400 transition-colors" />
                                <Input
                                    placeholder="Search by hero name..."
                                    className="h-11 pl-10 bg-slate-900/60 border-slate-800 text-slate-200 focus:ring-indigo-500/20 focus:border-indigo-500/50 hover:border-slate-700 transition-all placeholder:text-slate-600 font-medium"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                                {search && (
                                    <button
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 w-6 h-6 flex items-center justify-center rounded-full hover:bg-slate-800/50 transition-all"
                                        onClick={() => setSearch("")}
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 pt-2 custom-scrollbar relative z-10">
                    <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-3">
                        {filteredHeroes.map(h => (
                            <button
                                key={h.id}
                                onClick={() => onSelect(h.id)}
                                className="group relative aspect-square rounded-xl overflow-hidden border border-slate-800/80 bg-slate-900/40 hover:border-indigo-500/50 hover:shadow-[0_0_20px_rgba(99,102,241,0.25)] hover:bg-slate-800/60 hover:scale-[1.02] transition-all duration-300 flex flex-col"
                                title={h.name}
                            >
                                <Image
                                    src={h.image_url}
                                    alt={h.name}
                                    fill
                                    className="object-cover transition-transform duration-500 group-hover:scale-110"
                                    sizes="(max-width: 768px) 25vw, 15vw"
                                />

                                {/* Hover Effect Overlay */}
                                <div className="absolute inset-0 bg-indigo-500/0 group-hover:bg-indigo-500/10 transition-colors duration-300" />

                                {/* Subtle Inner Shadow */}
                                <div className="absolute inset-0 ring-1 ring-inset ring-black/10 pointer-events-none rounded-xl" />
                            </button>
                        ))}
                    </div>

                    {filteredHeroes.length === 0 && (
                        <div className="h-40 flex flex-col items-center justify-center text-slate-500 border-2 border-dashed border-slate-800/50 rounded-2xl bg-slate-900/20 mt-4">
                            <Search className="w-10 h-10 mb-3 opacity-30" />
                            <p className="text-sm font-medium">No heroes found matching criteria</p>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
