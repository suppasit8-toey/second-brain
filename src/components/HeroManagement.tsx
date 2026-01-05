'use client'

import { useState, useEffect, useTransition } from 'react'
import * as XLSX from 'xlsx'
import { bulkImportHeroes, createHero, getHeroesByVersion } from '@/app/admin/heroes/actions'
import { Version, Hero } from '@/utils/types' // Ensure Hero type has hero_stats joined
import { Plus, X, Upload, Users, Shield, Sword, Zap, Sliders, Download, FileSpreadsheet } from 'lucide-react'
import { CldUploadButton } from 'next-cloudinary'
import Image from 'next/image'
import Link from 'next/link'

// Extend Hero type locally since the join structure is specific
interface HeroWithStats extends Hero {
    hero_stats: {
        tier: string;
        power_spike: string;
        win_rate: number;
        version_id: number;
    }[] | any; // Type 'any' for simpler handling of array vs object join issue in Supabase types
}

export default function HeroManagement({ initialVersions }: { initialVersions: Version[] }) {
    const [selectedVersionId, setSelectedVersionId] = useState<number>(initialVersions.find(v => v.is_active)?.id || initialVersions[0]?.id || 0)
    const [heroes, setHeroes] = useState<HeroWithStats[]>([])
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [isPending, startTransition] = useTransition()

    // Form State
    const [uploadedImageUrl, setUploadedImageUrl] = useState('')
    const [positions, setPositions] = useState<string[]>([])

    // Filter State
    const POSITIONS = ['All', 'Dark Slayer', 'Jungle', 'Mid', 'Abyssal', 'Roam'];
    const [filter, setFilter] = useState('All');

    const filteredHeroes = heroes.filter(hero => {
        // 1. If All, show everything
        if (filter === 'All') return true;

        // 2. Safely extract position data from likely column names
        const rawPos: any = hero.main_position || (hero as any).position || (hero as any).positions;

        // 3. If no data, exclude
        if (!rawPos) return false;

        // 4. Check Logic
        // Case A: It's an actual Array (e.g. ['Abyssal', 'Jungle'])
        if (Array.isArray(rawPos)) {
            // Check for partial match to handle 'Abyssal' vs 'Abyssal Dragon'
            return rawPos.some((p: any) => typeof p === 'string' && p.toLowerCase().includes(filter.toLowerCase()));
        }

        // Case B: It's a String (e.g. "Abyssal" or "['Abyssal']")
        if (typeof rawPos === 'string') {
            // Simple include check is safest for mixed formats
            return rawPos.toLowerCase().includes(filter.toLowerCase());
        }

        return false;
    });

    useEffect(() => {
        if (selectedVersionId) {
            startTransition(async () => {
                const data = await getHeroesByVersion(selectedVersionId)
                // Casting data to any to avoid strict typing issues with the join for this demo
                setHeroes(data as any[])
            })
        }
    }, [selectedVersionId])

    const handleCreateSubmit = async (formData: FormData) => {
        if (!uploadedImageUrl) {
            alert("Please upload an icon first.")
            return
        }

        formData.append('version_id', selectedVersionId.toString())
        formData.append('icon_url', uploadedImageUrl)
        formData.append('main_position', JSON.stringify(positions))

        const result = await createHero(null, formData)
        if (result.success) {
            setIsModalOpen(false)
            setUploadedImageUrl('')
            setPositions([])
            // Refresh list
            const data = await getHeroesByVersion(selectedVersionId)
            setHeroes(data as any[])
        } else {
            alert(result.message)
        }
    }

    const togglePosition = (pos: string) => {
        setPositions(prev => prev.includes(pos) ? prev.filter(p => p !== pos) : [...prev, pos])
    }

    // Excel Logic
    const handleExport = () => {
        const data = heroes.map(h => {
            const stats = Array.isArray(h.hero_stats) ? h.hero_stats[0] : h.hero_stats;
            return {
                Name: h.name,
                IconURL: h.icon_url,
                DamageType: h.damage_type,
                Position: h.main_position.join(', '),
                PowerSpike: stats?.power_spike || 'Balanced',
                // Tier removed from export
            }
        })

        const ws = XLSX.utils.json_to_sheet(data)
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, "Heroes")

        const versionName = initialVersions.find(v => v.id === selectedVersionId)?.name || 'Version'
        XLSX.writeFile(wb, `RoV_Heroes_${versionName.replace(/\s+/g, '_')}.xlsx`)
    }

    const handleImportClick = () => {
        document.getElementById('excel-upload')?.click()
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        const reader = new FileReader()
        reader.onload = async (evt) => {
            const bstr = evt.target?.result
            const wb = XLSX.read(bstr, { type: 'binary' })
            const wsname = wb.SheetNames[0]
            const ws = wb.Sheets[wsname]
            const rawData = XLSX.utils.sheet_to_json(ws)
            // Sanitize data to ensure strictly plain objects causing Next.js serialization error
            const data = JSON.parse(JSON.stringify(rawData))

            if (confirm(`Ready to import ${data.length} heroes?`)) {
                const result = await bulkImportHeroes(selectedVersionId, data)
                alert(result.message)
                if (result.success) {
                    const newData = await getHeroesByVersion(selectedVersionId)
                    setHeroes(newData as any[])
                }
            }
        }
        reader.readAsBinaryString(file)
        // Reset input
        e.target.value = ''
    }

    return (
        <div className="space-y-8">
            {/* Header & Controls */}
            <div className="glass-card p-6 flex flex-col md:flex-row items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">Hero Roster</h1>
                    <p className="text-text-muted mt-1">Manage heroes for the selected patch.</p>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
                    <div className="flex items-center gap-2">
                        <div className="relative">
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
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleExport}
                            className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm text-text-muted transition-colors flex items-center gap-2"
                            title="Export to Excel"
                        >
                            <Download size={18} /> Export
                        </button>
                        <button
                            onClick={handleImportClick}
                            className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm text-text-muted transition-colors flex items-center gap-2"
                            title="Import from Excel"
                        >
                            <FileSpreadsheet size={18} /> Import
                        </button>
                        <input
                            type="file"
                            id="excel-upload"
                            hidden
                            accept=".xlsx, .xls"
                            onChange={handleFileChange}
                        />
                    </div>

                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="glow-button px-6 py-2 rounded-lg flex items-center gap-2 whitespace-nowrap"
                    >
                        <Plus size={20} /> Add Hero
                    </button>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="flex flex-wrap gap-2">
                {POSITIONS.map(pos => (
                    <button
                        key={pos}
                        onClick={() => setFilter(pos)}
                        className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${filter === pos
                            ? 'bg-purple-600 text-white shadow-[0_0_10px_rgba(147,51,234,0.5)]'
                            : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                            }`}
                    >
                        {pos}
                    </button>
                ))}
            </div>

            {/* Content: Hero Grid */}
            <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-12 lg:grid-cols-14 xl:grid-cols-[repeat(18,minmax(0,1fr))] gap-1">
                {isPending ? (
                    <div className="col-span-full text-center py-20 text-text-muted">Loading heroes...</div>
                ) : filteredHeroes.length === 0 ? (
                    <div className="col-span-full text-center py-20 glass-card bg-surface/30 border-dashed border-2 border-white/5">
                        <Users size={48} className="mx-auto mb-4 text-white/20" />
                        <p className="text-text-muted">No heroes found for this version.</p>
                    </div>
                ) : (
                    filteredHeroes.map((hero) => {
                        // Extract stats safely (it might be an array or object depending on Supabase client return)
                        const stats = Array.isArray(hero.hero_stats) ? hero.hero_stats[0] : hero.hero_stats;
                        const tier = stats?.tier || '?';

                        return (
                            <Link href={`/admin/heroes/${hero.name}`} key={hero.id} className="block group relative">
                                <div className="glass-card p-0 overflow-hidden flex flex-col items-center relative hover:bg-surface-highlight transition-all group-hover:shadow-[0_0_20px_rgba(168,85,247,0.3)] border-primary/20 group-hover:border-primary/50">
                                    <div className="relative w-full aspect-square border-b border-white/5 group-hover:border-primary/30 transition-all">
                                        {hero.icon_url && hero.icon_url.trim() !== '' ? (
                                            <Image
                                                src={hero.icon_url}
                                                alt={hero.name}
                                                fill
                                                className="object-cover transition-transform duration-500 group-hover:scale-110"
                                                sizes="(max-width: 768px) 33vw, 20vw"
                                            />
                                        ) : (
                                            <div className="w-full h-full bg-slate-800 flex items-center justify-center">
                                                <span className="text-4xl font-bold text-gray-600 group-hover:text-primary transition-colors">{hero.name.charAt(0)}</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="text-center p-1 w-full absolute bottom-0 z-10">
                                        <h3 className="font-bold text-[10px] leading-tight text-white truncate drop-shadow-[0_1.2px_1.2px_rgba(0,0,0,0.8)]">
                                            {hero.name}
                                        </h3>
                                    </div>
                                </div>
                            </Link>
                        )
                    })
                )}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="glass-card w-full max-w-2xl max-h-[90vh] overflow-y-auto outline-none shadow-2xl animate-in zoom-in-95 duration-200 relative">
                        <button
                            onClick={() => setIsModalOpen(false)}
                            className="absolute top-4 right-4 text-text-muted hover:text-white transition-colors"
                        >
                            <X size={24} />
                        </button>

                        <div className="p-6 border-b border-white/10">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <Shield className="text-primary" /> Add New Hero
                            </h2>
                            <p className="text-sm text-text-muted">Adding to version: <span className="text-accent">{initialVersions.find(v => v.id === selectedVersionId)?.name}</span></p>
                        </div>

                        <form action={handleCreateSubmit} className="p-6 space-y-6">
                            {/* Image Upload */}
                            <div className="flex flex-col items-center justify-center pb-4 border-b border-white/5">
                                <div className="relative w-24 h-24 mb-4 rounded-full overflow-hidden border-2 border-dashed border-white/20 bg-black/20 flex items-center justify-center group">
                                    {uploadedImageUrl ? (
                                        <Image src={uploadedImageUrl} alt="Preview" fill className="object-cover" />
                                    ) : (
                                        <Upload className="text-white/40" />
                                    )}
                                </div>
                                <CldUploadButton
                                    uploadPreset={process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || "ml_default"}
                                    onSuccess={(result: any) => setUploadedImageUrl(result.info.secure_url)}
                                    className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-md text-sm text-text-muted transition-colors"
                                >
                                    {uploadedImageUrl ? 'Change Icon' : 'Upload Icon'}
                                </CldUploadButton>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Name */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-text-muted">Hero Name</label>
                                    <input name="name" required className="dark-input w-full" placeholder="e.g. Valhein" />
                                </div>

                                {/* Damage Type */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-text-muted">Damage Type</label>
                                    <select name="damage_type" className="dark-input w-full">
                                        <option value="Physical">Physical</option>
                                        <option value="Magic">Magic</option>
                                        <option value="True">True</option>
                                        <option value="Mixed">Mixed</option>
                                    </select>
                                </div>

                                {/* Positions */}
                                <div className="col-span-full space-y-2">
                                    <label className="text-sm font-medium text-text-muted">Positions</label>
                                    <div className="flex flex-wrap gap-2">
                                        {['Dark Slayer', 'Jungle', 'Mid', 'Abyssal Dragon', 'Roam'].map(pos => (
                                            <button
                                                key={pos}
                                                type="button"
                                                onClick={() => togglePosition(pos)}
                                                className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-all ${positions.includes(pos)
                                                    ? 'bg-primary/20 border-primary text-primary'
                                                    : 'bg-white/5 border-white/10 text-text-muted hover:bg-white/10'
                                                    }`}
                                            >
                                                {pos}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Version Stats */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-text-muted">Power Spike <span className="text-xs text-accent">(This Patch)</span></label>
                                    <select name="power_spike" className="dark-input w-full">
                                        <option value="Early">Early Game</option>
                                        <option value="Mid">Mid Game</option>
                                        <option value="Late">Late Game</option>
                                        <option value="Balanced">Balanced</option>
                                    </select>
                                </div>
                                {/* Tier removed */}
                            </div>

                            <div className="pt-4 border-t border-white/10 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 text-sm text-text-muted hover:text-white transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="glow-button px-6 py-2 rounded-lg text-sm"
                                >
                                    Save Hero
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
