"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { badgeVariants } from "@/components/ui/badge"
import { FileCheck } from "lucide-react"
import { cn } from "@/lib/utils"
import { VAT_RATE } from "@/components/volume-sheet-section"

interface CompletionDocSummary {
  id: number
  doc_no: number
  created_at: string
  checked_at: string | null
  total: number // without ԱԱՀ
}

const amd = (n: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n) + " ֏"

// Կատարողական acts of a project with their status (project overview);
// clicking one opens it in the Ծավալաթերթ tab
export function CompletionDocsCard({ projectId, onOpen }: { projectId: number; onOpen: (docId: number) => void }) {
  const [docs, setDocs] = useState<CompletionDocSummary[] | null>(null)

  useEffect(() => {
    createClient()
      .from("volume_sheet")
      .select("completion_doc(id, doc_no, created_at, checked_at, completion_doc_row(qty, volume_sheet_row(price)))")
      .eq("project_id", projectId)
      .maybeSingle()
      .then(({ data }) => {
        // totals use the Ծավալաթերթ price, as the act view and tab badges do
        const list: CompletionDocSummary[] = (data?.completion_doc || []).map((d: any) => ({
          id: d.id,
          doc_no: d.doc_no,
          created_at: d.created_at,
          checked_at: d.checked_at,
          total: (d.completion_doc_row || []).reduce(
            (s: number, r: any) => s + r.qty * (r.volume_sheet_row?.price || 0),
            0
          ),
        }))
        setDocs(list.sort((a, b) => a.doc_no - b.doc_no))
      })
  }, [projectId])

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-sm font-medium">Կատարողականներ</CardTitle>
        {docs && docs.length > 0 && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <FileCheck className="h-3.5 w-3.5" />
            {docs.filter((d) => d.checked_at).length}/{docs.length}
          </span>
        )}
      </CardHeader>
      <CardContent>
        {docs && docs.length === 0 && <p className="text-sm text-muted-foreground py-2">Կատարողականներ չկան</p>}
        {docs && docs.length > 0 && (
          <div className="space-y-1 max-h-[180px] overflow-y-auto">
            {docs.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => onOpen(d.id)}
                className="w-full flex items-start justify-between gap-2 text-sm rounded px-1 py-1 hover:bg-accent/50 text-left"
              >
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5">
                    <span className={cn("h-2 w-2 rounded-full shrink-0", d.checked_at ? "bg-green-500" : "bg-red-500")} />
                    <span className="truncate">Կատարողական {d.doc_no}</span>
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {new Date(d.created_at).toLocaleDateString("en-GB")}
                  </span>
                </span>
                <span className="flex flex-col items-end gap-0.5 shrink-0">
                  {/* total incl. ԱԱՀ, like the act's last "Ընդամենը" row */}
                  <span
                    className="font-medium tabular-nums"
                    title={`Առանց ԱԱՀ՝ ${amd(d.total)} · ԱԱՀ ${VAT_RATE * 100}%՝ ${amd(d.total * VAT_RATE)}`}
                  >
                    {amd(d.total * (1 + VAT_RATE))}
                  </span>
                  <span className={cn(badgeVariants({ variant: d.checked_at ? "success" : "error" }), "px-1.5 text-[10px]")}>
                    {d.checked_at ? "Ստուգված" : "Չստուգված"}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
