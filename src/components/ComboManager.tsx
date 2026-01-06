'use client'

import { useState, useEffect, useTransition } from 'react'
import { Version, Hero, POSITIONS, HeroCombo } from '@/utils/types'
import { getHeroesByVersion } from '@/app/admin/heroes/actions'
import { getCombos, saveCombo, deleteCombo, updateCombo } from '@/app/admin/combos/actions'
import { Plus, Link as LinkIcon, Handshake, Trash2, Edit2, SlidersHorizontal, X } from 'lucide-react'
import Image from 'next/image'
import { ConfigProvider, theme, Card, Select, Segmented, Button, Input, Avatar, Space, message, Modal } from 'antd'

interface ComboManagerProps {
    initialVersions: Version[];
}

const { Option } = Select;
const { TextArea } = Input;

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

    const getHeroPositions = (hero: Hero | null): string[] => {
        if (!hero) return []
        let posData = (hero as any).position || hero.main_position || []
        if (typeof posData === 'string') {
            try { posData = JSON.parse(posData) } catch { posData = [posData] }
        }
        if (!Array.isArray(posData)) posData = [posData]
        return posData
    }

    const handleSetHeroA = (heroId: string) => {
        const hero = heroes.find(h => h.id === heroId) || null
        setHeroA(hero)
        if (hero) {
            const validPositions = getHeroPositions(hero)
            if (validPositions.length === 1) {
                setPositionA(validPositions[0])
            } else {
                setPositionA('')
            }
        } else {
            setPositionA('')
        }
    }

    const handleSetHeroB = (heroId: string) => {
        const hero = heroes.find(h => h.id === heroId) || null
        setHeroB(hero)
        if (hero) {
            const validPositions = getHeroPositions(hero)
            if (validPositions.length === 1) {
                setPositionB(validPositions[0])
            } else {
                setPositionB('')
            }
        } else {
            setPositionB('')
        }
    }

    const handleSave = async () => {
        if (!heroA || !heroB || ((!positionA || !positionB) && !ignorePosition)) {
            message.error("Please select both heroes and their positions.")
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
                message.success("Combo updated successfully")
            } else {
                message.error("Error updating combo: " + res.message)
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
            message.success("Combo saved successfully")
        } else {
            message.error("Error: " + res.message)
        }
    }

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation()
        Modal.confirm({
            title: 'Delete Combo',
            content: 'Are you sure you want to delete this combo?',
            onOk: async () => {
                const res = await deleteCombo(id)
                if (res.success) {
                    setCombos(prev => prev.filter(c => c.id !== id))
                    message.success("Combo deleted")
                } else {
                    message.error("Error deleting combo")
                }
            }
        })
    }

    // --- DERIVED STATE ---

    // Check for same position conflict
    const isSamePosition = !ignorePosition && !!(positionA && positionB && positionA === positionB)

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

    const sortedHeroes = [...heroes].sort((a, b) => a.name.localeCompare(b.name))

    // Shorten position names for segmented control
    const formatPosition = (pos: string) => pos.replace(' Dragon', '').replace('Lane', '').trim()

    // --- RENDER ---

    return (
        <ConfigProvider theme={{ algorithm: theme.darkAlgorithm }}>
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
                            <SlidersHorizontal size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
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
                <Modal
                    open={isModalOpen}
                    onCancel={() => setIsModalOpen(false)}
                    footer={null}
                    closable={false}
                    centered
                    width={450} // Mobile-first narrow width
                    className="modal-glass"
                    style={{ padding: 0 }}
                    styles={{ body: { padding: 0, overflow: 'hidden' } }}
                >
                    <div className="flex flex-col h-[85vh] md:h-auto">
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-white/5">
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                {editingComboId ? <Edit2 size={18} className="text-primary" /> : <Plus size={18} className="text-primary" />}
                                {editingComboId ? 'Edit Combo' : 'New Combo'}
                            </h2>
                            <Button type="text" icon={<X size={20} />} onClick={() => setIsModalOpen(false)} className="text-white/50 hover:text-white" />
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-6">
                            {/* HERO A BLOCK */}
                            <Card size="small" bordered={false} className="bg-white/5 border border-white/10">
                                <Space direction="vertical" style={{ width: '100%' }} size="small">
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center text-xs font-bold text-white">A</div>
                                        <span className="text-sm font-bold text-primary">Hero A</span>
                                    </div>
                                    <Select
                                        showSearch
                                        placeholder="Select Hero A"
                                        style={{ width: '100%' }}
                                        value={heroA?.id}
                                        onChange={handleSetHeroA}
                                        optionLabelProp="label"
                                        filterOption={(input, option) =>
                                            ((option as any)?.name ?? '').toLowerCase().includes(input.toLowerCase())
                                        }
                                        options={sortedHeroes.filter(h => h.id !== heroB?.id).map(h => ({
                                            value: h.id,
                                            label: (
                                                <div className="flex items-center gap-2">
                                                    <Avatar src={h.icon_url} size="small" shape="square" />
                                                    <span className="font-medium">{h.name}</span>
                                                </div>
                                            ),
                                            name: h.name, // Used for search filtering
                                        }))}
                                        className="custom-select-hero"
                                    />

                                    {/* Position A */}
                                    {heroA && !ignorePosition && (
                                        <div className="animate-in fade-in slide-in-from-top-2 pt-2">
                                            <div className="text-xs text-text-muted mb-1.5 ml-1">Position</div>
                                            <Segmented
                                                block
                                                options={getHeroPositions(heroA).length > 0 ? getHeroPositions(heroA).map(p => ({
                                                    label: formatPosition(p),
                                                    value: p,
                                                    disabled: p === positionB
                                                })) : POSITIONS.map(p => ({ label: formatPosition(p), value: p }))} // Fallback if no positions found
                                                value={positionA}
                                                onChange={setPositionA}
                                                className="bg-slate-900"
                                            />
                                        </div>
                                    )}
                                </Space>
                            </Card>

                            {/* LINK ICON */}
                            <div className="flex justify-center -my-3 relative z-10">
                                <div className="bg-slate-800 p-1.5 rounded-full border border-white/10 shadow-lg">
                                    <LinkIcon size={16} className="text-text-muted rotate-45" />
                                </div>
                            </div>

                            {/* HERO B BLOCK */}
                            <Card size="small" bordered={false} className="bg-white/5 border border-white/10">
                                <Space direction="vertical" style={{ width: '100%' }} size="small">
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center text-xs font-bold text-white">B</div>
                                        <span className="text-sm font-bold text-blue-400">Hero B</span>
                                    </div>
                                    <Select
                                        showSearch
                                        placeholder="Select Hero B"
                                        style={{ width: '100%' }}
                                        value={heroB?.id}
                                        onChange={handleSetHeroB}
                                        optionLabelProp="label"
                                        filterOption={(input, option) =>
                                            ((option as any)?.name ?? '').toLowerCase().includes(input.toLowerCase())
                                        }
                                        options={sortedHeroes.filter(h => h.id !== heroA?.id).map(h => ({
                                            value: h.id,
                                            label: (
                                                <div className="flex items-center gap-2">
                                                    <Avatar src={h.icon_url} size="small" shape="square" />
                                                    <span className="font-medium">{h.name}</span>
                                                </div>
                                            ),
                                            name: h.name, // Used for search filtering
                                        }))}
                                        className="custom-select-hero"
                                    />

                                    {/* Position B */}
                                    {heroB && !ignorePosition && (
                                        <div className="animate-in fade-in slide-in-from-top-2 pt-2">
                                            <div className="text-xs text-text-muted mb-1.5 ml-1">Position</div>
                                            <Segmented
                                                block
                                                options={getHeroPositions(heroB).length > 0 ? getHeroPositions(heroB).map(p => ({
                                                    label: formatPosition(p),
                                                    value: p,
                                                    disabled: p === positionA
                                                })) : POSITIONS.map(p => ({ label: formatPosition(p), value: p }))} // Fallback
                                                value={positionB}
                                                onChange={setPositionB}
                                                className="bg-slate-900"
                                            />
                                        </div>
                                    )}
                                </Space>
                            </Card>

                            {/* EXTRAS */}
                            <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-bold text-text-muted uppercase">Description / Analysis</span>
                                    <Button
                                        size="small"
                                        type={ignorePosition ? 'primary' : 'default'}
                                        onClick={() => setIgnorePosition(!ignorePosition)}
                                        className="text-xs h-6"
                                    >
                                        Ignore Positions
                                    </Button>
                                </div>
                                <TextArea
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    placeholder="Enter combo analysis or synergy notes..."
                                    autoSize={{ minRows: 2, maxRows: 4 }}
                                    className="!bg-slate-900 !border-slate-800 !text-white text-sm"
                                />
                            </div>

                            {/* WARNINGS */}
                            {isSamePosition && (
                                <div className="bg-red-900/20 text-red-300 text-xs p-2 rounded border border-red-900/50 text-center">
                                    Warning: Both heroes cannot handle the same position.
                                </div>
                            )}
                            {isDuplicate && (
                                <div className="bg-yellow-900/20 text-yellow-300 text-xs p-2 rounded border border-yellow-900/50 text-center">
                                    Notification: This combo pair already exists.
                                </div>
                            )}

                        </div>

                        {/* Footer Action */}
                        <div className="p-4 border-t border-white/10 bg-white/5">
                            <Button
                                type="primary"
                                block
                                size="large"
                                onClick={handleSave}
                                loading={isPending}
                                disabled={!heroA || !heroB || ((!positionA || !positionB) && !ignorePosition) || isDuplicate || isSamePosition}
                                className="bg-gradient-to-r from-primary to-accent border-0 hover:opacity-90 shadow-lg shadow-purple-900/20 font-bold"
                            >
                                {editingComboId ? 'Update Combo' : 'Save Combo Duo'}
                            </Button>
                        </div>
                    </div>
                </Modal>
            </div>
        </ConfigProvider>
    )
}
