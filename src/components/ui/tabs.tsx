'use client'

import * as React from "react"

export function cn(...classes: (string | undefined | null | false)[]) {
    return classes.filter(Boolean).join(" ")
}

const TabsContext = React.createContext<{ value: string; onValueChange: (value: string) => void }>({
    value: "",
    onValueChange: () => { },
});

const Tabs = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { value?: string; defaultValue?: string; onValueChange?: (val: string) => void }>(
    ({ className, value: controlledValue, defaultValue, onValueChange, ...props }, ref) => {
        const [internalValue, setInternalValue] = React.useState(defaultValue || "")

        const isControlled = controlledValue !== undefined
        const value = isControlled ? controlledValue : internalValue

        const handleValueChange = (newValue: string) => {
            if (onValueChange) {
                onValueChange(newValue)
            }
            if (!isControlled) {
                setInternalValue(newValue)
            }
        }

        return (
            <TabsContext.Provider value={{ value: value || "", onValueChange: handleValueChange }}>
                <div ref={ref} className={cn("", className)} {...props} />
            </TabsContext.Provider>
        )
    }
)
Tabs.displayName = "Tabs"

const TabsList = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
    <div ref={ref} className={cn("inline-flex h-10 items-center justify-center rounded-md bg-slate-100 p-1 text-slate-500 dark:bg-slate-800 dark:text-slate-400", className)} {...props} />
))
TabsList.displayName = "TabsList"

const TabsTrigger = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { value: string }>(
    ({ className, value, onClick, ...props }, ref) => {
        const context = React.useContext(TabsContext);
        const isActive = context.value === value;
        return (
            <button
                ref={ref}
                onClick={(e) => {
                    context.onValueChange(value);
                    onClick?.(e);
                }}
                className={cn(
                    "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
                    isActive && "bg-white text-slate-950 shadow-sm dark:bg-slate-950 dark:text-slate-50",
                    className
                )}
                {...props}
            />
        )
    }
)
TabsTrigger.displayName = "TabsTrigger"

const TabsContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { value: string }>(
    ({ className, value, ...props }, ref) => {
        const context = React.useContext(TabsContext);
        if (context.value !== value) return null;
        return (
            <div ref={ref} className={cn("mt-2 ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2", className)} {...props} />
        )
    }
)
TabsContent.displayName = "TabsContent"

export { Tabs, TabsList, TabsTrigger, TabsContent }
