'use client'

import { useFormState } from 'react-dom'
import { addMatchup } from '@/app/admin/matchups/actions'
import { Hero, POSITIONS } from '@/utils/types'
import { Swords } from 'lucide-react'
import { useState } from 'react'

interface MatchupFormProps {
    heroes: Hero[]
}

const initialState = {
    message: '',
    success: false,
}

export default function MatchupForm({ heroes }: MatchupFormProps) {
    const [state, formAction] = useFormState(addMatchup, initialState)
    const [winRate, setWinRate] = useState(50)
    const [selectedHeroId, setSelectedHeroId] = useState<string>("")

    return (
        <div className="glass-card p-6 mb-8">
            <h2 className="text-2xl font-bold mb-6 text-text-main flex items-center gap-2">
                <span className="bg-red-500/20 p-2 rounded-lg text-red-500 shadow-[0_0_10px_rgba(239,68,68,0.3)]">
                    <Swords size={24} />
                </span>
                Add New Matchup
            </h2>

            <form action={formAction} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* My Hero */}
                    <div>
                        <label htmlFor="hero_id" className="block text-sm font-medium text-text-muted mb-1">
                            My Hero
                        </label>
                        <select
                            id="hero_id"
                            name="hero_id"
                            required
                            value={selectedHeroId}
                            onChange={(e) => setSelectedHeroId(e.target.value)}
                            className="dark-input appearance-none"
                        >
                            <option value="" disabled className="bg-background">Select a hero</option>
                            {heroes.map((hero) => (
                                <option key={hero.id} value={hero.id} className="bg-background text-white">
                                    {hero.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Opponent Hero */}
                    <div>
                        <label htmlFor="opponent_id" className="block text-sm font-medium text-text-muted mb-1">
                            Opponent Hero
                        </label>
                        <select
                            id="opponent_id"
                            name="opponent_id"
                            required
                            className="dark-input appearance-none"
                        >
                            <option value="" disabled selected className="bg-background">Select opponent</option>
                            {heroes.map((hero) => (
                                <option key={hero.id} value={hero.id} disabled={selectedHeroId === hero.id} className="bg-background text-white disabled:opacity-50">
                                    {hero.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Lane */}
                    <div>
                        <label htmlFor="lane" className="block text-sm font-medium text-text-muted mb-1">
                            Lane / Position
                        </label>
                        <select
                            id="lane"
                            name="lane"
                            required
                            className="dark-input appearance-none"
                        >
                            {POSITIONS.map((pos) => (
                                <option key={pos} value={pos} className="bg-background text-white">
                                    {pos}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Win Rate Slider */}
                    <div>
                        <label htmlFor="win_rate" className="block text-sm font-medium text-text-muted mb-2 flex justify-between">
                            <span>My Win Rate %</span>
                            <span className={`font-bold text-lg ${winRate > 50 ? 'text-green-400 drop-shadow-[0_0_5px_rgba(74,222,128,0.5)]' : 'text-red-400 drop-shadow-[0_0_5px_rgba(248,113,113,0.5)]'}`}>{winRate}%</span>
                        </label>
                        <input
                            type="range"
                            id="win_rate"
                            name="win_rate"
                            min="0"
                            max="100"
                            value={winRate}
                            onChange={(e) => setWinRate(parseInt(e.target.value))}
                            className="w-full h-2 bg-surface rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-all"
                        />
                        <div className="flex justify-between text-[10px] text-text-muted mt-2 font-mono uppercase tracking-widest">
                            <span>Counters Me</span>
                            <span>Even</span>
                            <span>I Counter</span>
                        </div>
                    </div>
                </div>

                {/* Note */}
                <div>
                    <label htmlFor="note" className="block text-sm font-medium text-text-muted mb-1">
                        Note (Optional)
                    </label>
                    <textarea
                        id="note"
                        name="note"
                        rows={3}
                        className="dark-input"
                        placeholder="e.g. Invade early, or play safe until lvl 4..."
                    />
                </div>

                {/* Submit Button & Message */}
                <div className="flex items-center justify-between pt-4">
                    <button
                        type="submit"
                        className="glow-button bg-red-600 hover:bg-red-700 shadow-[0_0_20px_rgba(220,38,38,0.5)] px-6 py-2 rounded-md"
                    >
                        Save Matchup
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
