import { NextRequest, NextResponse } from "next/server"
import { generateText } from "ai"
import { z } from "zod"
import * as XLSX from "xlsx"
import { createClient as createServerClient } from "@/lib/supabase/server"

export const maxDuration = 300
export const dynamic = "force-dynamic"

// Extracts a Ծավալաթերթ (bill of quantities) from an uploaded XLSX using
// Gemini Pro at maximum reasoning effort, and stores it as the project's
// volume sheet (replacing any previous one, together with its completion docs).

const rowSchema = z.object({
  kind: z.enum(["group", "subgroup", "item"]),
  src_row: z.number().nullish(),
  number: z.string().nullish(),
  code: z.string().nullish(),
  name: z.string(),
  unit: z.string().nullish(),
  qty: z.number().nullish(),
  price: z.number().nullish(),
})

const EXTRACTION_PROMPT = `You are given part of the raw cell grid of an Armenian construction bill of quantities (Ծավալաթերթ) exported from Excel. Extract its line structure as compact JSON.

Rules:
- Output ONLY valid JSON: {"rows": [...]} — no markdown fences, no commentary.
- Each row is a compact array: [kind, src, number, code, name, unit, qty, price]
  - kind: "g" (top-level section heading), "s" (nested sub-heading), "i" (actual work/material line)
  - src: the source row number — the integer N from the "RN:" prefix of the grid line this row came from
  - number: the line's ordinal as shown, as a string, or null (per-section restarts are fine)
  - code: the norm/estimate code (e.g. "E46-96") if a separate code column exists, else null
  - name: the work/material or heading name (string)
  - unit: measurement unit or null
  - qty, price: numbers or null (headings have null qty/price)
- Preserve the original order of rows exactly.
- SKIP: document titles, column header rows, coefficient/wage rows, empty rows, and summary/total rows (Ընդամենը, ԱԱՀ, Անհաշվարկված ծախսեր, հարկեր and similar aggregates).
- Prices are usually in THOUSANDS of drams (հազ. դրամ) — check the header context. If so, multiply unit prices by 1000 so output prices are plain AMD per unit. Round to 2 decimals.
- If there are TWO unit-price columns (original and discounted/final), use the RIGHTMOST (final) one. Use the UNIT PRICE, never the row total.
- Some cells may contain Armenian text mangled by a legacy font encoding (e.g. "ÐÇÙù", "²ßË³ï³Ýù"). Decode them to proper Armenian Unicode when confident; otherwise keep as-is.
- The grid may be a MIDDLE SLICE of a longer document: extract exactly the rows in the EXTRACT section, never rows from the CONTEXT section.`

const chunkResultSchema = z.object({
  rows: z.array(z.array(z.union([z.string(), z.number(), z.null()])).min(5).max(8)),
})

type ParsedRow = z.infer<typeof rowSchema>

function toRow(arr: (string | number | null)[]): ParsedRow | null {
  const kindMap: Record<string, "group" | "subgroup" | "item"> = { g: "group", s: "subgroup", i: "item" }
  const kind = kindMap[String(arr[0])]
  const name = arr[4] != null ? String(arr[4]).trim() : ""
  if (!kind || !name) return null
  const num = (v: any) => (typeof v === "number" && isFinite(v) ? v : v != null && v !== "" && isFinite(Number(v)) ? Number(v) : null)
  const str = (v: any) => (v != null && String(v).trim() !== "" ? String(v).trim() : null)
  const src = num(arr[1])
  return {
    kind, src_row: src != null ? Math.round(src) : null,
    number: str(arr[2]), code: str(arr[3]), name,
    unit: str(arr[5]), qty: num(arr[6]), price: num(arr[7]),
  }
}

const CHUNK_SIZE = 120
const CONTEXT_LINES = 20

async function extractChunk(context: string, chunk: string): Promise<ParsedRow[]> {
  const { text } = await generateText({
    // Flash matches Pro's extraction quality here at ~10x lower cost
    model: "google/gemini-3.7-flash",
    reasoning: "high",
    maxOutputTokens: 32000,
    prompt: `${EXTRACTION_PROMPT}\n\nCONTEXT (document head, for understanding columns/units — do NOT extract):\n${context}\n\nEXTRACT (emit rows ONLY for these lines):\n${chunk}`,
  })
  const cleaned = text.trim().replace(/^\`\`\`(?:json)?\s*/i, "").replace(/\s*\`\`\`$/, "")
  const validation = chunkResultSchema.safeParse(JSON.parse(cleaned))
  if (!validation.success) throw new Error(validation.error.issues[0]?.message || "invalid structure")
  return validation.data.rows.map(toRow).filter((r): r is ParsedRow => r !== null)
}

export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => null)
  const projectId = Number(body?.projectId)
  const fileName = String(body?.fileName || "volume-sheet.xlsx")
  const fileBase64 = body?.fileBase64
  if (!projectId || !fileBase64) {
    return NextResponse.json({ error: "projectId and fileBase64 are required" }, { status: 400 })
  }

  // Parse the workbook and flatten the first sheet into a compact text grid
  let grid: string
  try {
    const wb = XLSX.read(Buffer.from(fileBase64, "base64"), { type: "buffer" })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: "" })
    // Label lines with ABSOLUTE 1-based Excel row numbers (the used range may
    // not start at A1) — Կատարողական export patches cells by these rows
    const rangeStartRow = XLSX.utils.decode_range(ws["!ref"] || "A1").s.r
    const lines: string[] = []
    rows.forEach((r, i) => {
      const cells = (r as any[]).slice(0, 10).map((c) =>
        typeof c === "number" ? String(Math.round(c * 10000) / 10000) : String(c).replace(/\s+/g, " ").trim()
      )
      if (cells.every((c) => !c)) return
      lines.push(`R${rangeStartRow + i + 1}: ${cells.join(" | ")}`)
    })
    grid = lines.join("\n")
    if (lines.length < 3) throw new Error("empty sheet")
  } catch (err: any) {
    return NextResponse.json({ error: `Չհաջողվեց կարդալ Excel ֆայլը (${err?.message || err})` }, { status: 400 })
  }

  // Gemini Pro at maximum effort, in parallel chunks so long documents fit
  // both the output limit and the route's time budget
  let parsed: { rows: ParsedRow[] }
  try {
    const lines = grid.split("\n")
    const context = lines.slice(0, CONTEXT_LINES).join("\n")
    const chunks: string[] = []
    for (let i = 0; i < lines.length; i += CHUNK_SIZE) {
      chunks.push(lines.slice(i, i + CHUNK_SIZE).join("\n"))
    }
    const results = await Promise.all(chunks.map((c) => extractChunk(context, c)))
    parsed = { rows: results.flat() }
    if (parsed.rows.length === 0) throw new Error("no rows extracted")
  } catch (err: any) {
    console.error("[VolumeSheet] Extraction failed:", err)
    return NextResponse.json(
      { error: `Վերլուծությունը ձախողվեց՝ ${err?.message || err}` },
      { status: 502 }
    )
  }

  // Replace the project's sheet (cascade removes old rows and completion docs)
  const { error: delErr } = await supabase.from("volume_sheet").delete().eq("project_id", projectId)
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })

  const { data: sheet, error: sheetErr } = await supabase
    .from("volume_sheet")
    .insert({ project_id: projectId, file_name: fileName })
    .select("id")
    .single()
  if (sheetErr || !sheet) return NextResponse.json({ error: sheetErr?.message || "insert failed" }, { status: 500 })

  // Keep the original workbook: Կատարողական exports patch qty into an exact copy
  const originalPath = `documents/volume-sheet/${sheet.id}.xlsx`
  const { error: fileErr } = await supabase.storage
    .from("artak")
    .upload(originalPath, Buffer.from(fileBase64, "base64"), {
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      upsert: true,
    })
  if (!fileErr) {
    await supabase.from("volume_sheet").update({ file_path: originalPath }).eq("id", sheet.id)
  }

  const rowsPayload = parsed.rows.map((r, i) => ({
    sheet_id: sheet.id,
    seq: i,
    src_row: r.src_row ?? null,
    kind: r.kind,
    number: r.number || null,
    code: r.code || null,
    name: r.name,
    unit: r.unit || null,
    qty: r.qty ?? null,
    price: r.price ?? null,
  }))
  for (let i = 0; i < rowsPayload.length; i += 200) {
    const { error: rowsErr } = await supabase.from("volume_sheet_row").insert(rowsPayload.slice(i, i + 200))
    if (rowsErr) {
      await supabase.from("volume_sheet").delete().eq("id", sheet.id)
      return NextResponse.json({ error: rowsErr.message }, { status: 500 })
    }
  }

  return NextResponse.json({
    sheetId: sheet.id,
    rows: rowsPayload.length,
    items: rowsPayload.filter((r) => r.kind === "item").length,
  })
}
