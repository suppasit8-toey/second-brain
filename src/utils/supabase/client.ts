
import { createClient as createJsClient } from '@supabase/supabase-js'
import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createJsClient(supabaseUrl, supabaseAnonKey)

export function createClient() {
    return createBrowserClient(supabaseUrl, supabaseAnonKey)
}
