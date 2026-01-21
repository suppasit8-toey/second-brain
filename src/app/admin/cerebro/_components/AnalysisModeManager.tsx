'use client'

import { useState, useEffect } from 'react'
import { AnalysisMode, AnalysisLayerConfig } from '@/utils/types'
import { Brain, Settings2, Plus, GripVertical, Check, RefreshCw, ChevronUp, ChevronDown, Globe, Swords, Users, Link as LinkIcon, Target, ShieldBan, History } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { DEFAULT_MODES } from '../constants'

interface AnalysisModeManagerProps {
    currentMode: AnalysisMode;
    onModeChange: (mode: AnalysisMode) => void;
}

export default function AnalysisModeManager({ currentMode, onModeChange }: AnalysisModeManagerProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [modes, setModes] = useState<AnalysisMode[]>(DEFAULT_MODES)
    const [isEditing, setIsEditing] = useState(false)

    // Load Custom Modes from LocalStorage
    useEffect(() => {
        const saved = localStorage.getItem('cerebro_custom_modes')
        if (saved) {
            try {
                const customModes = JSON.parse(saved)
                setModes([...DEFAULT_MODES, ...customModes])
            } catch (e) {
                console.error("Failed to load custom AI modes", e)
            }
        }
    }, [])

    // Quick Select Mode
    const handleSelectMode = (mode: AnalysisMode) => {
        if (!isEditing) {
            onModeChange(mode)
            setIsOpen(false)
        }
    }

    const toggleLayer = (layerId: string) => {
        const newLayers = currentMode.layers.map(l =>
            l.id === layerId ? { ...l, isActive: !l.isActive } : l
        )
        onModeChange({ ...currentMode, layers: newLayers })
    }

    const moveLayer = (index: number, direction: 'up' | 'down') => {
        const newLayers = [...currentMode.layers]
        const targetIndex = direction === 'up' ? index - 1 : index + 1

        if (targetIndex >= 0 && targetIndex < newLayers.length) {
            const temp = newLayers[index]
            newLayers[index] = newLayers[targetIndex]
            newLayers[targetIndex] = temp

            // Re-assign order
            const ordered = newLayers.map((l, i) => ({ ...l, order: i }))
            onModeChange({ ...currentMode, layers: ordered })
        }
    }

    const getLayerIcon = (id: string) => {
        switch (id) {
            case 'meta': return { icon: Globe, color: 'text-purple-400' }
            case 'counter': return { icon: Swords, color: 'text-red-400' }
            case 'comfort': return { icon: Users, color: 'text-blue-400' }
            case 'synergy': return { icon: LinkIcon, color: 'text-emerald-400' }
            case 'roster': return { icon: Target, color: 'text-cyan-400' }
            case 'ban': return { icon: ShieldBan, color: 'text-orange-400' }
            case 'composition': return { icon: Brain, color: 'text-pink-400' }
            case 'recent': return { icon: History, color: 'text-yellow-400' }
            default: return { icon: Brain, color: 'text-slate-400' }
        }
    }

    return (
        <div className="relative z-50">
            {/* Trigger Button */}
            <Button
                onClick={() => setIsOpen(!isOpen)}
                variant="outline"
                className="bg-slate-900 border-slate-700 hover:bg-slate-800 text-slate-200 gap-2 h-10 px-2 md:px-4"
            >
                <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-indigo-500/10 rounded border border-indigo-500/20">
                        <Brain className="w-4 h-4 text-indigo-400" />
                    </div>
                    <div className="flex flex-col items-start leading-none text-xs">
                        <span className="hidden md:block text-[10px] text-slate-500 uppercase font-bold">Analysis Mode</span>
                        <span className="font-bold text-white truncate max-w-[120px] md:max-w-[180px]">{currentMode.name.split('(')[0]}</span>
                    </div>
                </div>
                <Settings2 className="w-4 h-4 ml-1 md:ml-2 text-slate-500" />
            </Button>

            {/* Dropdown Panel */}
            {isOpen && (
                <div className="absolute top-12 left-0 w-[90vw] max-w-[420px] bg-[#0F1218] border border-slate-800 rounded-xl shadow-2xl p-4 animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-white flex items-center gap-2">
                            <Brain className="w-5 h-5 text-primary" />
                            Select AI Persona
                        </h3>
                        <div className="flex items-center gap-2">
                            <Button
                                size="sm"
                                variant={isEditing ? "secondary" : "ghost"}
                                onClick={() => setIsEditing(!isEditing)}
                                className="h-7 text-xs"
                            >
                                {isEditing ? 'Done' : 'Customize'}
                            </Button>
                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-slate-500" onClick={() => setIsOpen(false)}>×</Button>
                        </div>
                    </div>

                    {!isEditing ? (
                        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                            {modes.map(mode => (
                                <div
                                    key={mode.id}
                                    onClick={() => handleSelectMode(mode)}
                                    className={`
                                        p-3 rounded-lg border cursor-pointer transition-all group
                                        ${currentMode.id === mode.id
                                            ? 'bg-primary/10 border-primary/50'
                                            : 'bg-slate-900/50 border-slate-800 hover:bg-slate-800 hover:border-slate-700'
                                        }
                                    `}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="w-full">
                                            <div className="flex items-center justify-between w-full">
                                                <span className={`font-bold text-sm ${currentMode.id === mode.id ? 'text-primary' : 'text-slate-200'}`}>
                                                    {mode.name}
                                                </span>
                                                {currentMode.id === mode.id && <Check className="w-4 h-4 text-primary" />}
                                            </div>
                                            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                                                {mode.description}
                                            </p>

                                            {/* Mini Logic Viz */}
                                            <div className="flex items-center gap-1 mt-3 overflow-hidden">
                                                {mode.layers.sort((a, b) => b.weight - a.weight).slice(0, 3).map(l => {
                                                    const { icon: LIcon, color: lColor } = getLayerIcon(l.id)
                                                    return (
                                                        <div key={l.id} className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-400 border border-slate-700 flex items-center gap-1">
                                                            <LIcon className={`w-3 h-3 ${lColor}`} />
                                                            {l.name.split(' ')[0]}
                                                            <span className={l.weight > 1 ? 'text-green-400' : 'text-slate-500'}>x{l.weight}</span>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <div className="text-xs text-slate-400 mb-2 px-1">
                                Adjust layers for <b>{currentMode.name}</b>. Drag/Order not available yet (use Weights).
                            </div>
                            {currentMode.layers.sort((a, b) => a.order - b.order).map((layer, index) => {
                                const { icon: Icon, color } = getLayerIcon(layer.id)
                                return (
                                    <div key={layer.id} className="flex items-center justify-between p-2 bg-slate-900 rounded border border-slate-800">
                                        <div className="flex items-center gap-3">
                                            <div className="flex flex-col gap-0.5">
                                                <Button
                                                    variant="ghost" size="icon" className="h-4 w-4 text-slate-500 hover:text-white"
                                                    onClick={() => moveLayer(index, 'up')}
                                                    disabled={index === 0}
                                                >
                                                    <ChevronUp className="w-3 h-3" />
                                                </Button>
                                                <Button
                                                    variant="ghost" size="icon" className="h-4 w-4 text-slate-500 hover:text-white"
                                                    onClick={() => moveLayer(index, 'down')}
                                                    disabled={index === currentMode.layers.length - 1}
                                                >
                                                    <ChevronDown className="w-3 h-3" />
                                                </Button>
                                            </div>

                                            {/* Icon Box */}
                                            <div className="p-1.5 rounded bg-slate-800 border border-slate-700">
                                                <Icon className={`w-4 h-4 ${color}`} />
                                            </div>

                                            <div className="flex flex-col">
                                                <span className="text-sm text-slate-200 font-medium">{layer.name}</span>
                                                <span className="text-[10px] text-slate-500">Weight: {layer.weight}x</span>
                                            </div>
                                        </div>
                                        <Switch
                                            checked={layer.isActive}
                                            onChange={() => toggleLayer(layer.id)}
                                            className="peer-checked:bg-indigo-500"
                                        />
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
