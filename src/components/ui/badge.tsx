import * as React from "react"

export function cn(...classes: (string | undefined | null | false)[]) {
    return classes.filter(Boolean).join(" ")
}

const Badge = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { variant?: 'default' | 'secondary' | 'outline' | 'destructive' }>(
    ({ className, variant = "default", ...props }, ref) => {
        const variants = {
            default: "border-transparent bg-slate-900 text-slate-50 hover:bg-slate-900/80",
            secondary: "border-transparent bg-slate-100 text-slate-900 hover:bg-slate-100/80 dark:bg-slate-800 dark:text-slate-50 dark:hover:bg-slate-800/80",
            destructive: "border-transparent bg-red-500 text-slate-50 hover:bg-red-500/80",
            outline: "text-slate-950 dark:text-slate-50",
        }
        return (
            <div ref={ref} className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2", variants[variant], className)} {...props} />
        )
    }
)
Badge.displayName = "Badge"
export { Badge }
