import { SupabaseClient } from "@supabase/supabase-js"

export type PersonPositionType = "staff" | "contact"

export const DEFAULT_STAFF_POSITIONS = ["Հաշվապահ", "Ինժեներ", "Հսկիչ"]
export const DEFAULT_CONTACT_POSITIONS: string[] = []

export function positionsSettingsKey(type: PersonPositionType): string {
  return type === "staff" ? "staff_positions" : "contact_positions"
}

// Staff and contacts have separate position lists
export async function fetchPersonPositions(
  supabase: SupabaseClient,
  type: PersonPositionType
): Promise<string[]> {
  const { data } = await supabase
    .from("settings")
    .select("value")
    .eq("key", positionsSettingsKey(type))
    .single()
  const value = data?.value
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string" && v.trim() !== "")
  return type === "staff" ? DEFAULT_STAFF_POSITIONS : DEFAULT_CONTACT_POSITIONS
}

export async function fetchStaffPositions(supabase: SupabaseClient): Promise<string[]> {
  return fetchPersonPositions(supabase, "staff")
}

export function formatPositions(value: string[] | string | null | undefined): string {
  if (!value) return ""
  if (Array.isArray(value)) return value.join(", ")
  return value
}
