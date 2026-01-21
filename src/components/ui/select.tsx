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
                    "flex h-10 w-full items-center justify-between rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm ring-offset-slate-950 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
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
    ({ className, placeholder, children, ...props }, ref) => {
        const ctx = React.useContext(SelectContext);
        return <span ref={ref} className={className} {...props}>{children || ctx?.value || placeholder}</span>
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
                className={cn("absolute z-50 min-w-[8rem] overflow-hidden rounded-md border border-slate-800 bg-slate-950 text-slate-50 shadow-md animate-in fade-in-80 top-full mt-1 w-full", className)}
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
                    "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-slate-800 focus:text-slate-50 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 hover:bg-slate-800 cursor-pointer",
                    isActive && "bg-slate-800",
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
