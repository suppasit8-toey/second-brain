'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export async function login(prevState: any, formData: FormData) {
    const password = formData.get('password') as string
    const adminPassword = process.env.ADMIN_PASSWORD

    if (!adminPassword) {
        console.error('ERROR: ADMIN_PASSWORD environment variable is missing or empty.')
        return { success: false, message: 'Server Error: ADMIN_PASSWORD is not configured. Please redeploy.' }
    }

    if (password === adminPassword) {
        // Session cookie (expires when browser closes)
        const cookieStore = await cookies()
        cookieStore.set('admin_session', 'true', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
        })
        redirect('/admin/heroes')
    } else {
        return { success: false, message: 'Invalid Password' }
    }
}
