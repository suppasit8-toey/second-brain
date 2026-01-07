export function formatDate(dateStr: string | Date): string {
    const date = new Date(dateStr)
    return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    }).format(date)
}
