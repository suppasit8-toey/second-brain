import AdminLayoutWrapper from '@/components/admin/AdminLayout'
import { UIProvider } from '@/context/UIContext'

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <UIProvider>
            <AdminLayoutWrapper>
                {children}
            </AdminLayoutWrapper>
        </UIProvider>
    )
}
