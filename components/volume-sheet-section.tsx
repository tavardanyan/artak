"use client"

import { useState, useEffect, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { handleNumberInput, parseFormattedNumber } from "@/lib/utils/number-format"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Upload, Plus, Trash2, FileSpreadsheet } from "lucide-react"

interface SheetRow {
  id: number
  seq: number
  kind: "group" | "subgroup" | "item"
  number: string | null
  code: string | null
  name: string
  unit: string | null
  qty: number | null
  price: number | null
}

interface CompletionDoc {
  id: number
  doc_no: number
  created_at: string
}

interface DocRow {
  doc_id: number
  row_id: number
  qty: number
  price: number | null
}

const nf = (n: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n)

// Ծավալաթերթ: one AI-extracted bill of quantities per project, plus
// Կատարողական acts recording actually done qty/price per line.
export function VolumeSheetSection({ projectId }: { projectId: number }) {
  const [loading, setLoading] = useState(true)
  const [sheet, setSheet] = useState<{ id: number; file_name: string | null; created_at: string } | null>(null)
  const [rows, setRows] = useState<SheetRow[]>([])
  const [docs, setDocs] = useState<CompletionDoc[]>([])
  const [docRows, setDocRows] = useState<DocRow[]>([])
  const [activeTab, setActiveTab] = useState<string>("sheet")
  const [extracting, setExtracting] = useState(false)
  const [confirmReplaceOpen, setConfirmReplaceOpen] = useState(false)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  // Draft for a new Կատարողական: row_id -> { qty, price } as strings
  const [draft, setDraft] = useState<Map<number, { qty: string; price: string }>>(new Map())
  const [savingDoc, setSavingDoc] = useState(false)
  const [deleteDocId, setDeleteDocId] = useState<number | null>(null)

  const { toast } = useToast()
  const supabase = createClient()

  useEffect(() => {
    fetchAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  const fetchAll = async () => {
    setLoading(true)
    try {
      const { data: sheetData } = await supabase
        .from("volume_sheet")
        .select("id, file_name, created_at")
        .eq("project_id", projectId)
        .maybeSingle()
      setSheet(sheetData || null)
      if (!sheetData) {
        setRows([]); setDocs([]); setDocRows([])
        return
      }
      const [rowsRes, docsRes] = await Promise.all([
        supabase.from("volume_sheet_row").select("*").eq("sheet_id", sheetData.id).order("seq"),
        supabase.from("completion_doc").select("*").eq("sheet_id", sheetData.id).order("doc_no"),
      ])
      const docList = (docsRes.data || []) as CompletionDoc[]
      setRows((rowsRes.data || []) as SheetRow[])
      setDocs(docList)
      if (docList.length > 0) {
        const { data: drData } = await supabase
          .from("completion_doc_row")
          .select("*")
          .in("doc_id", docList.map((d) => d.id))
        setDocRows((drData || []) as DocRow[])
      } else {
        setDocRows([])
      }
    } finally {
      setLoading(false)
    }
  }

  // ---- upload & extract ----

  const startUpload = (file: File) => {
    if (sheet) {
      setPendingFile(file)
      setConfirmReplaceOpen(true)
    } else {
      runExtraction(file)
    }
  }

  const runExtraction = async (file: File) => {
    setConfirmReplaceOpen(false)
    setExtracting(true)
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve((reader.result as string).split(",")[1])
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      const res = await fetch("/api/volume-sheet/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, fileName: file.name, fileBase64: base64 }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || res.statusText)
      toast({
        title: "Հաջողություն",
        description: `Վերլուծվեց ${json.rows} տող (${json.items} աշխատանք)`,
      })
      setActiveTab("sheet")
      fetchAll()
    } catch (error: any) {
      console.error("Extraction error:", error)
      toast({ title: "Սխալ", description: error?.message, variant: "destructive" })
    } finally {
      setExtracting(false)
      setPendingFile(null)
    }
  }

  // ---- helpers ----

  const itemRows = useMemo(() => rows.filter((r) => r.kind === "item"), [rows])

  // qty done per row across docs, optionally up to (and incl.) a given doc_no
  const doneByRow = (uptoDocNo?: number, excludeDocId?: number) => {
    const docNoById = new Map(docs.map((d) => [d.id, d.doc_no]))
    const m = new Map<number, number>()
    for (const dr of docRows) {
      const dn = docNoById.get(dr.doc_id)
      if (dn == null) continue
      if (uptoDocNo != null && dn > uptoDocNo) continue
      if (excludeDocId != null && dr.doc_id === excludeDocId) continue
      m.set(dr.row_id, (m.get(dr.row_id) || 0) + dr.qty)
    }
    return m
  }

  const startNewDoc = () => {
    const done = doneByRow()
    const d = new Map<number, { qty: string; price: string }>()
    for (const r of itemRows) {
      const remaining = (r.qty || 0) - (done.get(r.id) || 0)
      d.set(r.id, {
        qty: "",
        price: r.price != null ? handleNumberInput(String(Math.round(r.price * 100) / 100)) : "",
      })
      void remaining
    }
    setDraft(d)
    setActiveTab("new")
  }

  const saveNewDoc = async () => {
    const entries = itemRows
      .map((r) => {
        const v = draft.get(r.id)
        const qty = v ? parseFormattedNumber(v.qty) : 0
        const price = v ? parseFormattedNumber(v.price) : 0
        return { row_id: r.id, qty, price }
      })
      .filter((e) => e.qty > 0)
    if (entries.length === 0) {
      toast({ title: "Սխալ", description: "Լրացրեք նվազագույնը մեկ տողի քանակ", variant: "destructive" })
      return
    }
    setSavingDoc(true)
    try {
      const docNo = docs.length > 0 ? Math.max(...docs.map((d) => d.doc_no)) + 1 : 1
      const { data: doc, error } = await supabase
        .from("completion_doc")
        .insert({ sheet_id: sheet!.id, doc_no: docNo })
        .select("id")
        .single()
      if (error || !doc) throw error || new Error("insert failed")
      const { error: rowsErr } = await supabase
        .from("completion_doc_row")
        .insert(entries.map((e) => ({ doc_id: doc.id, row_id: e.row_id, qty: e.qty, price: e.price || null })))
      if (rowsErr) throw rowsErr
      toast({ title: "Հաջողություն", description: `Կատարողական ${docNo}-ը ստեղծվեց` })
      setActiveTab(`doc-${doc.id}`)
      fetchAll()
    } catch (error: any) {
      toast({ title: "Սխալ", description: error?.message, variant: "destructive" })
    } finally {
      setSavingDoc(false)
    }
  }

  const deleteDoc = async (docId: number) => {
    const { error } = await supabase.from("completion_doc").delete().eq("id", docId)
    if (error) {
      toast({ title: "Սխալ", description: error.message, variant: "destructive" })
    } else {
      toast({ title: "Ջնջվեց" })
      setActiveTab("sheet")
      fetchAll()
    }
    setDeleteDocId(null)
  }

  // ---- render pieces ----

  const th = "border px-2 py-1 text-left text-[11px] font-semibold bg-muted/60 whitespace-nowrap"
  const td = "border px-2 py-0.5 text-[11px] align-top"
  const tdNum = td + " text-right whitespace-nowrap tabular-nums"

  const groupRow = (r: SheetRow, colSpan: number) => (
    <tr key={r.id} className={r.kind === "group" ? "bg-primary/10" : "bg-muted/50"}>
      <td colSpan={colSpan} className={`${td} font-semibold ${r.kind === "subgroup" ? "pl-6" : ""}`}>
        {r.name}
      </td>
    </tr>
  )

  const fileInput = (label: string) => (
    <label className="inline-flex">
      <input
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        disabled={extracting}
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) startUpload(f)
          e.target.value = ""
        }}
      />
      <Button variant="outline" size="sm" disabled={extracting} asChild>
        <span className="cursor-pointer">
          {extracting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
          {label}
        </span>
      </Button>
    </label>
  )

  if (loading) {
    return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
  }

  if (!sheet) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-14 gap-4 text-center">
          <FileSpreadsheet className="h-12 w-12 text-muted-foreground opacity-50" />
          <div>
            <p className="font-medium">Ծավալաթերթ դեռ չկա</p>
            <p className="text-sm text-muted-foreground">
              Վերբեռնեք Excel ֆայլը․ Գագոն կվերլուծի և կկազմի աղյուսակը
            </p>
          </div>
          {fileInput(extracting ? "Վերլուծվում է․․․" : "Վերբեռնել Ծավալաթերթ (.xlsx)")}
          {extracting && (
            <p className="text-xs text-muted-foreground">Վերլուծությունը կարող է տևել 1-3 րոպե</p>
          )}
        </CardContent>
      </Card>
    )
  }

  const done = doneByRow()

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <FileSpreadsheet className="h-4 w-4" />
          <span>{sheet.file_name || "Ծավալաթերթ"}</span>
          <span>·</span>
          <span>{itemRows.length} աշխատանք</span>
        </div>
        {fileInput(extracting ? "Վերլուծվում է․․․" : "Փոխարինել ֆայլը")}
      </div>

      {/* Horizontal tab bar: sheet + completion docs + add */}
      <div className="flex items-center gap-1 border-b overflow-x-auto">
        <button
          className={`px-3 py-1.5 text-sm whitespace-nowrap border-b-2 -mb-px ${activeTab === "sheet" ? "border-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          onClick={() => setActiveTab("sheet")}
        >
          Ծավալաթերթ
        </button>
        {docs.map((d) => (
          <button
            key={d.id}
            className={`px-3 py-1.5 text-sm whitespace-nowrap border-b-2 -mb-px ${activeTab === `doc-${d.id}` ? "border-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            onClick={() => setActiveTab(`doc-${d.id}`)}
          >
            Կատարողական {d.doc_no}
          </button>
        ))}
        {activeTab === "new" ? (
          <span className="px-3 py-1.5 text-sm whitespace-nowrap border-b-2 -mb-px border-primary font-medium">
            Նոր կատարողական
          </span>
        ) : (
          <button
            className="px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground whitespace-nowrap"
            onClick={startNewDoc}
            title="Ավելացնել կատարողական"
          >
            <Plus className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* ---- Base sheet table ---- */}
      {activeTab === "sheet" && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={th}>N</th>
                <th className={th}>Կոդ</th>
                <th className={th + " w-full"}>Անվանում</th>
                <th className={th}>Չ/մ</th>
                <th className={th + " text-right"}>Քանակ</th>
                <th className={th + " text-right"}>Գին</th>
                <th className={th + " text-right"}>Ընդամենը</th>
                <th className={th + " text-right"}>Կատարված</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) =>
                r.kind !== "item" ? groupRow(r, 8) : (
                  <tr key={r.id} className="hover:bg-accent/40">
                    <td className={tdNum}>{r.number}</td>
                    <td className={td + " whitespace-nowrap"}>{r.code}</td>
                    <td className={td}>{r.name}</td>
                    <td className={td + " whitespace-nowrap"}>{r.unit}</td>
                    <td className={tdNum}>{r.qty != null ? nf(r.qty) : ""}</td>
                    <td className={tdNum}>{r.price != null ? nf(r.price) : ""}</td>
                    <td className={tdNum}>{r.qty != null && r.price != null ? nf(r.qty * r.price) : ""}</td>
                    <td className={tdNum + ((done.get(r.id) || 0) >= (r.qty || 0) && r.qty ? " text-green-600" : "")}>
                      {done.get(r.id) ? nf(done.get(r.id)!) : ""}
                    </td>
                  </tr>
                )
              )}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={6} className={td + " font-semibold text-right"}>Ընդամենը</td>
                <td className={tdNum + " font-bold"}>
                  {nf(itemRows.reduce((s, r) => s + (r.qty || 0) * (r.price || 0), 0))}
                </td>
                <td className={td} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* ---- Existing completion doc ---- */}
      {docs.map((d) => {
        if (activeTab !== `doc-${d.id}`) return null
        const thisDoc = new Map(docRows.filter((dr) => dr.doc_id === d.id).map((dr) => [dr.row_id, dr]))
        const before = doneByRow(d.doc_no, d.id)
        return (
          <div key={d.id} className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Ստեղծվել է {new Date(d.created_at).toLocaleDateString("en-GB")}
              </p>
              <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={() => setDeleteDocId(d.id)}>
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                Ջնջել
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className={th}>N</th>
                    <th className={th + " w-full"}>Անվանում</th>
                    <th className={th}>Չ/մ</th>
                    <th className={th + " text-right"}>Ծավալ</th>
                    <th className={th + " text-right"}>Նախորդ կատ.</th>
                    <th className={th + " text-right"}>Այս փաստ. քնկ.</th>
                    <th className={th + " text-right"}>Փաստ. գին</th>
                    <th className={th + " text-right"}>Գումար</th>
                    <th className={th + " text-right"}>Մնացորդ</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    if (r.kind !== "item") return groupRow(r, 9)
                    const dr = thisDoc.get(r.id)
                    if (!dr) return null
                    const prev = before.get(r.id) || 0
                    const remaining = (r.qty || 0) - prev - dr.qty
                    const price = dr.price ?? r.price ?? 0
                    return (
                      <tr key={r.id} className="hover:bg-accent/40">
                        <td className={tdNum}>{r.number}</td>
                        <td className={td}>{r.name}</td>
                        <td className={td + " whitespace-nowrap"}>{r.unit}</td>
                        <td className={tdNum}>{r.qty != null ? nf(r.qty) : ""}</td>
                        <td className={tdNum}>{prev ? nf(prev) : ""}</td>
                        <td className={tdNum + " font-medium"}>{nf(dr.qty)}</td>
                        <td className={tdNum}>{nf(price)}</td>
                        <td className={tdNum}>{nf(dr.qty * price)}</td>
                        <td className={tdNum + (remaining < 0 ? " text-red-600" : "")}>{nf(remaining)}</td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={7} className={td + " font-semibold text-right"}>Ընդամենը</td>
                    <td className={tdNum + " font-bold"}>
                      {nf(Array.from(thisDoc.values()).reduce((s, dr) => {
                        const r = rows.find((x) => x.id === dr.row_id)
                        return s + dr.qty * (dr.price ?? r?.price ?? 0)
                      }, 0))}
                    </td>
                    <td className={td} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )
      })}

      {/* ---- New completion doc (draft) ---- */}
      {activeTab === "new" && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Լրացրեք փաստացի կատարված քանակները և գները․ դատարկ տողերը չեն ներառվի
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setActiveTab("sheet")} disabled={savingDoc}>
                Չեղարկել
              </Button>
              <Button size="sm" onClick={saveNewDoc} disabled={savingDoc}>
                {savingDoc && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
                Պահպանել
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={th}>N</th>
                  <th className={th + " w-full"}>Անվանում</th>
                  <th className={th}>Չ/մ</th>
                  <th className={th + " text-right"}>Ծավալ</th>
                  <th className={th + " text-right"}>Կատարված</th>
                  <th className={th + " text-right"}>Մնացորդ</th>
                  <th className={th}>Փաստ. քնկ.</th>
                  <th className={th}>Փաստ. գին</th>
                  <th className={th + " text-right"}>Գումար</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  if (r.kind !== "item") return groupRow(r, 9)
                  const prev = done.get(r.id) || 0
                  const remaining = (r.qty || 0) - prev
                  const v = draft.get(r.id) || { qty: "", price: "" }
                  const qtyNum = parseFormattedNumber(v.qty)
                  const priceNum = parseFormattedNumber(v.price)
                  const over = qtyNum > remaining + 1e-9
                  return (
                    <tr key={r.id} className={remaining <= 0 ? "opacity-50" : "hover:bg-accent/40"}>
                      <td className={tdNum}>{r.number}</td>
                      <td className={td}>{r.name}</td>
                      <td className={td + " whitespace-nowrap"}>{r.unit}</td>
                      <td className={tdNum}>{r.qty != null ? nf(r.qty) : ""}</td>
                      <td className={tdNum}>{prev ? nf(prev) : ""}</td>
                      <td className={tdNum}>{nf(remaining)}</td>
                      <td className={td + " w-24"}>
                        <Input
                          className={`h-6 text-[11px] px-1 text-right ${over ? "border-red-500" : ""}`}
                          value={v.qty}
                          onChange={(e) => {
                            const next = new Map(draft)
                            next.set(r.id, { ...v, qty: handleNumberInput(e.target.value) })
                            setDraft(next)
                          }}
                        />
                      </td>
                      <td className={td + " w-28"}>
                        <Input
                          className="h-6 text-[11px] px-1 text-right"
                          value={v.price}
                          onChange={(e) => {
                            const next = new Map(draft)
                            next.set(r.id, { ...v, price: handleNumberInput(e.target.value) })
                            setDraft(next)
                          }}
                        />
                      </td>
                      <td className={tdNum}>{qtyNum > 0 ? nf(qtyNum * priceNum) : ""}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={8} className={td + " font-semibold text-right"}>Ընդամենը</td>
                  <td className={tdNum + " font-bold"}>
                    {nf(itemRows.reduce((s, r) => {
                      const v = draft.get(r.id)
                      if (!v) return s
                      return s + parseFormattedNumber(v.qty) * parseFormattedNumber(v.price)
                    }, 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Replace confirmation */}
      <Dialog open={confirmReplaceOpen} onOpenChange={(o) => !o && setConfirmReplaceOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Փոխարինե՞լ Ծավալաթերթը</DialogTitle>
            <DialogDescription>
              Ընթացիկ Ծավալաթերթը և դրա ԲՈԼՈՐ կատարողականները ({docs.length}) կջնջվեն։ Այս գործողությունը հնարավոր չէ հետարկել։
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmReplaceOpen(false)}>Չեղարկել</Button>
            <Button variant="destructive" onClick={() => pendingFile && runExtraction(pendingFile)}>
              Փոխարինել
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete doc confirmation */}
      <Dialog open={deleteDocId !== null} onOpenChange={(o) => !o && setDeleteDocId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ջնջե՞լ կատարողականը</DialogTitle>
            <DialogDescription>Փաստաթուղթը կջնջվի, մնացորդները կվերահաշվարկվեն։</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDocId(null)}>Չեղարկել</Button>
            <Button variant="destructive" onClick={() => deleteDocId && deleteDoc(deleteDocId)}>Ջնջել</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
