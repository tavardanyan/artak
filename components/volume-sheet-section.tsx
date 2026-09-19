"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { handleNumberInput, parseFormattedNumber } from "@/lib/utils/number-format"
import * as XLSX from "xlsx"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Upload, Plus, Trash2, FileSpreadsheet, Download, Pencil, ArrowDownToLine, FileCheck, ExternalLink } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface SheetRow {
  id: number
  seq: number
  src_row: number | null
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
  signed_file_path: string | null
  checked_at: string | null
}

interface DocRow {
  doc_id: number
  row_id: number
  qty: number
  price: number | null
}

// --- transliteration-aware search (Armenian ↔ Latin) ---
const AM_TO_LAT: Record<string, string> = {
  "ա":"a","բ":"b","գ":"g","դ":"d","ե":"e","զ":"z","է":"e","ը":"e","թ":"t","ժ":"z",
  "ի":"i","լ":"l","խ":"x","ծ":"t","կ":"k","հ":"h","ձ":"d","ղ":"x","ճ":"c","մ":"m",
  "յ":"y","ն":"n","շ":"s","ո":"o","չ":"c","պ":"p","ջ":"j","ռ":"r","ս":"s","վ":"v",
  "տ":"t","ր":"r","ց":"t","փ":"p","ք":"k","օ":"o","ֆ":"f","և":"ev","ւ":"u",
}
// Both Armenian text and Latin transliterations converge to one canonical
// form, so "tex", "texapoxum", "teghapokhum" and "տեղափոխում" all match
const searchNormalize = (input: string) => {
  let out = ""
  for (const ch of input.toLowerCase().replace(/ու/g, "u")) out += AM_TO_LAT[ch] ?? ch
  return out
    .replace(/[^a-z0-9]/g, "")
    .replace(/gh|kh/g, "x").replace(/sh/g, "s").replace(/ch/g, "c")
    .replace(/ts/g, "t").replace(/zh/g, "z").replace(/dz/g, "d").replace(/q/g, "k")
}
const searchMatch = (needle: string, ...hay: (string | null | undefined)[]) =>
  hay.some((h) => h && searchNormalize(h).includes(needle))

const nf = (n: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n)

// Numeric input that never accepts negative values
const posNumberInput = (v: string) => handleNumberInput(v).replace(/^-+/, "")

// Ծավալաթերթ: one AI-extracted bill of quantities per project, plus
// Կատարողական acts recording actually done qty per line (price is always
// the sheet price and is never editable).
export function VolumeSheetSection({ projectId }: { projectId: number }) {
  const [loading, setLoading] = useState(true)
  const [sheet, setSheet] = useState<{ id: number; file_name: string | null; file_path: string | null; created_at: string } | null>(null)
  const [rows, setRows] = useState<SheetRow[]>([])
  const [docs, setDocs] = useState<CompletionDoc[]>([])
  const [docRows, setDocRows] = useState<DocRow[]>([])
  const [activeTab, setActiveTab] = useState<string>("sheet")
  const [extracting, setExtracting] = useState(false)
  const [confirmReplaceOpen, setConfirmReplaceOpen] = useState(false)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  // Draft (new doc or editing an existing one): row_id -> qty string
  const [draft, setDraft] = useState<Map<number, string>>(new Map())
  const [editingDocId, setEditingDocId] = useState<number | null>(null)
  // Autosave machinery: dirty row ids are flushed (debounced) as upserts;
  // a brand-new doc is created lazily on the first non-empty change
  const [autosaveStatus, setAutosaveStatus] = useState<"idle" | "saving" | "saved">("idle")
  const newDocIdRef = useRef<number | null>(null)
  const dirtyRef = useRef<Set<number>>(new Set())
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const draftRef = useRef<Map<number, string>>(new Map())
  const [deleteDocId, setDeleteDocId] = useState<number | null>(null)
  // Doc view: show every row (highlighting changed ones) vs only changed rows
  const [showAllRows, setShowAllRows] = useState(true)
  // Sheet view: color rows by completion status
  const [colorByStatus, setColorByStatus] = useState(true)
  // Google-like search over rows (name/code/number), translit-tolerant
  const [search, setSearch] = useState("")
  // Signed-PDF verification state
  const [verifyingDocId, setVerifyingDocId] = useState<number | null>(null)
  const [verifyIssues, setVerifyIssues] = useState<string[] | null>(null)

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
        .select("id, file_name, file_path, created_at")
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

  // Rows passing the search: heading matches expose their whole section;
  // matching items expose their headings. null = no filtering.
  const searchSet = useMemo(() => {
    const q = searchNormalize(search)
    if (!q) return null
    const visible = new Set<number>()
    let curGroup: SheetRow | null = null
    let curSub: SheetRow | null = null
    for (const r of rows) {
      if (r.kind === "group") { curGroup = r; curSub = null }
      else if (r.kind === "subgroup") { curSub = r }
      const headingMatched =
        (curGroup && searchMatch(q, curGroup.name)) || (curSub && searchMatch(q, curSub.name))
      if (r.kind !== "item") {
        if (searchMatch(q, r.name)) visible.add(r.id)
        continue
      }
      if (headingMatched || searchMatch(q, r.name, r.code, r.number)) {
        visible.add(r.id)
        if (curGroup) visible.add(curGroup.id)
        if (curSub) visible.add(curSub.id)
      }
    }
    return visible
  }, [search, rows])

  // qty done per row across docs, optionally excluding one doc (for editing it)
  const doneByRow = (excludeDocId?: number) => {
    const m = new Map<number, number>()
    for (const dr of docRows) {
      if (excludeDocId != null && dr.doc_id === excludeDocId) continue
      m.set(dr.row_id, (m.get(dr.row_id) || 0) + dr.qty)
    }
    return m
  }

  // done per row counting only docs with doc_no < given (for "prev" columns)
  const doneBefore = (docNo: number) => {
    const docNoById = new Map(docs.map((d) => [d.id, d.doc_no]))
    const m = new Map<number, number>()
    for (const dr of docRows) {
      const dn = docNoById.get(dr.doc_id)
      if (dn == null || dn >= docNo) continue
      m.set(dr.row_id, (m.get(dr.row_id) || 0) + dr.qty)
    }
    return m
  }

  // heading row ids whose section contains at least one changed item
  const headingsWithChanges = (changedRowIds: Set<number>) => {
    const res = new Set<number>()
    let curGroup: number | null = null
    let curSub: number | null = null
    for (const r of rows) {
      if (r.kind === "group") { curGroup = r.id; curSub = null }
      else if (r.kind === "subgroup") { curSub = r.id }
      else if (changedRowIds.has(r.id)) {
        if (curGroup != null) res.add(curGroup)
        if (curSub != null) res.add(curSub)
      }
    }
    return res
  }

  const openEditor = (doc?: CompletionDoc) => {
    if (doc?.checked_at) {
      toast({ title: "Փակ է", description: "Ստուգված կատարողականը հնարավոր չէ խմբագրել", variant: "destructive" })
      return
    }
    const d = new Map<number, string>()
    if (doc) {
      for (const dr of docRows.filter((x) => x.doc_id === doc.id)) {
        d.set(dr.row_id, handleNumberInput(String(dr.qty)))
      }
      setEditingDocId(doc.id)
      setActiveTab(`doc-${doc.id}`)
    } else {
      setEditingDocId(null)
      setActiveTab("new")
    }
    newDocIdRef.current = null
    dirtyRef.current = new Set()
    setAutosaveStatus("idle")
    draftRef.current = d
    setDraft(d)
  }

  const flushAutosave = async () => {
    const dirty = Array.from(dirtyRef.current)
    dirtyRef.current = new Set()
    if (dirty.length === 0) return
    setAutosaveStatus("saving")
    try {
      let docId = editingDocId ?? newDocIdRef.current
      if (!docId) {
        const docNo = docs.length > 0 ? Math.max(...docs.map((d) => d.doc_no)) + 1 : 1
        const { data: doc, error } = await supabase
          .from("completion_doc")
          .insert({ sheet_id: sheet!.id, doc_no: docNo })
          .select("id")
          .single()
        if (error || !doc) throw error || new Error("insert failed")
        newDocIdRef.current = doc.id
        docId = doc.id
      }
      if (!docId) throw new Error("no doc id")
      const upserts: DocRow[] = []
      const deletes: number[] = []
      for (const rowId of dirty) {
        const r = itemRows.find((x) => x.id === rowId)
        const qty = parseFormattedNumber(draftRef.current.get(rowId) || "")
        if (qty > 0) upserts.push({ doc_id: docId, row_id: rowId, qty, price: r?.price ?? null })
        else deletes.push(rowId)
      }
      if (upserts.length > 0) {
        const { error } = await supabase
          .from("completion_doc_row")
          .upsert(upserts, { onConflict: "doc_id,row_id" })
        if (error) throw error
      }
      if (deletes.length > 0) {
        const { error } = await supabase
          .from("completion_doc_row")
          .delete()
          .eq("doc_id", docId)
          .in("row_id", deletes)
        if (error) throw error
      }
      // keep local state in sync so remaining columns stay live
      setDocRows((prev) => [
        ...prev.filter((dr) => !(dr.doc_id === docId && dirty.includes(dr.row_id))),
        ...upserts,
      ])
      setAutosaveStatus("saved")
    } catch (error: any) {
      dirty.forEach((id) => dirtyRef.current.add(id))
      setAutosaveStatus("idle")
      toast({ title: "Սխալ", description: error?.message || "Ավտոպահպանումը ձախողվեց", variant: "destructive" })
    }
  }

  const scheduleAutosave = (rowId: number) => {
    dirtyRef.current.add(rowId)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => flushAutosave(), 800)
  }

  const closeEditor = async () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    await flushAutosave()
    // a new doc that ended up empty is discarded
    if (!editingDocId && newDocIdRef.current) {
      const { count } = await supabase
        .from("completion_doc_row")
        .select("*", { count: "exact", head: true })
        .eq("doc_id", newDocIdRef.current)
      if (!count) {
        await supabase.from("completion_doc").delete().eq("id", newDocIdRef.current)
        newDocIdRef.current = null
      }
    }
    const target = editingDocId ?? newDocIdRef.current
    newDocIdRef.current = null
    setEditingDocId(null)
    setAutosaveStatus("idle")
    setActiveTab(target ? `doc-${target}` : "sheet")
    fetchAll()
  }

  const uploadSignedPdf = async (doc: CompletionDoc, file: File) => {
    setVerifyingDocId(doc.id)
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve((reader.result as string).split(",")[1])
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      const res = await fetch("/api/completion-doc/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ docId: doc.id, fileBase64: base64 }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || res.statusText)
      if (json.match && json.signed) {
        toast({ title: "Ստուգված է ✓", description: "Փաստաթուղթը համապատասխանում է և ստորագրված է" })
        fetchAll()
      } else {
        setVerifyIssues(
          json.issues?.length
            ? json.issues
            : [json.match ? "Ստորագրությունը չի հայտնաբերվել" : "Փաստաթուղթը չի համապատասխանում"]
        )
      }
    } catch (error: any) {
      toast({ title: "Սխալ", description: error?.message, variant: "destructive" })
    } finally {
      setVerifyingDocId(null)
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

  // ---- XLSX export: an EXACT copy of the uploaded workbook (colors, fonts,
  // widths, everything) where ONLY the qty column carries the act's values ----

  const colLetter = (n: number) => {
    let sIdx = n, out = ""
    while (sIdx >= 0) { out = String.fromCharCode(65 + (sIdx % 26)) + out; sIdx = Math.floor(sIdx / 26) - 1 }
    return out
  }
  const colIndex = (letters: string) => {
    let n = 0
    for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64)
    return n - 1
  }

  const downloadDocXlsx = async (doc: CompletionDoc) => {
    try {
      if (!sheet?.file_path) {
        toast({
          title: "Բնօրինակը չկա",
          description: "Այս Ծավալաթերթի սկզբնական ֆայլը պահված չէ․ վերբեռնեք ֆայլը նորից, որ արտահանումը լինի բնօրինակի ձևաչափով",
          variant: "destructive",
        })
        return
      }
      const url = supabase.storage.from("artak").getPublicUrl(sheet.file_path).data.publicUrl
      const buf = await fetch(url).then((r) => {
        if (!r.ok) throw new Error("Չհաջողվեց բեռնել բնօրինակ ֆայլը")
        return r.arrayBuffer()
      })

      const JSZip = (await import("jszip")).default
      const zip = await JSZip.loadAsync(buf)

      // Resolve the first sheet's XML path via workbook relations
      const wbXml = await zip.file("xl/workbook.xml")!.async("string")
      const relsXml = await zip.file("xl/_rels/workbook.xml.rels")!.async("string")
      const firstSheetRid = wbXml.match(/<sheet[^>]*r:id="([^"]+)"/)?.[1]
      const relMatch = firstSheetRid
        ? relsXml.match(new RegExp(`<Relationship[^>]*Id="${firstSheetRid}"[^>]*Target="([^"]+)"`))
        : null
      let target = relMatch?.[1] || "worksheets/sheet1.xml"
      if (target.startsWith("/")) target = target.slice(1)
      else if (!target.startsWith("xl/")) target = `xl/${target}`
      const sheetFile = zip.file(target)
      if (!sheetFile) throw new Error("Աղյուսակի XML-ը չի գտնվել")
      let xml = await sheetFile.async("string")

      const rowBlock = (xmlRow: number) => {
        const m = xml.match(new RegExp(`<row[^>]*\\br="${xmlRow}"[^>]*(?:/>|>[\\s\\S]*?</row>)`))
        return m ? m[0] : null
      }

      // Find the qty column: for each item row, locate the cell whose numeric
      // value equals the extracted qty; take the majority column
      const votes = new Map<string, number>()
      for (const r of itemRows) {
        if (r.src_row == null || r.qty == null) continue
        const block = rowBlock(r.src_row)
        if (!block) continue
        for (const cm of block.matchAll(/<c[^>]*r="([A-Z]+)(\d+)"[^>]*>[\s\S]*?<v>([^<]*)<\/v>[\s\S]*?<\/c>/g)) {
          const val = Number(cm[3])
          if (isFinite(val) && Math.abs(val - r.qty) < 1e-9) {
            votes.set(cm[1], (votes.get(cm[1]) || 0) + 1)
          }
        }
      }
      const qtyCol = Array.from(votes.entries()).sort((a, b) => b[1] - a[1])[0]?.[0]
      if (!qtyCol) throw new Error("Քանակի սյունը չի հայտնաբերվել")

      // Patch the qty cell of every item row: act qty, or 0 when untouched
      const thisDoc = new Map(docRows.filter((dr) => dr.doc_id === doc.id).map((dr) => [dr.row_id, dr.qty]))
      for (const r of itemRows) {
        if (r.src_row == null) continue
        const ref = `${qtyCol}${r.src_row}`
        const newVal = thisDoc.get(r.id) || 0
        const cellRe = new RegExp(`<c([^>]*\\br="${ref}"[^>]*?)(/>|>[\\s\\S]*?</c>)`)
        const m = xml.match(cellRe)
        if (!m) continue
        // keep the cell's style, drop formulas/shared-string typing
        const attrs = m[1].replace(/\st="[^"]*"/g, "")
        xml = xml.replace(cellRe, `<c${attrs}><v>${newVal}</v></c>`)
      }

      zip.file(target, xml)
      const blob = await zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
      const a = document.createElement("a")
      a.href = URL.createObjectURL(blob)
      a.download = `Կատարողական-${doc.doc_no}.xlsx`
      a.click()
      URL.revokeObjectURL(a.href)
    } catch (error: any) {
      console.error("Export error:", error)
      toast({ title: "Սխալ", description: error?.message || "Արտահանումը ձախողվեց", variant: "destructive" })
    }
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

  const doneAll = doneByRow()
  const isEditorOpen = activeTab === "new" || editingDocId !== null
  const editorPrev = doneByRow(editingDocId ?? newDocIdRef.current ?? undefined)

  // ---- draft editor (new doc or editing an existing one) ----
  const renderEditor = () => (
    <div className="space-y-2">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-xs text-muted-foreground">
          Լրացրեք փաստացի կատարված քանակները․ գինը միշտ Ծավալաթերթից է։ Փոփոխությունները պահպանվում են ավտոմատ
        </p>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            {autosaveStatus === "saving" && (<><Loader2 className="h-3 w-3 animate-spin" /> Պահպանվում է…</>)}
            {autosaveStatus === "saved" && <span className="text-green-600">Պահպանված ✓</span>}
          </span>
          <Button size="sm" onClick={closeEditor}>Փակել</Button>
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
              <th className={th + " text-right"}>Գին</th>
              <th className={th + " text-right"}>Գումար</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              if (searchSet && !searchSet.has(r.id)) return null
              if (r.kind !== "item") return groupRow(r, 9)
              const prev = editorPrev.get(r.id) || 0
              const remaining = (r.qty || 0) - prev
              const v = draft.get(r.id) || ""
              const qtyNum = parseFormattedNumber(v)
              const over = qtyNum > remaining + 1e-9
              return (
                <tr key={r.id} className={remaining <= 0 && !v ? "opacity-50" : "hover:bg-accent/40"}>
                  <td className={tdNum}>{r.number}</td>
                  <td className={td}>{r.name}</td>
                  <td className={td + " whitespace-nowrap"}>{r.unit}</td>
                  <td className={tdNum}>{r.qty != null ? nf(r.qty) : ""}</td>
                  <td className={tdNum}>{prev ? nf(prev) : ""}</td>
                  <td className={tdNum}>{nf(remaining)}</td>
                  <td className={td + " w-32"}>
                    <div className="flex items-center gap-0.5">
                      <Input
                        className={`h-6 text-[11px] px-1 text-right ${over ? "border-red-500" : ""}`}
                        value={v}
                        onChange={(e) => {
                          const next = new Map(draft)
                          next.set(r.id, posNumberInput(e.target.value))
                          draftRef.current = next
                          setDraft(next)
                          scheduleAutosave(r.id)
                        }}
                      />
                      {remaining > 0 && (
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-foreground shrink-0"
                          title="Լրացնել ամբողջ մնացորդը"
                          onClick={() => {
                            const next = new Map(draft)
                            next.set(r.id, handleNumberInput(String(Math.round(remaining * 10000) / 10000)))
                            draftRef.current = next
                            setDraft(next)
                            scheduleAutosave(r.id)
                          }}
                        >
                          <ArrowDownToLine className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                  <td className={tdNum}>{r.price != null ? nf(r.price) : ""}</td>
                  <td className={tdNum}>{qtyNum > 0 ? nf(qtyNum * (r.price || 0)) : ""}</td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={8} className={td + " font-semibold text-right"}>Ընդամենը</td>
              <td className={tdNum + " font-bold"}>
                {nf(itemRows.reduce((s, r) => s + parseFormattedNumber(draft.get(r.id) || "") * (r.price || 0), 0))}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )

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
          onClick={() => { setEditingDocId(null); setActiveTab("sheet") }}
        >
          Ծավալաթերթ
        </button>
        {docs.map((d) => (
          <button
            key={d.id}
            className={`px-3 py-1.5 text-sm whitespace-nowrap border-b-2 -mb-px ${activeTab === `doc-${d.id}` ? "border-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            onClick={() => { setEditingDocId(null); setActiveTab(`doc-${d.id}`) }}
          >
            <span
              className={`inline-block h-2.5 w-2.5 rounded-full mr-1.5 align-middle ${d.checked_at ? "bg-green-500" : "bg-red-500"}`}
            />
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
            onClick={() => openEditor()}
            title="Ավելացնել կատարողական"
          >
            <Plus className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Search: name / code, Armenian or Latin translit */}
      <div className="relative max-w-sm">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Որոնել՝ անվանում կամ կոդ (հայերեն կամ լատինատառ)..."
          className="h-8 text-sm"
        />
      </div>

      {/* ---- Base sheet table ---- */}
      {activeTab === "sheet" && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 justify-end">
            <Switch id="vs-color" checked={colorByStatus} onCheckedChange={setColorByStatus} />
            <Label htmlFor="vs-color" className="text-xs cursor-pointer">Գունավորել ըստ կատարման</Label>
          </div>
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
                {rows.map((r) => {
                  if (searchSet && !searchSet.has(r.id)) return null
                  if (r.kind !== "item") return groupRow(r, 8)
                  const done = doneAll.get(r.id) || 0
                  const full = r.qty != null && r.qty > 0 && done >= r.qty - 1e-9
                  const partial = done > 0 && !full
                  const statusBg = colorByStatus
                    ? full ? "bg-green-500/15 hover:bg-green-500/25"
                      : partial ? "bg-amber-500/15 hover:bg-amber-500/25"
                        : "hover:bg-accent/40"
                    : "hover:bg-accent/40"
                  return (
                    <tr key={r.id} className={statusBg}>
                      <td className={tdNum}>{r.number}</td>
                      <td className={td + " whitespace-nowrap"}>{r.code}</td>
                      <td className={td}>{r.name}</td>
                      <td className={td + " whitespace-nowrap"}>{r.unit}</td>
                      <td className={tdNum}>{r.qty != null ? nf(r.qty) : ""}</td>
                      <td className={tdNum}>{r.price != null ? nf(r.price) : ""}</td>
                      <td className={tdNum}>{r.qty != null && r.price != null ? nf(r.qty * r.price) : ""}</td>
                      <td className={tdNum}>{done ? nf(done) : ""}</td>
                    </tr>
                  )
                })}
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
        </div>
      )}

      {/* ---- Existing completion doc (view or edit) ---- */}
      {docs.map((d) => {
        if (activeTab !== `doc-${d.id}`) return null
        if (editingDocId === d.id) return <div key={d.id}>{renderEditor()}</div>
        const thisDoc = new Map(docRows.filter((dr) => dr.doc_id === d.id).map((dr) => [dr.row_id, dr]))
        const changedHeadings = headingsWithChanges(new Set(thisDoc.keys()))
        const before = doneBefore(d.doc_no)
        return (
          <div key={d.id} className="space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-xs text-muted-foreground">
                Ստեղծվել է {new Date(d.created_at).toLocaleDateString("en-GB")}
              </p>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <Switch id={`vs-all-${d.id}`} checked={showAllRows} onCheckedChange={setShowAllRows} />
                  <Label htmlFor={`vs-all-${d.id}`} className="text-xs cursor-pointer">Ցույց տալ բոլոր տողերը</Label>
                </div>
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => downloadDocXlsx(d)}>
                  <Download className="h-3.5 w-3.5 mr-1" />
                  Ներբեռնել
                </Button>
                {d.checked_at ? (
                  <>
                    <Badge variant="outline" className="text-green-700 border-green-600">
                      <FileCheck className="h-3.5 w-3.5 mr-1" />
                      Ստուգված և ստորագրված
                    </Badge>
                    {d.signed_file_path && (
                      <Button variant="outline" size="sm" className="h-7 text-xs" asChild>
                        <a
                          href={supabase.storage.from("artak").getPublicUrl(d.signed_file_path).data.publicUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <ExternalLink className="h-3.5 w-3.5 mr-1" />
                          PDF
                        </a>
                      </Button>
                    )}
                  </>
                ) : (
                  <>
                    <label className="inline-flex">
                      <input
                        type="file"
                        accept="application/pdf"
                        className="hidden"
                        disabled={verifyingDocId !== null}
                        onChange={(e) => {
                          const f = e.target.files?.[0]
                          if (f) uploadSignedPdf(d, f)
                          e.target.value = ""
                        }}
                      />
                      <Button variant="outline" size="sm" className="h-7 text-xs" disabled={verifyingDocId !== null} asChild>
                        <span className="cursor-pointer">
                          {verifyingDocId === d.id ? (
                            <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                          ) : (
                            <FileCheck className="h-3.5 w-3.5 mr-1" />
                          )}
                          {verifyingDocId === d.id ? "Ստուգվում է․․․" : "Վերբեռնել ստորագրված PDF"}
                        </span>
                      </Button>
                    </label>
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => openEditor(d)}>
                      <Pencil className="h-3.5 w-3.5 mr-1" />
                      Խմբագրել
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={() => setDeleteDocId(d.id)}>
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                      Ջնջել
                    </Button>
                  </>
                )}
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
                    <th className={th + " text-right"}>Նախորդ կատ.</th>
                    <th className={th + " text-right"}>Փաստ. քնկ.</th>
                    <th className={th + " text-right"}>Գին</th>
                    <th className={th + " text-right"}>Գումար</th>
                    <th className={th + " text-right"}>Մնացորդ</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    if (searchSet && !searchSet.has(r.id)) return null
                    if (r.kind !== "item") {
                      // hide headings whose section has no changes (unless showing all)
                      if (!showAllRows && !changedHeadings.has(r.id)) return null
                      return groupRow(r, 9)
                    }
                    const dr = thisDoc.get(r.id)
                    if (!dr && !showAllRows) return null
                    const prev = before.get(r.id) || 0
                    const qty = dr?.qty || 0
                    const price = r.price || 0
                    const remaining = (r.qty || 0) - prev - qty
                    return (
                      <tr key={r.id} className={dr ? "bg-amber-500/15 hover:bg-amber-500/25" : "hover:bg-accent/40"}>
                        <td className={tdNum}>{r.number}</td>
                        <td className={td}>{r.name}</td>
                        <td className={td + " whitespace-nowrap"}>{r.unit}</td>
                        <td className={tdNum}>{r.qty != null ? nf(r.qty) : ""}</td>
                        <td className={tdNum}>{prev ? nf(prev) : ""}</td>
                        <td className={tdNum + " font-medium"}>{dr ? nf(qty) : ""}</td>
                        <td className={tdNum}>{price ? nf(price) : ""}</td>
                        <td className={tdNum}>{dr ? nf(qty * price) : ""}</td>
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
                        return s + dr.qty * (r?.price || 0)
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

      {/* ---- New completion doc ---- */}
      {activeTab === "new" && renderEditor()}

      {/* Verification mismatch dialog */}
      <Dialog open={verifyIssues !== null} onOpenChange={(o) => !o && setVerifyIssues(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Փաստաթուղթը չի հաստատվել</DialogTitle>
            <DialogDescription>Գագոն հայտնաբերել է անհամապատասխանություններ․</DialogDescription>
          </DialogHeader>
          <ul className="list-disc pl-5 space-y-1 text-sm">
            {(verifyIssues || []).map((issue, i) => (
              <li key={i}>{issue}</li>
            ))}
          </ul>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVerifyIssues(null)}>Փակել</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
