import AdminLayoutWrapper from '@/components/admin/AdminLayout'

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <AdminLayoutWrapper>
            {children}
        </AdminLayoutWrapper>
    )
}
