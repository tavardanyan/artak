"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export interface OversightPerson {
  name: string
  tin: string
  number: string
  director: string
  contact: string
}

export interface Oversight {
  technical: OversightPerson
  author: OversightPerson
}

export const EMPTY_OVERSIGHT_PERSON: OversightPerson = {
  name: "", tin: "", number: "", director: "", contact: "",
}

export const EMPTY_OVERSIGHT: Oversight = {
  technical: { ...EMPTY_OVERSIGHT_PERSON },
  author: { ...EMPTY_OVERSIGHT_PERSON },
}

// Normalize whatever's in the DB (null/partial object) into a complete shape
export function normalizeOversight(input: any): Oversight {
  const tech = input?.technical || {}
  const auth = input?.author || {}
  const pick = (o: any): OversightPerson => ({
    name: typeof o.name === "string" ? o.name : "",
    tin: typeof o.tin === "string" ? o.tin : "",
    number: typeof o.number === "string" ? o.number : "",
    director: typeof o.director === "string" ? o.director : "",
    contact: typeof o.contact === "string" ? o.contact : "",
  })
  return { technical: pick(tech), author: pick(auth) }
}

// If both blocks are entirely empty, return null so the DB stores NULL rather than
// {technical: {name:"", ...}, author: {name:"", ...}} noise.
export function oversightToStorage(o: Oversight): Oversight | null {
  const blank = (p: OversightPerson) => !p.name && !p.tin && !p.number && !p.director && !p.contact
  if (blank(o.technical) && blank(o.author)) return null
  return o
}

interface OversightPersonFieldsProps {
  value: OversightPerson
  onChange: (next: OversightPerson) => void
  idPrefix: string
}

function OversightPersonFields({ value, onChange, idPrefix }: OversightPersonFieldsProps) {
  const setField = (k: keyof OversightPerson) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...value, [k]: e.target.value })
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1.5 col-span-2">
        <Label htmlFor={`${idPrefix}-name`} className="text-xs">Անվանում</Label>
        <Input id={`${idPrefix}-name`} value={value.name} onChange={setField("name")} placeholder="Կազմակերպության անվանումը" className="h-9" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-tin`} className="text-xs">ՀՎՀՀ</Label>
        <Input id={`${idPrefix}-tin`} value={value.tin} onChange={setField("tin")} placeholder="ՀՎՀՀ" className="h-9 font-mono" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-number`} className="text-xs">Համար</Label>
        <Input id={`${idPrefix}-number`} value={value.number} onChange={setField("number")} placeholder="Լիցենզիայի համար" className="h-9" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-director`} className="text-xs">Տնօրեն</Label>
        <Input id={`${idPrefix}-director`} value={value.director} onChange={setField("director")} placeholder="Տնօրենի ա/ա" className="h-9" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-contact`} className="text-xs">Կոնտակտ</Label>
        <Input id={`${idPrefix}-contact`} value={value.contact} onChange={setField("contact")} placeholder="Հեռախոս / Էլ. փոստ" className="h-9" />
      </div>
    </div>
  )
}

interface ProjectOversightFieldsProps {
  value: Oversight
  onChange: (next: Oversight) => void
}

export function ProjectOversightFields({ value, onChange }: ProjectOversightFieldsProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h4 className="font-medium text-sm">Տեխնիկական հսկիչ</h4>
        <OversightPersonFields
          value={value.technical}
          onChange={(next) => onChange({ ...value, technical: next })}
          idPrefix="tech-oversight"
        />
      </div>

      <div className="space-y-3">
        <h4 className="font-medium text-sm">Հեղինակային հսկիչ</h4>
        <OversightPersonFields
          value={value.author}
          onChange={(next) => onChange({ ...value, author: next })}
          idPrefix="author-oversight"
        />
      </div>
    </div>
  )
}
