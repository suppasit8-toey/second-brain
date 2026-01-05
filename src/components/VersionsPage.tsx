'use client'

import { useActionState } from 'react'
import { createVersion, activateVersion } from '@/app/admin/versions/actions'
import { Version } from '@/utils/types'
import { Play, Plus, CheckCircle2 } from 'lucide-react'

const initialState = {
    message: '',
    success: false,
}

export default function VersionsPage({ versions }: { versions: Version[] }) {
    const [state, formAction] = useActionState(createVersion, initialState)

    return (
        <div className="p-8 pb-24">
            <div className="max-w-4xl mx-auto space-y-8">
                <div className="glass-card p-6 flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">Version Control</h1>
                        <p className="text-text-muted mt-1">Manage game patches and seasons.</p>
                    </div>
                </div>

                {/* Create New */}
                <div className="glass-card p-6">
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Plus size={20} className="text-primary" /> Create New Version</h2>
                    <form action={formAction} className="flex gap-4 items-end">
                        <div className="flex-1">
                            <label className="block text-sm font-medium text-text-muted mb-1">Version Name</label>
                            <input name="name" type="text" placeholder="e.g. Patch 1.52" className="dark-input" required />
                        </div>
                        <div className="flex-1">
                            <label className="block text-sm font-medium text-text-muted mb-1">Start Date</label>
                            <input name="start_date" type="date" className="dark-input" required />
                        </div>
                        <button type="submit" className="glow-button px-6 py-2 rounded-lg">Create</button>
                    </form>
                    {state.message && (
                        <p className={`mt-2 text-sm ${state.success ? 'text-green-400' : 'text-red-400'}`}>{state.message}</p>
                    )}
                </div>

                {/* List */}
                <div className="glass-card overflow-hidden">
                    <table className="min-w-full divide-y divide-white/5">
                        <thead className="bg-surface-highlight/50">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-bold text-text-muted uppercase">Version Name</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-text-muted uppercase">Status</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-text-muted uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {versions?.map((v) => (
                                <tr key={v.id} className="hover:bg-white/5 transition-colors">
                                    <td className="px-6 py-4 font-medium text-white">{v.name}</td>
                                    <td className="px-6 py-4">
                                        {v.is_active ? (
                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">
                                                <CheckCircle2 size={12} /> Active
                                            </span>
                                        ) : (
                                            <span className="text-text-muted text-sm">Inactive</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        {!v.is_active && (
                                            <form action={async () => {
                                                if (!confirm('Activate this version? This will change all hero stats.')) return;
                                                await activateVersion(v.id)
                                            }}>
                                                <button className="text-xs bg-white/5 hover:bg-primary hover:text-white px-3 py-1.5 rounded transition-colors border border-white/10 flex items-center gap-1">
                                                    <Play size={12} /> Activate
                                                </button>
                                            </form>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
