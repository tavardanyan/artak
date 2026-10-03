import type JSZip from "jszip"

// Row surgery on an .xlsx package, done directly on the XML so the workbook
// keeps every style, width and merge exactly as uploaded. Deleting rows
// shifts everything below them the way Excel's own "Delete rows" does:
// cell/row numbers, formulas, merges, print area, views and drawings.

const xmlUnescape = (s: string) =>
  s.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")
const xmlEscape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

const colToNum = (letters: string) => {
  let n = 0
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n
}
const numToCol = (n: number) => {
  let out = ""
  while (n > 0) { out = String.fromCharCode(65 + ((n - 1) % 26)) + out; n = Math.floor((n - 1) / 26) }
  return out
}

const CELL_RE = /<c\b([^>]*?)(\/>|>([\s\S]*?)<\/c>)/g
const ROW_RE = /<row\b([^>]*?)(\/>|>([\s\S]*?)<\/row>)/g
const F_RE = /<f\b([^>]*?)(\/>|>([\s\S]*?)<\/f>)/

// Resolves a relationship target against the directory of the part owning it
const resolvePart = (baseDir: string, target: string) => {
  if (target.startsWith("/")) return target.slice(1)
  const parts = baseDir.split("/").filter(Boolean)
  for (const seg of target.split("/")) {
    if (seg === "..") parts.pop()
    else if (seg !== ".") parts.push(seg)
  }
  return parts.join("/")
}

const relTargets = (relsXml: string, typeSuffix: string, baseDir: string) =>
  (relsXml.match(/<Relationship\b[^>]*>/g) || [])
    .filter((t) => new RegExp(`Type="[^"]*/${typeSuffix}"`).test(t) && !/TargetMode="External"/.test(t))
    .map((t) => resolvePart(baseDir, xmlUnescape(t.match(/\bTarget="([^"]+)"/)?.[1] || "")))

/** Path and name of the workbook's first worksheet */
export async function firstSheet(zip: JSZip) {
  const wbXml = await zip.file("xl/workbook.xml")!.async("string")
  const relsXml = await zip.file("xl/_rels/workbook.xml.rels")!.async("string")
  const tag = wbXml.match(/<sheet\b[^>]*>/)?.[0] || ""
  const rid = tag.match(/\br:id="([^"]+)"/)?.[1]
  const name = xmlUnescape(tag.match(/\bname="([^"]*)"/)?.[1] || "")
  const relTag = (relsXml.match(/<Relationship\b[^>]*>/g) || []).find((t) => t.includes(`Id="${rid}"`))
  let target = relTag?.match(/\bTarget="([^"]+)"/)?.[1] || "worksheets/sheet1.xml"
  if (target.startsWith("/")) target = target.slice(1)
  else if (!target.startsWith("xl/")) target = `xl/${target}`
  return { path: target, name }
}

// ---- formula references ----

interface RefEnd { colAbs: string; col: string; rowAbs: string; row: number }
interface Ref {
  qual: string // the "Sheet!" prefix as written, "" when unqualified
  sheet: string | null // unquoted sheet name, null when unqualified
  external: boolean
  rowsOnly: boolean // whole-row range like 5:7
  a: RefEnd
  b: RefEnd | null
}

// A1 / A1:B2 / 5:7 references, optionally sheet-qualified; never inside a
// longer identifier and never a function name (LOG10 is followed by "(")
const REF_RE =
  /(?<![\w.$'\]!:À-￿])((?:\[\d+\])?(?:'(?:[^']|'')+'|[A-Za-z_À-￿][\w.À-￿]*)!)?(?:(\$?)([A-Z]{1,3})(\$?)(\d+)(?::(\$?)([A-Z]{1,3})(\$?)(\d+))?|(\$?)(\d+):(\$?)(\d+))(?![\w(.!À-￿])/g

const fmtEnd = (e: RefEnd) => `${e.colAbs}${e.col}${e.rowAbs}${e.row}`

// Rewrites every reference in a formula through fn (string literals are left
// alone); fn returns the replacement text, or null to keep the reference
function mapFormulaRefs(formula: string, fn: (ref: Ref) => string | null) {
  return formula
    .split(/("(?:[^"]|"")*")/)
    .map((seg, i) => (i % 2 === 1 ? seg : seg.replace(REF_RE, (whole, qual, ...g) => {
      const q: string = qual || ""
      const sheetPart = q.replace(/^\[\d+\]/, "").slice(0, -1)
      const sheet = q
        ? sheetPart.startsWith("'") ? sheetPart.slice(1, -1).replace(/''/g, "'") : sheetPart
        : null
      const ref: Ref = g[3] != null
        ? {
            qual: q, sheet, external: q.startsWith("["), rowsOnly: false,
            a: { colAbs: g[0], col: g[1], rowAbs: g[2], row: +g[3] },
            b: g[7] != null ? { colAbs: g[4], col: g[5], rowAbs: g[6], row: +g[7] } : null,
          }
        : {
            qual: q, sheet, external: q.startsWith("["), rowsOnly: true,
            a: { colAbs: "", col: "", rowAbs: g[8], row: +g[9] },
            b: { colAbs: "", col: "", rowAbs: g[10], row: +g[11] },
          }
      return fn(ref) ?? whole
    })))
    .join("")
}

const fmtRef = (ref: Ref) =>
  ref.rowsOnly
    ? `${ref.qual}${ref.a.rowAbs}${ref.a.row}:${ref.b!.rowAbs}${ref.b!.row}`
    : ref.qual + fmtEnd(ref.a) + (ref.b ? `:${fmtEnd(ref.b)}` : "")

// Shared formulas store the text once (on the master cell) and let the other
// cells derive theirs by offset; expand them so rows can be deleted safely
function unshareFormulas(xml: string) {
  const masters = new Map<string, { row: number; col: number; text: string }>()
  for (const m of xml.matchAll(CELL_RE)) {
    const f = m[3]?.match(F_RE)
    if (!f || !/\bt="shared"/.test(f[1]) || !/\bref="/.test(f[1])) continue
    const si = f[1].match(/\bsi="(\d+)"/)?.[1]
    const at = m[1].match(/\br="([A-Z]+)(\d+)"/)
    if (si == null || !at) continue
    masters.set(si, { col: colToNum(at[1]), row: +at[2], text: xmlUnescape(f[3] || "") })
  }
  if (masters.size === 0) return xml
  return xml.replace(CELL_RE, (whole, attrs: string, _end, inner?: string) => {
    const f = inner?.match(F_RE)
    if (!inner || !f || !/\bt="shared"/.test(f[1])) return whole
    const master = masters.get(f[1].match(/\bsi="(\d+)"/)?.[1] || "")
    const at = attrs.match(/\br="([A-Z]+)(\d+)"/)
    if (!master || !at) return whole
    const dr = +at[2] - master.row
    const dc = colToNum(at[1]) - master.col
    const text = mapFormulaRefs(master.text, (ref) => {
      for (const e of ref.b ? [ref.a, ref.b] : [ref.a]) {
        if (!e.rowAbs) e.row += dr
        if (!e.colAbs && e.col) e.col = numToCol(colToNum(e.col) + dc)
      }
      return fmtRef(ref)
    })
    const fAttrs = f[1].replace(/\s(t|ref|si)="[^"]*"/g, "")
    return `<c${attrs}>${inner.replace(F_RE, () => `<f${fAttrs}>${xmlEscape(text)}</f>`)}</c>`
  })
}

// ---- row deletion ----

/**
 * Deletes the given 1-based rows from a worksheet. `tracked` are the rows
 * the app knows about (items and headings); untracked rows are dropped too
 * when they only hold leftovers of deleted rows: blank/text lines between
 * two deleted tracked rows, and subtotal rows whose formulas reference only
 * deleted rows. Deleted rows are assumed to be worth 0, so a formula
 * pointing at one gets 0 instead of Excel's #REF!.
 */
export async function removeSheetRows(
  zip: JSZip,
  sheet: { path: string; name: string },
  drop: Set<number>,
  tracked: Set<number>,
) {
  let xml = unshareFormulas(await zip.file(sheet.path)!.async("string"))

  const ownSheet = (ref: Ref) =>
    !ref.external && (ref.sheet == null || ref.sheet.toLowerCase() === sheet.name.toLowerCase())

  // per-row facts for picking up leftover untracked rows
  const info = new Map<number, { numeric: boolean; refs: [number, number][] }>()
  for (const m of xml.matchAll(ROW_RE)) {
    const r = Number(m[1].match(/\br="(\d+)"/)?.[1])
    if (!r || tracked.has(r)) continue
    let numeric = false
    let formula = false
    const refs: [number, number][] = []
    for (const c of (m[3] || "").matchAll(CELL_RE)) {
      const f = c[3]?.match(F_RE)
      if (f) {
        formula = true
        const before = refs.length
        mapFormulaRefs(xmlUnescape(f[3] || ""), (ref) => {
          // a reference to another sheet keeps the row: its value is unknown
          refs.push(ownSheet(ref) ? [ref.a.row, ref.b?.row ?? ref.a.row] : [0, 0])
          return null
        })
        // constant formulas (=100) keep the row too
        if (refs.length === before) refs.push([0, 0])
      } else if (/<v>/.test(c[3] || "") && !/\bt="(s|str|inlineStr|b|e)"/.test(c[1])) {
        numeric = true
      }
    }
    info.set(r, { numeric, refs: formula ? refs : [] })
  }

  const all = new Set(drop)
  const trackedSorted = Array.from(tracked).sort((x, y) => x - y)
  for (let i = 0; i + 1 < trackedSorted.length; i++) {
    const [from, to] = [trackedSorted[i], trackedSorted[i + 1]]
    if (!drop.has(from) || !drop.has(to)) continue
    for (let r = from + 1; r < to; r++) {
      const ri = info.get(r)
      if (!ri || (!ri.numeric && ri.refs.length === 0)) all.add(r)
    }
  }
  // subtotal rows (possibly nested) whose inputs are all gone
  for (let changed = true; changed;) {
    changed = false
    for (const [r, ri] of info) {
      if (all.has(r) || ri.numeric || ri.refs.length === 0) continue
      const gone = ri.refs.every(([x, y]) => {
        if (x < 1) return false
        for (let k = Math.min(x, y); k <= Math.max(x, y); k++) if (!all.has(k)) return false
        return true
      })
      if (gone) { all.add(r); changed = true }
    }
  }
  if (all.size === 0) return

  const sorted = Array.from(all).sort((x, y) => x - y)
  const deletedBefore = (r: number) => {
    let lo = 0, hi = sorted.length
    while (lo < hi) { const mid = (lo + hi) >> 1; if (sorted[mid] < r) lo = mid + 1; else hi = mid }
    return lo
  }
  const newRow = (r: number) => r - deletedBefore(r)
  const keptFrom = (r: number) => { while (all.has(r)) r++; return r }
  const keptUpTo = (r: number) => { while (r > 0 && all.has(r)) r--; return r }

  // Formula references: ranges shrink to their kept rows, a reference whose
  // rows are all gone becomes 0
  const remapRef = (ref: Ref): string | null => {
    if (!ownSheet(ref)) return null
    if (!ref.b) {
      if (all.has(ref.a.row)) return "0"
      ref.a.row = newRow(ref.a.row)
      return fmtRef(ref)
    }
    const top = ref.a.row <= ref.b.row ? ref.a : ref.b
    const bottom = top === ref.a ? ref.b : ref.a
    const r1 = keptFrom(top.row), r2 = keptUpTo(bottom.row)
    if (r1 > r2) return "0"
    top.row = newRow(r1)
    bottom.row = newRow(r2)
    return fmtRef(ref)
  }
  const remapFormula = (text: string) => mapFormulaRefs(text, remapRef)
  // only references explicitly qualified with this sheet (other sheets, names)
  const remapQualified = (text: string) => mapFormulaRefs(text, (ref) => (ref.sheet == null ? null : remapRef(ref)))

  // Plain A1 / A1:B2 / 5:7 range attributes; strict drops what is gone,
  // loose (views, anchors) moves to the next kept row
  const remapRange = (ref: string, loose = false): string | null => {
    const m = ref.match(/^(\$?[A-Z]*\$?)(\d+)(?::(\$?[A-Z]*\$?)(\d+))?$/)
    if (!m) return ref
    if (loose) return `${m[1]}${newRow(keptFrom(+m[2]))}` + (m[4] ? `:${m[3]}${newRow(keptFrom(+m[4]))}` : "")
    if (!m[4]) return all.has(+m[2]) ? null : `${m[1]}${newRow(+m[2])}`
    const r1 = keptFrom(+m[2]), r2 = keptUpTo(+m[4])
    if (r1 > r2) return null
    return `${m[1]}${newRow(r1)}:${m[3]}${newRow(r2)}`
  }
  const remapSqref = (list: string, loose = false) =>
    list.split(/\s+/).filter(Boolean).map((x) => remapRange(x, loose)).filter(Boolean).join(" ") || null
  const setAttr = (tag: string, attr: string, value: string) =>
    tag.replace(new RegExp(`\\b${attr}="[^"]*"`), () => `${attr}="${value}"`)

  // sheetData: drop rows, renumber the rest, rewrite their formulas
  xml = xml.replace(ROW_RE, (whole, attrs: string, _end, inner?: string) => {
    const r = Number(attrs.match(/\br="(\d+)"/)?.[1])
    if (!r) return whole
    if (all.has(r)) return ""
    const nr = newRow(r)
    const rowAttrs = setAttr(attrs, "r", String(nr))
    if (inner == null) return `<row${rowAttrs}/>`
    const cells = inner.replace(CELL_RE, (_w, cAttrs: string, _e, cInner?: string) => {
      const a = cAttrs.replace(/\br="([A-Z]+)\d+"/, (_m, col) => `r="${col}${nr}"`)
      if (cInner == null) return `<c${a}/>`
      const body = cInner.replace(F_RE, (_f, fAttrs: string, _fe, fText?: string) => {
        const fa = fAttrs.replace(/\bref="([^"]+)"/, (_m, ref) => `ref="${remapRange(ref) ?? ref}"`)
        return fText == null ? `<f${fa}/>` : `<f${fa}>${xmlEscape(remapFormula(xmlUnescape(fText)))}</f>`
      })
      return `<c${a}>${body}</c>`
    })
    return `<row${rowAttrs}>${cells}</row>`
  })

  xml = xml
    .replace(/<dimension\b[^>]*>/, (t) => t.replace(/\bref="([^"]+)"/, (_m, ref) => `ref="${remapRange(ref) ?? ref}"`))
    .replace(/<(sheetView|pane)\b[^>]*>/g, (t) =>
      t.replace(/\btopLeftCell="([^"]+)"/, (_m, ref) => `topLeftCell="${remapRange(ref, true)}"`))
    .replace(/<selection\b[^>]*>/g, (t) =>
      t.replace(/\b(activeCell|sqref)="([^"]+)"/g, (_m, attr, ref) => `${attr}="${remapSqref(ref, true)}"`))
    // merges: drop those that are gone or shrink to a single cell
    .replace(/<mergeCell\b[^>]*\/>/g, (t) => {
      const ref = t.match(/\bref="([^"]+)"/)?.[1] || ""
      const next = remapRange(ref)
      if (!next || !next.includes(":") || next.split(":")[0] === next.split(":")[1]) return ""
      return setAttr(t, "ref", next)
    })
    .replace(/<mergeCells\b[^>]*>([\s\S]*?)<\/mergeCells>/, (_t, inner: string) => {
      const n = (inner.match(/<mergeCell\b/g) || []).length
      return n ? `<mergeCells count="${n}">${inner}</mergeCells>` : ""
    })
    .replace(/<conditionalFormatting\b([^>]*)>([\s\S]*?)<\/conditionalFormatting>/g, (_t, attrs: string, inner: string) => {
      const sq = remapSqref(attrs.match(/\bsqref="([^"]*)"/)?.[1] || "")
      if (!sq) return ""
      const body = inner.replace(/<formula>([^<]*)<\/formula>/g, (_m, f) => `<formula>${xmlEscape(remapFormula(xmlUnescape(f)))}</formula>`)
      return `<conditionalFormatting${setAttr(attrs, "sqref", sq)}>${body}</conditionalFormatting>`
    })
    .replace(/<dataValidation\b([^>]*?)(\/>|>([\s\S]*?)<\/dataValidation>)/g, (_t, attrs: string, _e, inner?: string) => {
      const sq = remapSqref(attrs.match(/\bsqref="([^"]*)"/)?.[1] || "")
      if (!sq) return ""
      const a = setAttr(attrs, "sqref", sq)
      if (inner == null) return `<dataValidation${a}/>`
      const body = inner.replace(/<(formula[12])>([^<]*)<\/\1>/g, (_m, tag, f) => `<${tag}>${xmlEscape(remapFormula(xmlUnescape(f)))}</${tag}>`)
      return `<dataValidation${a}>${body}</dataValidation>`
    })
    .replace(/<dataValidations\b([^>]*)>([\s\S]*?)<\/dataValidations>/, (_t, attrs: string, inner: string) => {
      const n = (inner.match(/<dataValidation\b/g) || []).length
      return n ? `<dataValidations${setAttr(attrs, "count", String(n))}>${inner}</dataValidations>` : ""
    })
    .replace(/<(hyperlink|ignoredError)\b[^>]*\/>/g, (t, tag: string) => {
      const attr = tag === "hyperlink" ? "ref" : "sqref"
      const next = remapSqref(t.match(new RegExp(`\\b${attr}="([^"]*)"`))?.[1] || "")
      return next ? setAttr(t, attr, next) : ""
    })
    .replace(/<hyperlinks>\s*<\/hyperlinks>|<ignoredErrors>\s*<\/ignoredErrors>/g, "")
    .replace(/<autoFilter\b[^>]*>/, (t) => t.replace(/\bref="([^"]+)"/, (_m, ref) => `ref="${remapRange(ref) ?? ref}"`))
    // manual page breaks were laid out for the full sheet; let Excel paginate
    .replace(/<rowBreaks\b[^>]*(\/>|>[\s\S]*?<\/rowBreaks>)/, "")
  zip.file(sheet.path, xml)

  // print area and other names pointing into this sheet
  let wbXml = await zip.file("xl/workbook.xml")!.async("string")
  wbXml = wbXml.replace(/<definedName\b([^>]*)>([^<]*)<\/definedName>/g, (_t, attrs: string, text: string) =>
    `<definedName${attrs}>${xmlEscape(remapQualified(xmlUnescape(text)))}</definedName>`)
  zip.file("xl/workbook.xml", wbXml)

  // formulas on other sheets that read from this one
  const wbRels = await zip.file("xl/_rels/workbook.xml.rels")!.async("string")
  for (const path of relTargets(wbRels, "worksheet", "xl")) {
    const file = zip.file(path)
    if (path === sheet.path || !file) continue
    const other = unshareFormulas(await file.async("string")).replace(
      new RegExp(F_RE.source, "g"),
      (t, fAttrs: string, _e, fText?: string) =>
        fText == null ? t : `<f${fAttrs}>${xmlEscape(remapQualified(xmlUnescape(fText)))}</f>`,
    )
    zip.file(path, other)
  }

  // images (logos, stamps) and tables anchored to this sheet's rows
  const dir = sheet.path.slice(0, sheet.path.lastIndexOf("/"))
  const relsFile = zip.file(`${dir}/_rels/${sheet.path.slice(dir.length + 1)}.rels`)
  if (!relsFile) return
  const sheetRels = await relsFile.async("string")
  for (const path of relTargets(sheetRels, "drawing", dir)) {
    const file = zip.file(path)
    if (!file) continue
    const drawing = (await file.async("string")).replace(
      /<(\w+:)?row>(\d+)<\/(\w+:)?row>/g,
      (_t, p1 = "", n: string, p2 = "") => `<${p1}row>${newRow(keptFrom(+n + 1)) - 1}</${p2}row>`,
    )
    zip.file(path, drawing)
  }
  for (const path of relTargets(sheetRels, "table", dir)) {
    const file = zip.file(path)
    if (!file) continue
    const table = (await file.async("string")).replace(/\bref="([^"]+)"/g, (_m, ref) => `ref="${remapRange(ref) ?? ref}"`)
    zip.file(path, table)
  }
}

// ---- recalculation ----

/**
 * Makes Excel recompute every formula on open: drops cached formula results
 * (they still hold the original sheet's totals) and the calculation chain,
 * and sets fullCalcOnLoad.
 */
export async function forceFullRecalc(zip: JSZip) {
  let wbXml = await zip.file("xl/workbook.xml")!.async("string")
  if (/<calcPr\b/.test(wbXml)) {
    wbXml = wbXml.replace(/<calcPr\b([^>]*?)(\/?)>/, (_t, attrs: string, slash: string) =>
      `<calcPr${attrs.replace(/\sfullCalcOnLoad="[^"]*"/, "")} fullCalcOnLoad="1"${slash}>`)
  } else {
    // calcPr goes right after definedNames, before any of these
    const next = wbXml.search(/<(oleSize|customWorkbookViews|pivotCaches|smartTagPr|smartTagTypes|webPublishing|fileRecoveryPr|webPublishObjects|extLst)\b|<\/workbook>/)
    wbXml = wbXml.slice(0, next) + `<calcPr fullCalcOnLoad="1"/>` + wbXml.slice(next)
  }
  zip.file("xl/workbook.xml", wbXml)

  const wbRels = await zip.file("xl/_rels/workbook.xml.rels")!.async("string")
  for (const path of relTargets(wbRels, "calcChain", "xl")) zip.remove(path)
  zip.file("xl/_rels/workbook.xml.rels", wbRels.replace(/<Relationship\b[^>]*Type="[^"]*\/calcChain"[^>]*\/>/g, ""))
  const ctFile = zip.file("[Content_Types].xml")
  if (ctFile) {
    const ct = await ctFile.async("string")
    zip.file("[Content_Types].xml", ct.replace(/<Override\b[^>]*PartName="[^"]*calcChain\.xml"[^>]*\/>/g, ""))
  }

  for (const path of relTargets(wbRels, "worksheet", "xl")) {
    const file = zip.file(path)
    if (!file) continue
    const xml = (await file.async("string")).replace(CELL_RE, (whole, attrs: string, _e, inner?: string) =>
      inner && /<f\b/.test(inner)
        ? `<c${attrs.replace(/\st="[^"]*"/, "")}>${inner.replace(/<v>[\s\S]*?<\/v>|<v\/>/, "")}</c>`
        : whole)
    zip.file(path, xml)
  }
}
