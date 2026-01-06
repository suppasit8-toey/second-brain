'use client'

import { useState, useActionState, useEffect } from 'react'
import { Hero } from '@/utils/types'
import { updateHero } from '@/app/admin/heroes/actions'
import { X, Save, Upload } from 'lucide-react'
import { CldUploadButton } from 'next-cloudinary'
import Image from 'next/image'

// We need to define the Stats type since it's joined
interface HeroWithStats extends Hero {
    hero_stats?: {
        power_spike: string | null;
        win_rate: number;
        version_id: number;
    }[] | any; // Use any to be safe with join results
}

const DAMAGE_TYPES = ['Physical', 'Magic', 'True']
const POSITIONS = ['Dark Slayer', 'Jungle', 'Mid', 'Abyssal', 'Roam']
const POWER_SPIKES = ['Early', 'Mid', 'Late', 'Balanced']

export default function EditHeroModal({ hero, versionId, onClose }: { hero: HeroWithStats, versionId: number, onClose: () => void }) {
    const stats = Array.isArray(hero.hero_stats) ? hero.hero_stats[0] : hero.hero_stats
    const [uploadedImageUrl, setUploadedImageUrl] = useState(hero.icon_url)

    // Helper to get initial positions (array or string support)
    const initialPositions = Array.isArray(hero.main_position) ? hero.main_position :
        (typeof hero.main_position === 'string' ? JSON.parse(hero.main_position) : []) // Fallback

    // We'll manage positions state locally for the checkboxes
    const [selectedPositions, setSelectedPositions] = useState<string[]>(initialPositions)

    const togglePosition = (pos: string) => {
        setSelectedPositions(prev => prev.includes(pos) ? prev.filter(p => p !== pos) : [...prev, pos])
    }

    const initialState = { success: false, message: '' }
    const [state, formAction, isPending] = useActionState(async (prevState: any, formData: FormData) => {
        // Validation check for positions
        if (selectedPositions.length === 0) {
            return { success: false, message: 'At least one position is required' }
        }
        return await updateHero(formData)
    }, initialState)

    // Close modal on success side effect
    useEffect(() => {
        if (state.success) {
            onClose()
        }
    }, [state.success, onClose])

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="glass-card w-full max-w-2xl max-h-[90vh] overflow-y-auto outline-none shadow-2xl animate-in zoom-in-95 duration-200 relative">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-text-muted hover:text-white transition-colors"
                >
                    <X size={24} />
                </button>

                <div className="p-6 border-b border-white/10">
                    <h2 className="text-xl font-bold text-white">Edit Hero: {hero.name}</h2>
                </div>

                <form action={formAction} className="p-6 space-y-6">
                    <input type="hidden" name="id" value={hero.id} />
                    <input type="hidden" name="version_id" value={versionId} />
                    <input type="hidden" name="old_name" value={hero.name} />
                    {/* Send positions as multiple values with same name 'positions' */}
                    {selectedPositions.map(p => (
                        <input key={p} type="hidden" name="positions" value={p} />
                    ))}

                    <div className="flex flex-col sm:flex-row gap-6">
                        {/* Image Upload */}
                        <div className="flex flex-col items-center gap-3">
                            <div className="relative w-32 h-32 rounded-full overflow-hidden border-2 border-dashed border-white/20 hover:border-primary transition-colors bg-white/5 group">
                                {uploadedImageUrl ? (
                                    <Image src={uploadedImageUrl} alt="Preview" fill className="object-cover" />
                                ) : (
                                    <div className="flex items-center justify-center w-full h-full text-text-muted">
                                        <Upload size={32} />
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <CldUploadButton
                                        uploadPreset={process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || 'ml_default'}
                                        onSuccess={(result: any) => setUploadedImageUrl(result.info.secure_url)}
                                        className="text-xs bg-white text-black px-3 py-1 rounded-full font-bold cursor-pointer"
                                    >
                                        Change
                                    </CldUploadButton>
                                </div>
                            </div>
                            <input type="hidden" name="icon_url" value={uploadedImageUrl} />
                            <span className="text-xs text-text-muted">Click to change icon</span>
                        </div>

                        {/* Basic Info */}
                        <div className="flex-1 space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-text-muted">Hero Name (Locked)</label>
                                <input
                                    name="name"
                                    defaultValue={hero.name}
                                    className="dark-input w-full opacity-50 cursor-not-allowed text-gray-500 bg-white/5"
                                    readOnly
                                    title="Hero name cannot be changed"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-text-muted">Damage Type</label>
                                <select name="damage_type" defaultValue={hero.damage_type} className="dark-input w-full">
                                    {DAMAGE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Positions */}
                        {/* Positions */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-purple-300">Positions</label>
                            <div className="flex flex-wrap gap-2">
                                {POSITIONS.map((pos) => {
                                    const isSelected = selectedPositions.includes(pos);
                                    return (
                                        <button
                                            key={pos}
                                            type="button"
                                            onClick={() => togglePosition(pos)}
                                            className={`
                                                px-4 py-2 rounded-lg border text-sm font-medium transition-all
                                                ${isSelected
                                                    ? 'bg-purple-600/20 border-purple-500 text-purple-300 shadow-[0_0_10px_rgba(168,85,247,0.2)]'
                                                    : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                                                }
                                            `}
                                        >
                                            {pos}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Version Stats */}
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-text-muted">Power Spike</label>
                                <select name="power_spike" defaultValue={stats?.power_spike || 'Balanced'} className="dark-input w-full">
                                    {POWER_SPIKES.map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>

                    {state.message && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                            {state.message}
                        </div>
                    )}

                    <div className="pt-4 border-t border-white/10 flex justify-end gap-3">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-text-muted hover:text-white transition-colors">Cancel</button>
                        <button type="submit" disabled={isPending} className="glow-button px-6 py-2 rounded-lg flex items-center gap-2">
                            {isPending ? 'Saving...' : <><Save size={18} /> Save Changes</>}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
