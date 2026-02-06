'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function getVersions() {
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('versions')
        .select('*')
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching versions:', error)
        return []
    }
    return data
}

export async function getHeroesByVersion(versionId: number) {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('heroes')
        .select(`
      *,
      hero_stats!inner (
        power_spike,
        win_rate,
        tier,
        version_id
      )
    `)
        .eq('hero_stats.version_id', versionId)
        .order('name')

    if (error) {
        console.error('Error fetching heroes:', error)
        return []
    }
    return data
}

export async function getAllHeroes() {
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('heroes')
        .select('*')
        .order('name')

    if (error) {
        console.error('Error fetching all heroes:', error)
        return []
    }
    return data
}

export async function addHero(prevState: any, formData: FormData) {
    const supabase = await createClient()

    const name = formData.get('name') as string
    const icon_url = formData.get('icon_url') as string
    const damage_type = formData.get('damage_type') as string

    // Correctly handle multiple checkboxes
    const main_position = formData.getAll('main_position')

    // Use let for version_id to allow fallback
    let version_id = formData.get('version_id') as string
    const power_spike = formData.get('power_spike') as string

    // Fallback: Fetch active version if missing
    if (!version_id) {
        const { data: activeVersion } = await supabase
            .from('versions')
            .select('id')
            .eq('is_active', true)
            .single()

        if (activeVersion) {
            version_id = activeVersion.id.toString()
        }
    }

    if (!name || !icon_url || !version_id) {
        return { message: 'Missing required fields (Name, Icon, or Active Version)', success: false }
    }

    // 1. Insert Hero
    const { data: heroData, error: heroError } = await supabase
        .from('heroes')
        .insert([{ name, icon_url, damage_type, main_position }])
        .select()
        .single()

    if (heroError) {
        return { message: 'Error creating hero: ' + heroError.message, success: false }
    }

    // 2. Insert Stats
    const { error: statsError } = await supabase
        .from('hero_stats')
        .insert([{
            hero_id: heroData.id,
            version_id: parseInt(version_id),
            power_spike: power_spike || 'Balanced',
            win_rate: 50
        }])

    if (statsError) {
        return { message: 'Error creating stats: ' + statsError.message, success: false }
    }

    revalidatePath('/admin/heroes')
    return { message: 'Hero created successfully!', success: true }
}

export async function bulkImportHeroes(versionId: number, heroesData: any[]) {
    const supabase = await createClient()
    let successCount = 0
    let errors: string[] = []

    const findValue = (row: any, searchKeys: string[]) => {
        const normalizedRowKeys = Object.keys(row).reduce((acc, key) => {
            acc[key.toLowerCase().replace(/\s/g, '')] = row[key];
            return acc;
        }, {} as any);

        for (const key of searchKeys) {
            const normalizedSearch = key.toLowerCase().replace(/\s/g, '');
            if (normalizedRowKeys[normalizedSearch] !== undefined) {
                return normalizedRowKeys[normalizedSearch];
            }
        }
        return null;
    }

    for (let i = 0; i < heroesData.length; i++) {
        const row = heroesData[i];
        const name = findValue(row, ['Name', 'Hero Name', 'name']);

        if (!name) {
            errors.push(`Row ${i + 2}: Missing 'Name'`);
            continue;
        }

        const icon_url = findValue(row, ['IconURL', 'Icon URL', 'icon']) || '';
        const damage_type = findValue(row, ['DamageType', 'Damage Type', 'damage']) || 'Physical';
        const position_str = findValue(row, ['Position', 'Positions', 'role']) || 'Mid';
        const power_spike = findValue(row, ['PowerSpike', 'Power Spike', 'power']) || 'Balanced';

        const { data: existingHero } = await supabase
            .from('heroes')
            .select('id')
            .ilike('name', name)
            .single()

        let heroId = existingHero?.id

        if (!heroId) {
            const { data: newHero, error: createError } = await supabase
                .from('heroes')
                .insert([{
                    name: name,
                    icon_url: icon_url,
                    damage_type: damage_type,
                    main_position: position_str ? position_str.split(',').map((p: string) => p.trim()) : []
                }])
                .select()
                .single()

            if (createError) {
                errors.push(`Row ${i + 2}: Failed to create ${name}: ${createError.message}`)
                continue
            }
            heroId = newHero.id
        }

        const { error: statsError } = await supabase
            .from('hero_stats')
            .upsert({
                hero_id: heroId,
                version_id: versionId,
                power_spike: power_spike,
                win_rate: 50
            }, { onConflict: 'hero_id, version_id' })

        if (statsError) {
            errors.push(`Row ${i + 2}: Failed to update stats for ${name}: ${statsError.message}`)
        } else {
            successCount++
        }
    }

    revalidatePath('/admin/heroes')
    return {
        success: successCount > 0,
        message: `Imported ${successCount} heroes. ${errors.length > 0 ? `Errors: ${errors.length}` : ''}`,
        count: successCount,
        errors: errors.length > 0 ? errors : undefined
    }
}

export async function updateHero(formData: FormData) {
    const supabase = await createClient()

    const heroId = formData.get('id')
    const versionId = formData.get('version_id')
    const oldName = formData.get('old_name') as string
    const name = formData.get('name') as string
    const icon_url = formData.get('icon_url')
    const damage_type = formData.get('damage_type')
    const positions = formData.getAll('positions')
    const power_spike = formData.get('power_spike')

    const { error: heroError } = await supabase
        .from('heroes')
        .update({
            name,
            icon_url,
            damage_type,
            main_position: positions
        })
        .eq('id', heroId)

    if (heroError) {
        return { success: false, message: heroError.message }
    }

    if (versionId) {
        const { error: statsError } = await supabase
            .from('hero_stats')
            .upsert({
                hero_id: heroId,
                version_id: parseInt(versionId as string),
                power_spike: power_spike || 'Balanced'
            }, { onConflict: 'hero_id, version_id' })

        if (statsError) {
            return { success: false, message: statsError.message }
        }
    }

    if (name !== oldName) {
        redirect(`/admin/heroes/${encodeURIComponent(name)}`)
    }

    revalidatePath(`/admin/heroes/${name}`)
    revalidatePath('/admin/heroes')

    return { success: true, message: 'Updated successfully' }
}

// ALIAS TO FIX IMPORT ERRORS
export const createHero = addHero;
