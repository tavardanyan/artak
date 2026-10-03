"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { badgeVariants } from "@/components/ui/badge"
import { FileCheck } from "lucide-react"
import { cn } from "@/lib/utils"

interface CompletionDocSummary {
  id: number
  doc_no: number
  created_at: string
  checked_at: string | null
}

// Կատարողական acts of a project with their status (project overview);
// clicking one opens it in the Ծավալաթերթ tab
export function CompletionDocsCard({ projectId, onOpen }: { projectId: number; onOpen: (docId: number) => void }) {
  const [docs, setDocs] = useState<CompletionDocSummary[]>([])

  useEffect(() => {
    createClient()
      .from("volume_sheet")
      .select("completion_doc(id, doc_no, created_at, checked_at)")
      .eq("project_id", projectId)
      .maybeSingle()
      .then(({ data }) => {
        const list = (data?.completion_doc || []) as CompletionDocSummary[]
        setDocs(list.sort((a, b) => a.doc_no - b.doc_no))
      })
  }, [projectId])

  if (docs.length === 0) return null

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Կատարողականներ</CardTitle>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {docs.filter((d) => d.checked_at).length}/{docs.length} ստուգված
          <FileCheck className="h-4 w-4" />
        </span>
      </CardHeader>
      <CardContent className="grid gap-x-6 gap-y-1 md:grid-cols-2 lg:grid-cols-3">
        {docs.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => onOpen(d.id)}
            className="flex items-center justify-between gap-2 text-sm rounded px-2 py-1 -mx-2 hover:bg-accent text-left"
          >
            <span className="flex items-center gap-1.5 min-w-0">
              <span className={cn("h-2 w-2 rounded-full shrink-0", d.checked_at ? "bg-green-500" : "bg-red-500")} />
              <span className="truncate">Կատարողական {d.doc_no}</span>
              <span className="text-xs text-muted-foreground shrink-0">
                {new Date(d.created_at).toLocaleDateString("en-GB")}
              </span>
            </span>
            <span className={cn(badgeVariants({ variant: d.checked_at ? "success" : "error" }), "shrink-0 px-1.5 text-[10px]")}>
              {d.checked_at ? "Ստուգված" : "Չստուգված"}
            </span>
          </button>
        ))}
      </CardContent>
    </Card>
  )
}
