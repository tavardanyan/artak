"use client"

import { useState, useMemo, useCallback, useEffect } from "react"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  FileText,
  FileImage,
  FileSpreadsheet,
  File as FileIcon,
  Download,
  Eye,
  MoreVertical,
  Calendar,
  Plus,
  Upload,
  Monitor,
  X,
  Loader2,
  Search,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScannerComponent } from "@/components/scanner-component"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { uuidv4 } from "@/lib/utils/uuid"

const MAX_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB
const STORAGE_BUCKET = "artak"
const STORAGE_FOLDER = "documents/global"

interface DocumentRow {
  id: string
  created_at: string
  file_name: string | null
  file_path: string | null
  mime_type: string | null
  file_size: number | null
  type: string | null
  note: string | null
}

function getExt(name: string | null | undefined): string {
  if (!name) return ""
  const i = name.lastIndexOf(".")
  return i >= 0 ? name.slice(i + 1).toLowerCase() : ""
}

function isImage(mime: string | null | undefined, name: string | null | undefined): boolean {
  if (mime && mime.startsWith("image/")) return true
  const ext = getExt(name)
  return ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)
}

function isPdf(mime: string | null | undefined, name: string | null | undefined): boolean {
  if (mime === "application/pdf") return true
  return getExt(name) === "pdf"
}

function getFileIcon(name: string | null | undefined, mime: string | null | undefined) {
  if (isImage(mime, name)) return <FileImage className="h-12 w-12 text-blue-500" />
  if (isPdf(mime, name)) return <FileText className="h-12 w-12 text-red-500" />
  const ext = getExt(name)
  if (["xlsx", "xls", "csv"].includes(ext)) return <FileSpreadsheet className="h-12 w-12 text-green-500" />
  if (["doc", "docx"].includes(ext)) return <FileText className="h-12 w-12 text-blue-600" />
  return <FileIcon className="h-12 w-12 text-gray-500" />
}

function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return "—"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export default function DocumentsPage() {
  const supabase = createClient()
  const { toast } = useToast()

  const [docs, setDocs] = useState<DocumentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [filterType, setFilterType] = useState<string>("all")
  const [sortBy, setSortBy] = useState<string>("newest")

  // Upload dialog state
  const [uploadOpen, setUploadOpen] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)

  // Preview dialog state
  const [previewDoc, setPreviewDoc] = useState<DocumentRow | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const fetchDocs = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("files")
        .select("id, created_at, file_name, file_path, mime_type, file_size, type, note")
        .is("person_id", null)
        .is("partner_id", null)
        .is("project_id", null)
        .order("created_at", { ascending: false })
      if (error) throw error
      setDocs((data || []) as DocumentRow[])
    } catch (err: any) {
      toast({ title: "Սխալ", description: err.message || "Չհաջողվեց բեռնել փաստաթղթերը", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [supabase, toast])

  useEffect(() => { fetchDocs() }, [fetchDocs])

  const addFiles = useCallback((files: File[]) => {
    const okFiles: File[] = []
    const rejected: string[] = []
    for (const f of files) {
      if (f.size > MAX_SIZE_BYTES) rejected.push(f.name)
      else okFiles.push(f)
    }
    if (rejected.length > 0) {
      toast({
        title: "Չափի սահմանաչափ",
        description: `Հետևյալ ֆայլերը գերազանցում են 10 ՄԲ սահմանը. ${rejected.join(", ")}`,
        variant: "destructive",
      })
    }
    if (okFiles.length > 0) setSelectedFiles((prev) => [...prev, ...okFiles])
  }, [toast])

  const handleDragEnter = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true) }
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false) }
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation() }
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(false)
    addFiles(Array.from(e.dataTransfer.files))
  }
  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(Array.from(e.target.files))
    e.target.value = ""
  }
  const removeSelected = (i: number) => setSelectedFiles((prev) => prev.filter((_, idx) => idx !== i))

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return
    setUploading(true)
    let succeeded = 0
    let failed = 0
    for (const file of selectedFiles) {
      try {
        const fileId = uuidv4()
        const ext = getExt(file.name)
        const path = ext ? `${STORAGE_FOLDER}/${fileId}.${ext}` : `${STORAGE_FOLDER}/${fileId}`

        const { error: upErr } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(path, file, { contentType: file.type || undefined })
        if (upErr) throw upErr

        const { error: dbErr } = await supabase.from("files").insert({
          id: fileId,
          file_path: path,
          file_name: file.name,
          mime_type: file.type || null,
          file_size: file.size,
        })
        if (dbErr) {
          // Roll back the uploaded blob
          await supabase.storage.from(STORAGE_BUCKET).remove([path])
          throw dbErr
        }
        succeeded++
      } catch (err: any) {
        console.error("Upload failed:", err)
        failed++
      }
    }
    setUploading(false)
    setSelectedFiles([])
    setUploadOpen(false)

    if (succeeded > 0) toast({ title: "Հաջողություն", description: `${succeeded} ֆայլ վերբեռնվեց` })
    if (failed > 0) toast({ title: "Սխալ", description: `${failed} ֆայլ չհաջողվեց վերբեռնել`, variant: "destructive" })

    fetchDocs()
  }

  const getPublicUrl = (doc: DocumentRow): string | null => {
    if (!doc.file_path) return null
    return supabase.storage.from(STORAGE_BUCKET).getPublicUrl(doc.file_path).data.publicUrl
  }

  const handleView = (doc: DocumentRow) => {
    const url = getPublicUrl(doc)
    if (!url) return
    if (isImage(doc.mime_type, doc.file_name) || isPdf(doc.mime_type, doc.file_name)) {
      setPreviewDoc(doc)
      setPreviewUrl(url)
    } else {
      window.open(url, "_blank")
    }
  }

  const handleDownload = async (doc: DocumentRow) => {
    if (!doc.file_path) return
    try {
      const { data, error } = await supabase.storage.from(STORAGE_BUCKET).download(doc.file_path)
      if (error || !data) throw error || new Error("No data")
      const url = URL.createObjectURL(data)
      const a = document.createElement("a")
      a.href = url
      a.download = doc.file_name || "file"
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err: any) {
      toast({ title: "Սխալ", description: err.message || "Չհաջողվեց ներբեռնել", variant: "destructive" })
    }
  }

  const handleDelete = async (doc: DocumentRow) => {
    if (!confirm(`Ջնջե՞լ "${doc.file_name}"-ը։ Այս գործողությունն անհետացնելի է։`)) return
    try {
      if (doc.file_path) {
        await supabase.storage.from(STORAGE_BUCKET).remove([doc.file_path])
      }
      const { error } = await supabase.from("files").delete().eq("id", doc.id)
      if (error) throw error
      toast({ title: "Հաջողություն", description: "Փաստաթուղթը ջնջվեց" })
      fetchDocs()
    } catch (err: any) {
      toast({ title: "Սխալ", description: err.message || "Չհաջողվեց ջնջել", variant: "destructive" })
    }
  }

  const uniqueExtensions = useMemo(() => {
    const set = new Set<string>()
    docs.forEach((d) => { const e = getExt(d.file_name); if (e) set.add(e) })
    return Array.from(set).sort()
  }, [docs])

  const filteredDocs = useMemo(() => {
    let list = docs.filter((d) => {
      if (filterType !== "all" && getExt(d.file_name) !== filterType) return false
      if (search.trim()) {
        const q = search.toLowerCase()
        return (d.file_name || "").toLowerCase().includes(q) || (d.note || "").toLowerCase().includes(q)
      }
      return true
    })
    list = [...list].sort((a, b) => {
      switch (sortBy) {
        case "newest": return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        case "oldest": return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        case "name": return (a.file_name || "").localeCompare(b.file_name || "")
        case "size_desc": return (b.file_size || 0) - (a.file_size || 0)
        default: return 0
      }
    })
    return list
  }, [docs, filterType, search, sortBy])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Փաստաթղթեր</h2>
          <p className="text-muted-foreground">Ընդհանուր ֆայլերի պահոց. վերբեռնեք, ներբեռնեք և դիտեք</p>
        </div>
        <Button onClick={() => setUploadOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Ավելացնել ֆայլ
        </Button>
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Փնտրել ըստ անվան..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Ֆայլի տեսակ" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Բոլոր տեսակները</SelectItem>
            {uniqueExtensions.map((e) => <SelectItem key={e} value={e}>{e.toUpperCase()}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Նորագույն</SelectItem>
            <SelectItem value="oldest">Հնագույն</SelectItem>
            <SelectItem value="name">Անվան պատվով</SelectItem>
            <SelectItem value="size_desc">Չափով (նվազման)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="text-sm text-muted-foreground">
        Ցուցադրվում է {filteredDocs.length} ֆայլ
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filteredDocs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <FileIcon className="h-16 w-16 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">Փաստաթղթեր չեն գտնվել</h3>
          <p className="text-sm text-muted-foreground">
            {docs.length === 0 ? "Սկսելու համար վերբեռնեք ձեր առաջին ֆայլը" : "Փոխեք ֆիլտրերը կամ որոնման պայմանները"}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredDocs.map((doc) => {
            const ext = getExt(doc.file_name)
            const previewable = isImage(doc.mime_type, doc.file_name) || isPdf(doc.mime_type, doc.file_name)
            return (
              <Card key={doc.id} className="group hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex flex-col items-center space-y-3">
                    <div
                      className="p-4 bg-muted rounded-lg cursor-pointer hover:bg-muted/70"
                      onClick={() => previewable && handleView(doc)}
                      title={previewable ? "Կտտացրեք դիտելու համար" : ""}
                    >
                      {getFileIcon(doc.file_name, doc.mime_type)}
                    </div>
                    <div className="w-full space-y-1.5">
                      <h3 className="font-semibold truncate text-center text-sm" title={doc.file_name || ""}>
                        {doc.file_name || "—"}
                      </h3>
                      <div className="flex flex-wrap gap-1 justify-center">
                        {ext && <Badge variant="secondary" className="text-xs">{ext.toUpperCase()}</Badge>}
                        <Badge variant="outline" className="text-xs">{formatBytes(doc.file_size)}</Badge>
                      </div>
                      <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        <span>{new Date(doc.created_at).toLocaleDateString("hy-AM")}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="p-3 pt-0 flex justify-center gap-2">
                  {previewable && (
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => handleView(doc)}>
                      <Eye className="h-4 w-4 mr-1" />Դիտել
                    </Button>
                  )}
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => handleDownload(doc)}>
                    <Download className="h-4 w-4 mr-1" />Ներբեռնել
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="outline">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleDownload(doc)}>Ներբեռնել</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDelete(doc)} className="text-red-600 focus:text-red-600">
                        Ջնջել
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardFooter>
              </Card>
            )
          })}
        </div>
      )}

      {/* Upload Dialog */}
      <Dialog open={uploadOpen} onOpenChange={(o) => { if (!uploading) { setUploadOpen(o); if (!o) setSelectedFiles([]) } }}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Ավելացնել նոր փաստաթուղթ</DialogTitle>
            <DialogDescription>Մեկ ֆայլի առավելագույն չափը՝ 10 ՄԲ</DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="upload" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="upload">Վերբեռնել</TabsTrigger>
              <TabsTrigger value="scan">Սկանավորել</TabsTrigger>
            </TabsList>

            <TabsContent value="upload" className="space-y-4 py-4">
              <div
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-muted-foreground/50"
                }`}
              >
                <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-sm font-medium mb-1">Քաշեք և թողեք ֆայլերը այստեղ</p>
                <p className="text-xs text-muted-foreground">կամ սեղմեք ներքևի կոճակը՝ ֆայլ ընտրելու համար</p>
              </div>
              <div className="relative">
                <input
                  type="file"
                  multiple
                  onChange={handleFileInput}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <Button type="button" variant="outline" className="w-full h-20 flex flex-col gap-2">
                  <Monitor className="h-8 w-8" />
                  <span>Ընտրել համակարգչից</span>
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="scan" className="space-y-4 py-4">
              <ScannerComponent onScanned={(files) => addFiles(files)} />
            </TabsContent>
          </Tabs>

          {selectedFiles.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Ընտրված ֆայլեր ({selectedFiles.length})</p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {selectedFiles.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-muted rounded-lg">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <FileIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm truncate">{file.name}</p>
                        <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
                      </div>
                    </div>
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeSelected(index)} disabled={uploading}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => { setSelectedFiles([]); setUploadOpen(false) }} disabled={uploading}>
                  Չեղարկել
                </Button>
                <Button type="button" onClick={handleUpload} disabled={uploading}>
                  {uploading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Վերբեռնել ({selectedFiles.length})
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={!!previewDoc} onOpenChange={(o) => { if (!o) { setPreviewDoc(null); setPreviewUrl(null) } }}>
        <DialogContent className="sm:max-w-[90vw] sm:max-h-[90vh] p-0 overflow-hidden">
          <DialogHeader className="p-4 border-b">
            <DialogTitle className="truncate">{previewDoc?.file_name}</DialogTitle>
            <DialogDescription className="flex items-center gap-3 text-xs">
              <span>{formatBytes(previewDoc?.file_size)}</span>
              {previewDoc && (
                <Button size="sm" variant="outline" onClick={() => handleDownload(previewDoc)}>
                  <Download className="h-3.5 w-3.5 mr-1" /> Ներբեռնել
                </Button>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="w-full" style={{ height: "calc(90vh - 96px)" }}>
            {previewDoc && previewUrl ? (
              isImage(previewDoc.mime_type, previewDoc.file_name) ? (
                <div className="w-full h-full flex items-center justify-center bg-muted/30 overflow-auto">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={previewUrl} alt={previewDoc.file_name || ""} className="max-w-full max-h-full" />
                </div>
              ) : isPdf(previewDoc.mime_type, previewDoc.file_name) ? (
                <iframe src={previewUrl} title={previewDoc.file_name || ""} className="w-full h-full border-0" />
              ) : null
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
