'use client'

import { useFormState } from 'react-dom'
import { addHero } from '@/app/admin/heroes/actions'
import { DAMAGE_TYPES, POWER_SPIKES, POSITIONS } from '@/utils/types'
import { UploadCloud } from 'lucide-react'

const initialState = {
    message: '',
    success: false,
}

export default function HeroForm() {
    const [state, formAction] = useFormState(addHero, initialState)

    return (
        <div className="glass-card p-6 mb-8">
            <h2 className="text-2xl font-bold mb-6 text-text-main flex items-center gap-2">
                <span className="bg-primary/20 p-2 rounded-lg text-primary shadow-[0_0_10px_rgba(168,85,247,0.3)]">
                    <UploadCloud size={24} />
                </span>
                Add New Hero
            </h2>

            <form action={formAction} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Name */}
                    <div>
                        <label htmlFor="name" className="block text-sm font-medium text-text-muted mb-1">
                            Hero Name
                        </label>
                        <input
                            type="text"
                            id="name"
                            name="name"
                            required
                            className="dark-input"
                            placeholder="e.g. Valhein"
                        />
                    </div>

                    {/* Icon URL */}
                    <div>
                        <label htmlFor="icon_url" className="block text-sm font-medium text-text-muted mb-1">
                            Icon URL
                        </label>
                        <input
                            type="url"
                            id="icon_url"
                            name="icon_url"
                            required
                            className="dark-input"
                            placeholder="e.g. https://res.cloudinary.com/..."
                        />
                    </div>

                    {/* Damage Type */}
                    <div>
                        <label htmlFor="damage_type" className="block text-sm font-medium text-text-muted mb-1">
                            Damage Type
                        </label>
                        <select
                            id="damage_type"
                            name="damage_type"
                            className="dark-input appearance-none"
                        >
                            {DAMAGE_TYPES.map((type) => (
                                <option key={type} value={type} className="bg-background text-white">
                                    {type}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Power Spike */}
                    <div>
                        <label htmlFor="power_spike" className="block text-sm font-medium text-text-muted mb-1">
                            Power Spike
                        </label>
                        <select
                            id="power_spike"
                            name="power_spike"
                            className="dark-input appearance-none"
                        >
                            {POWER_SPIKES.map((spike) => (
                                <option key={spike} value={spike} className="bg-background text-white">
                                    {spike}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Roles / Positions */}
                <div>
                    <label className="block text-sm font-medium text-text-muted mb-2">
                        Positions (Select all that apply)
                    </label>
                    <div className="flex flex-wrap gap-3">
                        {POSITIONS.map((pos) => (
                            <label key={pos} className="group inline-flex items-center bg-surface/50 px-3 py-2 rounded-md border border-white/5 hover:bg-white/5 hover:border-primary/50 cursor-pointer transition-all">
                                <input
                                    type="checkbox"
                                    name="main_position"
                                    value={pos}
                                    className="rounded text-primary focus:ring-primary bg-background border-white/20 h-4 w-4 mr-2"
                                />
                                <span className="text-sm text-text-main group-hover:text-primary transition-colors">{pos}</span>
                            </label>
                        ))}
                    </div>
                </div>

                {/* Submit Button & Message */}
                <div className="flex items-center justify-between pt-4">
                    <button
                        type="submit"
                        className="glow-button px-6 py-2 rounded-md"
                    >
                        Add Hero
                    </button>

                    {state.message && (
                        <div className={`text-sm font-bold px-4 py-2 rounded-md border ${state.success
                            ? 'bg-green-500/10 text-green-400 border-green-500/30'
                            : 'bg-red-500/10 text-red-400 border-red-500/30'
                            }`}>
                            {state.message}
                        </div>
                    )}
                </div>
            </form>
        </div>
    )
}
