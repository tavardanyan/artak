// Cross-environment UUID v4. Works in non-secure contexts where
// crypto.randomUUID is undefined (e.g. dev server accessed via LAN IP).
export function uuidv4(): string {
  const c: any = typeof crypto !== "undefined" ? crypto : undefined
  if (c?.randomUUID) return c.randomUUID()

  // Fallback using getRandomValues (available in all modern browsers and Node).
  const bytes = new Uint8Array(16)
  if (c?.getRandomValues) {
    c.getRandomValues(bytes)
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256)
  }
  // Per RFC 4122 §4.4: version + variant bits
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const h = Array.from(bytes, (b) => b.toString(16).padStart(2, "0"))
  return `${h[0]}${h[1]}${h[2]}${h[3]}-${h[4]}${h[5]}-${h[6]}${h[7]}-${h[8]}${h[9]}-${h[10]}${h[11]}${h[12]}${h[13]}${h[14]}${h[15]}`
}
