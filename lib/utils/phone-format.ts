// Format phone number as "+XXX XX XXXXXX" — adds spaces after the 4th and 6th characters.
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return "-"
  const cleaned = phone.replace(/\s/g, "")
  if (cleaned.length <= 4) return cleaned
  if (cleaned.length <= 6) return cleaned.slice(0, 4) + " " + cleaned.slice(4)
  return cleaned.slice(0, 4) + " " + cleaned.slice(4, 6) + " " + cleaned.slice(6)
}
