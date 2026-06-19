"use client"

import { cn } from "@/lib/utils"
import { LABELS } from "@/lib/utils/labels"

interface LabelFilterProps {
  value: number | null   // null = "Բոլորը" (show all)
  onChange: (next: number | null) => void
  className?: string
}

// Row of colored dots above a table for filtering by label.
// "Բոլորը" disables the filter; clicking a dot filters to that label;
// clicking the same dot again clears the filter.
export function LabelFilter({ value, onChange, className }: LabelFilterProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <button
        type="button"
        onClick={() => onChange(null)}
        className={cn(
          "px-2.5 py-1 text-xs rounded-md border transition-colors",
          value === null ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
        )}
      >
        Բոլորը
      </button>
      {LABELS.map((l) => (
        <button
          key={l.value}
          type="button"
          onClick={() => onChange(value === l.value ? null : l.value)}
          title={l.name}
          aria-label={`Զտել ըստ՝ ${l.name}`}
          className={cn(
            "h-5 w-5 rounded-full transition-all",
            l.bg,
            l.border,
            value === l.value ? "ring-2 ring-offset-2 ring-foreground/40 scale-110" : "hover:scale-110"
          )}
        />
      ))}
    </div>
  )
}
