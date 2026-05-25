import { SupabaseClient } from "@supabase/supabase-js"

export const DEFAULT_STAFF_POSITIONS = ["Հաշվապահ", "Ինժեներ", "Հսկիչ"]

export async function fetchStaffPositions(supabase: SupabaseClient): Promise<string[]> {
  const { data } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "staff_positions")
    .single()
  const value = data?.value
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string" && v.trim() !== "")
  return DEFAULT_STAFF_POSITIONS
}

export function formatPositions(value: string[] | string | null | undefined): string {
  if (!value) return ""
  if (Array.isArray(value)) return value.join(", ")
  return value
}
