'use client'

import * as React from "react"

export function cn(...classes: (string | undefined | null | false)[]) {
    return classes.filter(Boolean).join(" ")
}

const RadioGroupContext = React.createContext<{ value: string; onValueChange: (val: string) => void } | null>(null);

const RadioGroup = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { value?: string, onValueChange?: (val: string) => void }>(
    ({ className, value, onValueChange, children, ...props }, ref) => {
        return (
            <RadioGroupContext.Provider value={{ value: value || "", onValueChange: onValueChange || (() => { }) }}>
                <div className={cn("grid gap-2", className)} ref={ref} {...props}>
                    {children}
                </div>
            </RadioGroupContext.Provider>
        )
    }
)
RadioGroup.displayName = "RadioGroup"

const RadioGroupItem = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { value: string }>(
    ({ className, value, ...props }, ref) => {
        const ctx = React.useContext(RadioGroupContext);
        const isActive = ctx?.value === value;

        return (
            <button
                ref={ref}
                type="button"
                role="radio"
                aria-checked={isActive}
                onClick={() => ctx?.onValueChange(value)}
                className={cn(
                    "aspect-square h-4 w-4 rounded-full border border-slate-900 text-slate-900 ring-offset-white focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-50 dark:text-slate-50 dark:ring-offset-slate-950 flex items-center justify-center",
                    className
                )}
                {...props}
            >
                {isActive && (
                    <div className="h-2.5 w-2.5 rounded-full bg-current" />
                )}
            </button>
        )
    }
)
RadioGroupItem.displayName = "RadioGroupItem"

export { RadioGroup, RadioGroupItem }
