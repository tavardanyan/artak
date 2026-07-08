"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Check, Search } from "lucide-react"
import { stringSimilarity } from "@/lib/levenshtein"
import { LabelCell } from "@/components/label-cell"
import { LabelFilter } from "@/components/label-filter"

interface Item {
  id: number
  name: string
  unit: string | null
  created_at: string
  parent: number | null
  seen: boolean | null
  label: number
}

interface ParentSuggestion {
  id: number
  name: string
  similarity: number
}

const ITEMS_PER_PAGE = 20

export default function UncheckedItemsPage() {
  const [items, setItems] = useState<Item[]>([])
  const [allParentItems, setAllParentItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [processingItems, setProcessingItems] = useState<Set<number>>(new Set())
  const [selectedParents, setSelectedParents] = useState<Record<number, number | null>>({})
  const [matchLimit, setMatchLimit] = useState(10)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const [labelFilter, setLabelFilter] = useState<number | null>(null)
  const [searchQuery, setSearchQuery] = useState("")

  const { toast } = useToast()
  const supabase = createClient()

  useEffect(() => {
    fetchMatchLimit()
    fetchAllParentItems()
  }, [])

  useEffect(() => {
    fetchItems()
  }, [currentPage])

  const fetchMatchLimit = async () => {
    const { data } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "item_matching_limit")
      .single()
    if (data?.value) setMatchLimit(Number(data.value))
  }

  const fetchAllParentItems = async () => {
    // Supabase caps a single request at 1000 rows — page through ALL parentless
    // items, otherwise recently created/confirmed items silently vanish from
    // the similarity suggestions
    const all: Item[] = []
    const pageSize = 1000
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await supabase
        .from("item")
        .select("id, name, unit, created_at, parent, seen, label")
        .is("parent", null)
        .order("id")
        .range(from, from + pageSize - 1)
      if (error) {
        console.error("Error fetching parent items:", error)
        break
      }
      all.push(...(data || []))
      if (!data || data.length < pageSize) break
    }
    setAllParentItems(all)
  }

  const fetchItems = async () => {
    setLoading(true)
    try {
      const { count } = await supabase
        .from("item")
        .select("*", { count: "exact", head: true })
        .is("parent", null)
        .or("seen.is.null,seen.eq.false")

      setTotalItems(count || 0)

      const { data, error } = await supabase
        .from("item")
        .select("id, name, unit, created_at, parent, seen, label")
        .is("parent", null)
        .or("seen.is.null,seen.eq.false")
        .order("created_at", { ascending: false })
        .range((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE - 1)

      if (error) throw error
      setItems(data || [])
    } catch (error: any) {
      console.error("Error:", error)
      toast({ title: "Սխալ", description: error?.message || "Չհաջողվեց բեռնել ապրանքները", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  // Collapse repeated whitespace and trim so formatting noise doesn't dilute similarity
  const normalizeName = (s: string) => s.trim().replace(/\s+/g, " ")

  const getParentSuggestions = (itemName: string, currentItemId: number): ParentSuggestion[] => {
    const target = normalizeName(itemName)
    return allParentItems
      .filter((item) => item.id !== currentItemId)
      .map((item) => ({ id: item.id, name: item.name, similarity: stringSimilarity(target, normalizeName(item.name)) }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, matchLimit)
  }

  const handleDone = async (item: Item) => {
    setProcessingItems((prev) => new Set(prev).add(item.id))
    try {
      const parentId = selectedParents[item.id] || null
      const { error: updateError } = await supabase
        .from("item")
        .update({ seen: true, parent: parentId })
        .eq("id", item.id)
      if (updateError) throw updateError
      if (parentId) {
        await supabase.from("transfer_item").update({ item_id: parentId }).eq("item_id", item.id)
      }
      setItems((prev) => prev.filter((i) => i.id !== item.id))
      setTotalItems((prev) => prev - 1)
      // Keep the suggestion pool in sync: an item linked to a parent is a child
      // now (not a parent candidate); a confirmed standalone item must be offered
      // as a parent for the remaining unchecked ones
      if (parentId) {
        setAllParentItems((prev) => prev.filter((p) => p.id !== item.id))
      } else {
        setAllParentItems((prev) =>
          prev.some((p) => p.id === item.id)
            ? prev.map((p) => (p.id === item.id ? { ...p, seen: true } : p))
            : [...prev, { ...item, seen: true }]
        )
      }
      toast({ title: "Հաջողություն", description: parentId ? "Ապրանքը կապվեց" : "Նշվեց դիտված" })
    } catch (error: any) {
      console.error("Error:", error)
      toast({ title: "Սխալ", description: error?.message, variant: "destructive" })
    } finally {
      setProcessingItems((prev) => {
        const n = new Set(prev); n.delete(item.id); return n
      })
    }
  }

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString("hy-AM", { year: "numeric", month: "short", day: "numeric" })
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE)

  const handleSetLabel = async (itemId: number, label: number) => {
    setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, label } : i)))
    const { error } = await supabase.from("item").update({ label }).eq("id", itemId)
    if (error) {
      toast({ title: "Սխալ", description: error.message, variant: "destructive" })
      fetchItems()
    }
  }

  // Google-like relevance: exact > substring > all words present > fuzzy similarity
  const searchScore = (name: string, query: string): number => {
    const n = normalizeName(name).toLowerCase()
    const q = normalizeName(query).toLowerCase()
    if (!q) return 0
    if (n === q) return 200
    if (n.startsWith(q)) return 160
    if (n.includes(q)) return 150
    const tokens = q.split(" ").filter(Boolean)
    if (tokens.length > 1 && tokens.every((t) => n.includes(t))) return 120
    return stringSimilarity(q, n)
  }

  const isSearching = searchQuery.trim().length > 0

  // Search runs over ALL unchecked items (every page), ranked by relevance
  const searchResults = isSearching
    ? allParentItems
        .filter((i) => i.seen !== true)
        .map((i) => ({ item: i, score: searchScore(i.name, searchQuery) }))
        .filter((r) => r.score >= 40)
        .sort((a, b) => b.score - a.score)
        .map((r) => r.item)
    : []

  const baseItems = isSearching ? searchResults : items
  const visibleItems = labelFilter == null ? baseItems : baseItems.filter((i) => (i.label ?? 0) === labelFilter)

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Չստուգված ապրանքներ</h2>
        <p className="text-sm text-muted-foreground">Ստուգեք և կապեք նոր ապրանքները գոյություն ունեցող ապրանքների հետ</p>
      </div>

      <Card>
        <CardHeader className="pb-3 space-y-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              {isSearching ? `Գտնվեց ${visibleItems.length}` : `Ընդամենը ${totalItems}`}
            </CardTitle>
            <LabelFilter value={labelFilter} onChange={setLabelFilter} />
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Որոնել ապրանք անվանումով (նաև մոտավոր համընկնումներ)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-11 text-base"
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading && !isSearching ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : visibleItems.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              {isSearching ? "Համընկնումներ չեն գտնվել" : "Բոլոր ապրանքները ստուգված են"}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow className="text-xs">
                    <TableHead className="w-[40px] py-2"></TableHead>
                    <TableHead className="w-[33%] py-2">Անուն</TableHead>
                    <TableHead className="w-[10%] py-2">Միավոր</TableHead>
                    <TableHead className="w-[15%] py-2">Ստեղծման ա/թ</TableHead>
                    <TableHead className="w-[30%] py-2">Ծնող ապրանք</TableHead>
                    <TableHead className="w-[10%] py-2"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleItems.map((item) => {
                    const suggestions = getParentSuggestions(item.name, item.id)
                    const isProcessing = processingItems.has(item.id)
                    return (
                      <TableRow key={item.id} className="text-xs">
                        <TableCell className="py-2">
                          <LabelCell value={item.label} onChange={(next) => handleSetLabel(item.id, next)} disabled={isProcessing} />
                        </TableCell>
                        <TableCell className="font-medium py-2">{item.name}</TableCell>
                        <TableCell className="py-2">{item.unit || "-"}</TableCell>
                        <TableCell className="py-2">{formatDate(item.created_at)}</TableCell>
                        <TableCell className="py-2">
                          <Select
                            value={selectedParents[item.id]?.toString() || "none"}
                            onValueChange={(value) => setSelectedParents((prev) => ({ ...prev, [item.id]: value === "none" ? null : Number(value) }))}
                            disabled={isProcessing}
                          >
                            <SelectTrigger className="w-full h-8 text-xs"><SelectValue placeholder="Ընտրել ծնող ապրանք" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none" className="text-xs">Ոչ մեկը</SelectItem>
                              {suggestions.map((s) => (
                                <SelectItem key={s.id} value={s.id.toString()} className="text-xs">{s.name} ({s.similarity.toFixed(0)}%)</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="py-2">
                          <Button size="sm" onClick={() => handleDone(item)} disabled={isProcessing} className="h-7 text-xs">
                            {isProcessing ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Check className="h-3 w-3 mr-1" />Պատրաստ</>}
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
              {!isSearching && totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-xs text-muted-foreground">Էջ {currentPage} / {totalPages}</div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} className="h-7 text-xs">Նախորդ</Button>
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="h-7 text-xs">Հաջորդ</Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
