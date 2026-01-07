'use client'

import * as React from "react"

export function cn(...classes: (string | undefined | null | false)[]) {
    return classes.filter(Boolean).join(" ")
}

// Simplified Select using standard HTML Select underneath or simple simulation. 
// Given the need for shadcn compatibility which composes parts, we will simulate the parts but maybe use simple state.

interface SelectContextProps {
    value: string;
    onValueChange: (val: string) => void;
    open: boolean;
    setOpen: (open: boolean) => void;
}
const SelectContext = React.createContext<SelectContextProps | null>(null);

const Select = ({ value, onValueChange, defaultValue, children }: { value?: string, onValueChange?: (val: string) => void, defaultValue?: string, children: React.ReactNode }) => {
    const [internalValue, setInternalValue] = React.useState(defaultValue || "");
    const [open, setOpen] = React.useState(false);

    // Controlled vs Uncontrolled logic (simplified)
    const activeValue = value !== undefined ? value : internalValue;
    const setActiveValue = onValueChange || setInternalValue;

    return (
        <SelectContext.Provider value={{ value: activeValue, onValueChange: setActiveValue, open, setOpen }}>
            <div className="relative">{children}</div>
        </SelectContext.Provider>
    )
}

const SelectTrigger = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
    ({ className, children, ...props }, ref) => {
        const ctx = React.useContext(SelectContext);
        return (
            <button
                ref={ref}
                type="button"
                onClick={() => ctx?.setOpen(!ctx.open)}
                className={cn(
                    "flex h-10 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:ring-offset-slate-950 dark:placeholder:text-slate-400 dark:focus:ring-slate-300",
                    className
                )}
                {...props}
            >
                {children}
            </button>
        )
    }
)
SelectTrigger.displayName = "SelectTrigger"

const SelectValue = React.forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement> & { placeholder?: string }>(
    ({ className, placeholder, ...props }, ref) => {
        const ctx = React.useContext(SelectContext);
        // We'd need to find the label for the value. For this simplified mock, we might just show the value or rely on the user passing text.
        // Actually, for a mock, let's just show the value. Real shadcn finds the child text. 
        // We will assume the use of this component corresponds to simple value display.
        return <span ref={ref} className={className} {...props}>{ctx?.value || placeholder}</span>
    }
)
SelectValue.displayName = "SelectValue"

const SelectContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, children, ...props }, ref) => {
        const ctx = React.useContext(SelectContext);
        if (!ctx?.open) return null;

        return (
            <div
                ref={ref}
                className={cn("absolute z-50 min-w-[8rem] overflow-hidden rounded-md border border-slate-200 bg-white text-slate-950 shadow-md animate-in fade-in-80 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-50 top-full mt-1 w-full", className)}
                {...props}
            >
                <div className="p-1">{children}</div>
            </div>
        )
    }
)
SelectContent.displayName = "SelectContent"

const SelectItem = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { value: string; disabled?: boolean }>(
    ({ className, children, value, disabled, onClick, ...props }, ref) => {
        const ctx = React.useContext(SelectContext);
        const isActive = ctx?.value === value;
        return (
            <div
                ref={ref}
                data-disabled={disabled}
                onClick={(e) => {
                    if (disabled) return;
                    ctx?.onValueChange(value);
                    ctx?.setOpen(false);
                    onClick?.(e);
                }}
                className={cn(
                    "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-slate-100 focus:text-slate-900 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 dark:focus:bg-slate-800 dark:focus:text-slate-50 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer",
                    isActive && "bg-slate-100 dark:bg-slate-800",
                    className
                )}
                {...props}
            >
                {isActive && (
                    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                        ✓
                    </span>
                )}
                {children}
            </div>
        )
    }
)
SelectItem.displayName = "SelectItem"

export { Select, SelectTrigger, SelectValue, SelectContent, SelectItem }
