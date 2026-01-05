import { supabase } from '@/utils/supabase/client'
import VersionsPage from '@/components/VersionsPage'

export const dynamic = 'force-dynamic'

export default async function Page() {
    const { data: versions } = await supabase.from('versions').select('*').order('created_at', { ascending: false })

    return <VersionsPage versions={versions || []} />
}
