"use client";

import * as React from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

// --- Types ---

interface SelectContextType {
    value: string;
    onValueChange: (value: string) => void;
    open: boolean;
    setOpen: (open: boolean) => void;
}

const SelectContext = React.createContext<SelectContextType | undefined>(undefined);

// --- Components ---

interface SelectProps {
    value: string;
    onValueChange: (value: string) => void;
    children: React.ReactNode;
    width?: string;
    disabled?: boolean;
}

export function Select({ value, onValueChange, children, width = "w-full", disabled }: SelectProps) {
    const [open, setOpen] = React.useState(false);

    // Close on click outside
    const ref = React.useRef<HTMLDivElement>(null);
    React.useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (ref.current && !ref.current.contains(event.target as Node)) {
                setOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <SelectContext.Provider value={{ value, onValueChange, open, setOpen }}>
            <div ref={ref} className={cn("relative", width, disabled && "opacity-50 pointer-events-none")}>
                {children}
            </div>
        </SelectContext.Provider>
    );
}

interface SelectTriggerProps {
    children: React.ReactNode;
    className?: string;
}

export function SelectTrigger({ children, className }: SelectTriggerProps) {
    const context = React.useContext(SelectContext);
    if (!context) throw new Error("SelectTrigger must be used within a Select");

    return (
        <button
            type="button"
            onClick={() => context.setOpen(!context.open)}
            className={cn(
                "flex h-10 w-full items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all duration-200 hover:bg-white/10 hover:border-white/20",
                context.open && "ring-1 ring-blue-500 border-blue-500/50 bg-white/10",
                className
            )}
        >
            {children}
            <ChevronDown size={16} className={cn("ml-2 opacity-50 transition-transform duration-200", context.open && "rotate-180")} />
        </button>
    );
}

interface SelectValueProps {
    placeholder?: string;
    children?: React.ReactNode;
}

export function SelectValue({ placeholder, children }: SelectValueProps) {
    const context = React.useContext(SelectContext);
    if (!context) throw new Error("SelectValue must be used within a Select");

    // We can't easily find the label for the value without traversing children or passing options separately.
    // For a simple implementation, we assume the parent renders the text based on value, 
    // OR we can make SelectItem register itself. 
    // Simplest approach for this custom UI: The user of the component passes the display label as a child to SelectValue if they want,
    // OR more commonly in Radix: SelectValue displays the value or placeholder.
    // Let's rely on the consumer to pass the correct text node if it's complex, or we can try to find the label.
    // Actually, Radix SelectValue is smart. 
    // Let's do a simpler "dumb" display: The 'children' of SelectValue is what gets rendered.
    // BUT we need it to be dynamic.

    // REVISION: Let's follow a pattern where we just render the value directly if provided as children, otherwise placeholder.

    return (
        <span className="block truncate text-left pointer-events-none">
            {children || context.value || placeholder || "Select..."}
        </span>
    );
}

export function SelectContent({ children }: { children: React.ReactNode }) {
    const context = React.useContext(SelectContext);
    if (!context) throw new Error("SelectContent must be used within a Select");

    if (!context.open) return null;

    return (
        <div className="absolute top-full left-0 mt-1 w-full rounded-lg border border-white/10 bg-[#0A0A0A] p-1 shadow-2xl backdrop-blur-xl z-50 animate-in fade-in zoom-in-95 duration-100">
            {children}
        </div>
    );
}

interface SelectItemProps {
    value: string;
    children: React.ReactNode;
    className?: string;
}

export function SelectItem({ value, children, className }: SelectItemProps) {
    const context = React.useContext(SelectContext);
    if (!context) throw new Error("SelectItem must be used within a Select");

    const isSelected = context.value === value;

    return (
        <button
            type="button"
            onClick={() => {
                context.onValueChange(value);
                context.setOpen(false);
            }}
            className={cn(
                "relative flex w-full cursor-pointer select-none items-center rounded-md py-2.5 pl-8 pr-2 text-sm outline-none transition-colors hover:bg-white/10 hover:text-white",
                isSelected ? "text-white bg-white/5" : "text-gray-400",
                className
            )}
        >
            <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                {isSelected && <Check size={14} className="text-blue-400" />}
            </span>
            <span className="truncate">{children}</span>
        </button>
    );
}
