// Shared color label model for transfers and items.
// Values: 0 (none), 1, 2, 3, 4. Clicking a row's label cycles 0 → 1 → 2 → 3 → 4 → 0.

export interface LabelDef {
  value: number
  name: string
  // Tailwind background class for the colored chip
  bg: string
  // Border class — used by value 0 (the empty/dashed look)
  border?: string
}

export const LABELS: LabelDef[] = [
  { value: 0, name: "Չկա",       bg: "bg-transparent", border: "border border-dashed border-muted-foreground/40" },
  { value: 1, name: "Կարմիր",   bg: "bg-red-500" },
  { value: 2, name: "Նարնջագույն", bg: "bg-amber-500" },
  { value: 3, name: "Կանաչ",    bg: "bg-emerald-500" },
  { value: 4, name: "Կապույտ",  bg: "bg-blue-500" },
]

export const LABEL_BY_VALUE = new Map(LABELS.map((l) => [l.value, l]))

export function getLabel(v: number | null | undefined): LabelDef {
  return LABEL_BY_VALUE.get(v ?? 0) || LABELS[0]
}

export function nextLabel(v: number | null | undefined): number {
  const n = ((v ?? 0) + 1) % LABELS.length
  return n
}
