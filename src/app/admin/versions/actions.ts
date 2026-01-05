'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

// 1. Action to Create a New Version
export async function createVersion(prevState: any, formData: FormData) {
    const supabase = await createClient()
    const name = formData.get('name') as string
    const startDate = formData.get('start_date') as string

    if (!name || !startDate) {
        return { message: 'Please fill in all fields', success: false }
    }

    const { error } = await supabase
        .from('versions')
        .insert([{ name, start_date: startDate, is_active: false }])

    if (error) {
        return { message: 'Error creating version: ' + error.message, success: false }
    }

    revalidatePath('/admin/versions')
    return { message: 'Version created successfully!', success: true }
}

// 2. Action to Activate a Version (and deactivate others)
export async function activateVersion(versionId: number) {
    const supabase = await createClient()

    // Step A: Set all versions to inactive
    await supabase.from('versions').update({ is_active: false }).neq('id', 0)

    // Step B: Set the selected version to active
    const { error } = await supabase
        .from('versions')
        .update({ is_active: true })
        .eq('id', versionId)

    if (error) {
        console.error('Error activating version:', error)
        return
    }

    revalidatePath('/admin/versions')
}
