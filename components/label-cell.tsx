"use client"

import { cn } from "@/lib/utils"
import { getLabel, nextLabel } from "@/lib/utils/labels"

interface LabelCellProps {
  value: number | null | undefined
  onChange: (next: number) => void
  disabled?: boolean
  size?: "sm" | "md"
  className?: string
}

// Small colored chip in a table cell. Click cycles 0 → 1 → 2 → 3 → 4 → 0.
export function LabelCell({ value, onChange, disabled, size = "sm", className }: LabelCellProps) {
  const label = getLabel(value)
  const dim = size === "sm" ? "h-4 w-4" : "h-5 w-5"
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        if (disabled) return
        onChange(nextLabel(value))
      }}
      title={label.name}
      aria-label={`Պիտակ՝ ${label.name}`}
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center rounded-full transition-transform hover:scale-110 disabled:opacity-50",
        dim,
        label.bg,
        label.border,
        className
      )}
    />
  )
}
