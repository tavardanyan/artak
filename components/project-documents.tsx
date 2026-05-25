"use client"

import { useState, useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { Upload, FileText, Star, Trash2, Loader2, Download, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { uuidv4 } from "@/lib/utils/uuid"

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

interface Document {
  id: string
  file_name: string | null
  file_path: string | null
  mime_type: string | null
  file_size: number | null
  is_favorite: boolean
  created_at: string
}

interface PendingFile {
  file: File
  name: string
}

interface ProjectDocumentsProps {
  projectId: number
}

export function ProjectDocuments({ projectId }: ProjectDocumentsProps) {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([])
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { toast } = useToast()
  const supabase = createClient()

  useEffect(() => {
    fetchDocuments()
  }, [projectId])

  const fetchDocuments = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from("files")
      .select("id, file_name, file_path, mime_type, file_size, is_favorite, created_at")
      .eq("project_id", projectId)
      .order("is_favorite", { ascending: false })
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching documents:", error)
    } else {
      setDocuments(data || [])
    }
    setLoading(false)
  }

  const splitExt = (name: string): { base: string; ext: string } => {
    const idx = name.lastIndexOf(".")
    if (idx <= 0) return { base: name, ext: "" }
    return { base: name.slice(0, idx), ext: name.slice(idx) }
  }

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const valid: PendingFile[] = []
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        toast({
          title: "Չափի սխալ",
          description: `${file.name} - չափը գերազանցում է 50 ՄԲ`,
          variant: "destructive",
        })
        continue
      }
      // Only the base part is editable; extension is preserved
      valid.push({ file, name: splitExt(file.name).base })
    }
    if (valid.length > 0) {
      setPendingFiles(valid)
      setUploadDialogOpen(true)
    }
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const removePending = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index))
  }

  const updatePendingName = (index: number, name: string) => {
    setPendingFiles(prev => prev.map((p, i) => (i === index ? { ...p, name } : p)))
  }

  const handleUpload = async () => {
    if (pendingFiles.length === 0) return
    setUploading(true)
    try {
      for (const { file, name } of pendingFiles) {
        const fileId = uuidv4()
        const { ext } = splitExt(file.name)
        const filePath = `documents/project/${projectId}/${fileId}${ext}`
        const finalName = (name.trim() || splitExt(file.name).base) + ext

        const { error: uploadError } = await supabase.storage
          .from("artak")
          .upload(filePath, file)

        if (uploadError) throw uploadError

        const { error: dbError } = await supabase.from("files").insert({
          id: fileId,
          file_path: filePath,
          file_name: finalName,
          mime_type: file.type,
          file_size: file.size,
          project_id: projectId,
          is_favorite: false,
        })
        if (dbError) throw dbError
      }
      toast({
        title: "Հաջողություն",
        description: `${pendingFiles.length} ֆայլ վերբեռնվեց`,
      })
      setPendingFiles([])
      setUploadDialogOpen(false)
      fetchDocuments()
    } catch (error: any) {
      console.error("Error uploading files:", error?.message || error, error?.details, error?.hint, error)
      toast({
        title: "Սխալ",
        description: error?.message || "Չհաջողվեց վերբեռնել ֆայլերը",
        variant: "destructive",
      })
    } finally {
      setUploading(false)
    }
  }

  const toggleFavorite = async (doc: Document) => {
    const { error } = await supabase
      .from("files")
      .update({ is_favorite: !doc.is_favorite })
      .eq("id", doc.id)
    if (!error) fetchDocuments()
  }

  const handleDelete = async (doc: Document) => {
    if (!confirm(`Ջնջե՞լ "${doc.file_name}"`)) return
    if (doc.file_path) {
      await supabase.storage.from("artak").remove([doc.file_path])
    }
    await supabase.from("files").delete().eq("id", doc.id)
    fetchDocuments()
  }

  const getDocumentUrl = (doc: Document) => {
    if (!doc.file_path) return null
    const { data } = supabase.storage.from("artak").getPublicUrl(doc.file_path)
    return data.publicUrl
  }

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return ""
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("hy-AM", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Փաստաթղթեր</CardTitle>
            <CardDescription>Նախագծի կից ֆայլեր (առավելագույնը 50 ՄԲ յուրաքանչյուրի համար)</CardDescription>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFilesSelected}
          />
          <Button onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4 mr-2" />
            Վերբեռնել
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground opacity-50 mb-2" />
            <p className="text-muted-foreground">Փաստաթղթեր չկան</p>
          </div>
        ) : (
          <div className="grid gap-2">
            {documents.map((doc) => {
              const isImage = doc.mime_type?.startsWith("image/")
              const url = getDocumentUrl(doc)
              return (
                <div
                  key={doc.id}
                  className="flex items-center gap-3 p-3 border rounded-md hover:bg-accent/50 group"
                >
                  <div
                    className="h-12 w-12 rounded bg-muted flex items-center justify-center shrink-0 cursor-pointer"
                    onClick={() => setPreviewDoc(doc)}
                  >
                    {isImage && url ? (
                      <img src={url} alt="" className="h-12 w-12 rounded object-cover" />
                    ) : (
                      <FileText className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => setPreviewDoc(doc)}
                  >
                    <p className="text-sm font-medium truncate">{doc.file_name || "Փաստաթուղթ"}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{formatDate(doc.created_at)}</span>
                      {doc.file_size && <span>· {formatFileSize(doc.file_size)}</span>}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => toggleFavorite(doc)}
                    title={doc.is_favorite ? "Հեռացնել ֆավորիտներից" : "Ավելացնել որպես ֆավորիտ"}
                  >
                    <Star className={cn("h-4 w-4", doc.is_favorite ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground")} />
                  </Button>
                  {url && (
                    <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                      <a href={url} download={doc.file_name || undefined} target="_blank" rel="noopener noreferrer">
                        <Download className="h-4 w-4" />
                      </a>
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 opacity-0 group-hover:opacity-100"
                    onClick={() => handleDelete(doc)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>

      {/* Upload Dialog - name files before uploading */}
      <Dialog open={uploadDialogOpen} onOpenChange={(open) => { if (!uploading) setUploadDialogOpen(open); if (!open) setPendingFiles([]) }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Վերբեռնել ֆայլեր</DialogTitle>
            <DialogDescription>Տվեք անուն յուրաքանչյուր ֆայլին նախքան վերբեռնելը</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {pendingFiles.map((p, i) => {
              const { ext } = splitExt(p.file.name)
              return (
                <div key={i} className="flex items-start gap-3">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs text-muted-foreground">{p.file.name} ({formatFileSize(p.file.size)})</Label>
                    <div className="flex items-stretch border rounded-md overflow-hidden focus-within:ring-2 focus-within:ring-ring">
                      <input
                        className="flex-1 px-3 py-2 text-sm bg-background outline-none"
                        value={p.name}
                        onChange={(e) => updatePendingName(i, e.target.value)}
                        placeholder="Ֆայլի անունը"
                      />
                      {ext && (
                        <span className="px-3 py-2 text-sm bg-muted text-muted-foreground border-l">
                          {ext}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="mt-6" onClick={() => removePending(i)} disabled={uploading}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )
            })}
            {pendingFiles.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Ֆայլեր չեն ընտրված</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setPendingFiles([]); setUploadDialogOpen(false) }} disabled={uploading}>
              Չեղարկել
            </Button>
            <Button onClick={handleUpload} disabled={uploading || pendingFiles.length === 0}>
              {uploading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Վերբեռնել ({pendingFiles.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={!!previewDoc} onOpenChange={(open) => { if (!open) setPreviewDoc(null) }}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] p-2">
          {previewDoc && (() => {
            const url = getDocumentUrl(previewDoc)
            const mime = previewDoc.mime_type
            if (!url) return null
            if (mime?.startsWith("image/")) {
              return <img src={url} alt="" className="w-full h-auto max-h-[85vh] object-contain" />
            }
            if (mime === "application/pdf") {
              return <iframe src={url} className="w-full h-[85vh]" />
            }
            return (
              <div className="flex flex-col items-center justify-center py-12 gap-4">
                <FileText className="h-16 w-16 text-muted-foreground" />
                <p className="text-center">{previewDoc.file_name}</p>
                <Button asChild>
                  <a href={url} download={previewDoc.file_name || undefined} target="_blank" rel="noopener noreferrer">
                    <Download className="h-4 w-4 mr-2" />
                    Ներբեռնել
                  </a>
                </Button>
              </div>
            )
          })()}
        </DialogContent>
      </Dialog>
    </Card>
  )
}
