import { NextRequest, NextResponse } from "next/server"
import { generateText } from "ai"
import { z } from "zod"
import { createClient as createServerClient } from "@/lib/supabase/server"

export const maxDuration = 300
export const dynamic = "force-dynamic"

// Verifies an uploaded scanned & signed Կատարողական PDF against the stored
// act rows using Gemini. On match: stores the PDF and locks the doc.

const verdictSchema = z.object({
  match: z.boolean(),
  signed: z.boolean(),
  issues: z.array(z.string()),
})

export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => null)
  const docId = Number(body?.docId)
  const fileBase64 = body?.fileBase64
  if (!docId || !fileBase64) {
    return NextResponse.json({ error: "docId and fileBase64 are required" }, { status: 400 })
  }

  const { data: doc } = await supabase
    .from("completion_doc")
    .select("id, doc_no, sheet_id, checked_at")
    .eq("id", docId)
    .maybeSingle()
  if (!doc) return NextResponse.json({ error: "Doc not found" }, { status: 404 })
  if (doc.checked_at) return NextResponse.json({ error: "Փաստաթուղթն արդեն ստուգված է" }, { status: 400 })

  const [{ data: docRows }, { data: sheetRows }] = await Promise.all([
    supabase.from("completion_doc_row").select("row_id, qty").eq("doc_id", docId),
    supabase.from("volume_sheet_row").select("id, number, name, unit, qty").eq("sheet_id", doc.sheet_id),
  ])
  const rowById = new Map((sheetRows || []).map((r: any) => [r.id, r]))
  const expected = (docRows || [])
    .map((dr: any) => {
      const r = rowById.get(dr.row_id)
      return r ? `${r.number || "-"} | ${r.name} | ${r.unit || "-"} | ${dr.qty}` : null
    })
    .filter(Boolean)
  if (expected.length === 0) return NextResponse.json({ error: "Doc has no rows" }, { status: 400 })

  let verdict: z.infer<typeof verdictSchema>
  try {
    const { text } = await generateText({
      model: "google/gemini-3.1-pro-preview",
      reasoning: "high",
      maxOutputTokens: 16000,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `You are verifying a scanned, signed Armenian construction completion act (Կատարողական ակտ) against its digital version.

The digital act contains these work lines (format: number | name | unit | quantity):
${expected.join("\n")}

Check the attached scanned PDF:
1. Does it contain essentially the SAME work lines with the SAME quantities? Minor OCR noise, different ordering, formatting differences, extra header/footer/total rows are fine. Material differences (missing lines, different quantities, different works) are NOT.
2. Does the document appear to be SIGNED (handwritten signature(s) and/or stamp visible)?

Output ONLY JSON: {"match": boolean, "signed": boolean, "issues": ["short issue descriptions in Armenian", ...]}. "match" = true only if the line contents correspond. List any discrepancies you find in "issues" (in Armenian). If unsigned, add an issue saying so.`,
            },
            { type: "file", mediaType: "application/pdf", data: fileBase64 },
          ],
        },
      ],
    })
    const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")
    verdict = verdictSchema.parse(JSON.parse(cleaned))
  } catch (err: any) {
    console.error("[CompletionDoc] Verification failed:", err)
    return NextResponse.json({ error: `Ստուգումը ձախողվեց՝ ${err?.message || err}` }, { status: 502 })
  }

  if (!verdict.match || !verdict.signed) {
    return NextResponse.json({ match: verdict.match, signed: verdict.signed, issues: verdict.issues })
  }

  // Verified: store the scan and lock the doc
  const filePath = `documents/completion/${docId}-${Date.now()}.pdf`
  const { error: uploadErr } = await supabase.storage
    .from("artak")
    .upload(filePath, Buffer.from(fileBase64, "base64"), { contentType: "application/pdf" })
  if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 500 })

  const { error: updErr } = await supabase
    .from("completion_doc")
    .update({ signed_file_path: filePath, checked_at: new Date().toISOString() })
    .eq("id", docId)
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

  return NextResponse.json({ match: true, signed: true, issues: verdict.issues })
}
