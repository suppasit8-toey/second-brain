'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
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
    DialogTrigger,
} from "@/components/ui/dialog"
import {
    Brain,
    Globe,
    Users,
    Swords,
    Link as LinkIcon,
    ShieldBan,
    Target,
    History,
    Save,
    Info,
    ChevronLeft,
    ExternalLink,
    Plus,
    Trash2,
    RotateCcw
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AnalysisMode, AnalysisLayerConfig } from '@/utils/types'
import { DEFAULT_MODES, ANALYSIS_LAYER_METADATA } from '../constants'

// Map icon names to components
const ICON_MAP: Record<string, any> = {
    'Globe': Globe,
    'Swords': Swords,
    'Users': Users,
    'Target': Target,
    'ShieldBan': ShieldBan,
    'Brain': Brain,
    'Link': LinkIcon,
    'History': History
}

export default function CerebroKnowledgeBase() {
    const router = useRouter()

    // State
    const [modes, setModes] = useState<AnalysisMode[]>(DEFAULT_MODES)
    const [selectedModeId, setSelectedModeId] = useState<string>(DEFAULT_MODES[0].id)
    const [isDirty, setIsDirty] = useState(false)

    // New Mode Dialog
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
    const [newModeName, setNewModeName] = useState('')

    // Load custom modes
    useEffect(() => {
        const saved = localStorage.getItem('cerebro_custom_modes')
        if (saved) {
            try {
                const customModes = JSON.parse(saved)
                // Merge custom modes, but ensure we don't duplicate if they have same IDs as defaults (unlikely)
                setModes([...DEFAULT_MODES, ...customModes])
            } catch (e) {
                console.error("Failed to load settings", e)
            }
        }
    }, [])

    const currentMode = modes.find(m => m.id === selectedModeId) || modes[0]
    const isCustomMode = !DEFAULT_MODES.some(m => m.id === currentMode.id)

    // Handlers
    const handleModeChange = (val: string) => {
        if (isDirty) {
            if (!confirm('You have unsaved changes. Discard them?')) return
        }
        setSelectedModeId(val)
        setIsDirty(false)
    }

    const updateLayer = (layerId: string, updates: Partial<AnalysisLayerConfig>) => {
        // If it's a default mode, we can't edit it directly? 
        // Plan: If user edits a default mode, maybe we prompt to clone?
        // Or specific behavior: "Custom" modes are effectively clones.
        // Let's allow in-memory editing of any mode, but saving requires creating a new one unless it's already custom.

        const newLayers = currentMode.layers.map(l =>
            l.id === layerId ? { ...l, ...updates } : l
        )

        const updatedMode = { ...currentMode, layers: newLayers }
        setModes(prev => prev.map(m => m.id === currentMode.id ? updatedMode : m))
        setIsDirty(true)
    }

    const handleSave = () => {
        if (!isCustomMode) {
            // If trying to save a default mode, open create dialog
            setIsCreateDialogOpen(true)
            setNewModeName(`Copy of ${currentMode.name}`)
            return
        }

        // Save Custom Mode
        saveCustomModes(modes.filter(m => !DEFAULT_MODES.some(dm => dm.id === m.id)))
        setIsDirty(false)
    }

    const handleCreateMode = () => {
        if (!newModeName.trim()) return

        const newMode: AnalysisMode = {
            ...currentMode,
            id: `custom_${Date.now()}`,
            name: newModeName,
            description: 'Custom Configuration'
        }

        setModes(prev => [...prev, newMode])
        setSelectedModeId(newMode.id)
        setIsCreateDialogOpen(false)
        setIsDirty(false)

        // Save immediately
        const customModes = modes.filter(m => !DEFAULT_MODES.some(dm => dm.id === m.id))
        saveCustomModes([...customModes, newMode])
    }

    const handleDeleteMode = () => {
        if (!confirm(`Delete mode "${currentMode.name}"?`)) return

        const remainingCustoms = modes.filter(m => !DEFAULT_MODES.some(dm => dm.id === m.id) && m.id !== currentMode.id)

        setModes([...DEFAULT_MODES, ...remainingCustoms])
        setSelectedModeId(DEFAULT_MODES[0].id)
        saveCustomModes(remainingCustoms)
    }

    const saveCustomModes = (customs: AnalysisMode[]) => {
        localStorage.setItem('cerebro_custom_modes', JSON.stringify(customs))
    }

    const handleReset = () => {
        // Reload defaults for this mode
        const original = DEFAULT_MODES.find(m => m.id === currentMode.id)
        if (original) {
            setModes(prev => prev.map(m => m.id === original.id ? original : m))
            setIsDirty(false)
        } else {
            // It's custom, maybe revert to saved state?
            // For now, just reload page or do nothing.
            alert("Cannot reset customized custom mode yet (re-select to discard changes).")
        }
    }

    // Helper to get layer config (or default if missing in mode)
    const getLayerConfig = (id: string): AnalysisLayerConfig => {
        return currentMode.layers.find(l => l.id === id) || {
            id: id as any,
            name: ANALYSIS_LAYER_METADATA[id].name,
            isActive: false,
            weight: 1.0,
            order: 99
        }
    }

    return (
        <div className="min-h-screen bg-[#0B0E14] text-slate-200 p-4 lg:p-8">
            <div className="max-w-6xl mx-auto space-y-6">

                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
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
                            Configure the AI Persona and logic layers. Adjust weights to customize the Draft Simulator's behavior.
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="flex flex-col items-end gap-2">
                            <div className="flex items-center gap-2 bg-slate-900 p-1 rounded-lg border border-slate-800">
                                <span className="text-xs text-slate-400 font-bold px-2 uppercase">Mode</span>
                                <Select value={selectedModeId} onValueChange={handleModeChange}>
                                    <SelectTrigger className="w-[200px] h-8 bg-slate-800 border-none text-white text-xs font-bold">
                                        <SelectValue placeholder="Select Mode" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <div className="p-1">
                                            <div className="text-[10px] text-slate-500 font-bold px-2 py-1 mb-1">STANDARD</div>
                                            {DEFAULT_MODES.map(m => (
                                                <SelectItem key={m.id} value={m.id} className="text-xs">{m.name}</SelectItem>
                                            ))}
                                            <div className="text-[10px] text-slate-500 font-bold px-2 py-1 mt-2 mb-1 border-t border-slate-800">CUSTOM</div>
                                            {modes.filter(m => !DEFAULT_MODES.some(dm => dm.id === m.id)).map(m => (
                                                <SelectItem key={m.id} value={m.id} className="text-xs">{m.name}</SelectItem>
                                            ))}
                                        </div>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex gap-2">
                                {isCustomMode && (
                                    <Button size="sm" variant="destructive" onClick={handleDeleteMode} className="h-8 w-8 p-0">
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                )}

                                <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                                    <DialogTrigger asChild>
                                        <Button size="sm" variant="outline" className="h-8 gap-2 border-slate-700 hover:bg-slate-800">
                                            <Plus className="w-4 h-4" />
                                            New
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="bg-slate-900 border-slate-800 text-white">
                                        <DialogHeader>
                                            <DialogTitle>Create Custom Mode</DialogTitle>
                                            <DialogDescription>
                                                Save your current configuration as a new reusable mode.
                                            </DialogDescription>
                                        </DialogHeader>
                                        <div className="py-4">
                                            <label className="text-sm font-medium mb-2 block">Mode Name</label>
                                            <Input
                                                value={newModeName}
                                                onChange={(e) => setNewModeName(e.target.value)}
                                                placeholder="e.g. Aggressive Early Game"
                                                className="bg-slate-950 border-slate-800"
                                            />
                                        </div>
                                        <DialogFooter>
                                            <Button onClick={handleCreateMode} className="bg-indigo-600 hover:bg-indigo-700">Create Mode</Button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>

                                <Button
                                    size="sm"
                                    onClick={handleSave}
                                    className={`h-8 gap-2 font-bold transition-all ${isDirty ? 'bg-indigo-600 hover:bg-indigo-700 animate-pulse' : 'bg-slate-800 hover:bg-slate-700 text-slate-400'}`}
                                >
                                    <Save className="w-4 h-4" />
                                    {isDirty ? 'Save Changes' : 'Saved'}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {Object.entries(ANALYSIS_LAYER_METADATA).map(([id, meta]) => {
                        const config = getLayerConfig(id)
                        const Icon = ICON_MAP[meta.iconName] || Brain

                        return (
                            <div
                                key={id}
                                className={`
                                    relative p-5 rounded-xl border transition-all duration-200 group flex flex-col justify-between
                                    ${config.isActive
                                        ? 'bg-slate-800/60 border-indigo-500/30'
                                        : 'bg-slate-900/40 border-slate-800 opacity-60 grayscale'
                                    }
                                `}
                            >
                                <div>
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex items-center gap-2">
                                            <div className={`p-2 rounded-lg ${config.isActive ? 'bg-slate-900 shadow-inner' : 'bg-slate-800 text-slate-500'}`}>
                                                <Icon className={`w-6 h-6 ${config.isActive ? meta.color : ''}`} />
                                            </div>
                                            {config.isActive && meta.path && (
                                                <Link href={meta.path}>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white hover:bg-slate-800">
                                                        <ExternalLink className="w-4 h-4" />
                                                    </Button>
                                                </Link>
                                            )}
                                        </div>

                                        {/* Toggle Switch */}
                                        <Switch
                                            checked={config.isActive}
                                            onChange={(e) => updateLayer(id, { isActive: e.target.checked })}
                                            className="peer-checked:bg-indigo-500"
                                        />
                                    </div>

                                    <h3 className={`font-bold text-lg mb-2 ${config.isActive ? 'text-white' : 'text-slate-400'}`}>
                                        {meta.name}
                                    </h3>
                                    <p className="text-sm text-slate-400 leading-relaxed mb-6 min-h-[60px]">
                                        {meta.description}
                                    </p>
                                </div>

                                {/* Weight Control */}
                                <div className={`pt-4 border-t border-slate-800/50 transition-opacity ${!config.isActive && 'pointer-events-none opacity-50'}`}>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-bold text-slate-500 uppercase">Weight Priority</span>
                                        <span className={`text-xs font-mono font-bold ${config.weight > 1.5 ? 'text-green-400' : 'text-slate-300'}`}>
                                            x{config.weight.toFixed(1)}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="outline" size="sm"
                                            className="h-6 w-6 p-0 bg-slate-900 border-slate-800 hover:bg-slate-800"
                                            onClick={() => updateLayer(id, { weight: Math.max(0, parseFloat((config.weight - 0.1).toFixed(1))) })}
                                        >
                                            -
                                        </Button>
                                        <div className="flex-1 h-1.5 bg-slate-900 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all ${config.weight > 1 ? 'bg-indigo-500' : 'bg-slate-600'}`}
                                                style={{ width: `${Math.min(100, (config.weight / 3) * 100)}%` }} // Max 3.0 scale visual
                                            />
                                        </div>
                                        <Button
                                            variant="outline" size="sm"
                                            className="h-6 w-6 p-0 bg-slate-900 border-slate-800 hover:bg-slate-800"
                                            onClick={() => updateLayer(id, { weight: Math.min(5.0, parseFloat((config.weight + 0.1).toFixed(1))) })}
                                        >
                                            +
                                        </Button>
                                    </div>
                                </div>

                                {config.isActive && (
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
                        <strong className="text-slate-200 block mb-1">About Logic Weights</strong>
                        Higher weights (e.g. x2.0) double the score contribution of that logic layer.
                        Use weights to creating specific personas (e.g. "Meta Slave" with Meta x3.0, or "OTP" with Roster x3.0).
                    </div>
                </div>

            </div>
        </div>
    )
}
