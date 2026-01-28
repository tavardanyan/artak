"use client"

import { useState, useEffect, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Plus, Search, Package, X } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"

interface Item {
  id: number
  created_at: string
  name: string
  atg: string | null
  code: string | null
  unit: string | null
  seen: boolean | null
  parent: number | null
  parent_item?: {
    name: string
  } | null
}

interface ParentItem {
  id: number
  name: string
}

export default function ItemsPage() {
  const [items, setItems] = useState<Item[]>([])
  const [parentItems, setParentItems] = useState<ParentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [updatingItemId, setUpdatingItemId] = useState<number | null>(null)
  const [parentSearchQuery, setParentSearchQuery] = useState("")

  // New item form state
  const [newItemName, setNewItemName] = useState("")
  const [newItemAtg, setNewItemAtg] = useState("")
  const [newItemCode, setNewItemCode] = useState("")
  const [newItemUnit, setNewItemUnit] = useState("")
  const [newItemParent, setNewItemParent] = useState<string>("")

  const { toast } = useToast()
  const supabase = createClient()
  const itemsPerPage = 50 // Reduced from 100 for better performance

  // Debounce parent search query
  useEffect(() => {
    const timer = setTimeout(() => {
      if (parentSearchQuery) {
        fetchParentItems(parentSearchQuery)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [parentSearchQuery])

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery)
      setCurrentPage(1) // Reset to first page on search
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery])

  useEffect(() => {
    fetchItems()
    fetchParentItems()
  }, [currentPage, debouncedSearchQuery])

  const fetchItems = async () => {
    try {
      setLoading(true)

      // Build query
      let query = supabase
        .from("item")
        .select("*", { count: "exact" })

      // Apply search filter
      if (debouncedSearchQuery) {
        query = query.or(`name.ilike.%${debouncedSearchQuery}%,atg.ilike.%${debouncedSearchQuery}%,code.ilike.%${debouncedSearchQuery}%`)
      }

      // Apply pagination
      const { data, error, count } = await query
        .order("created_at", { ascending: false })
        .range((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage - 1)

      if (error) throw error

      // Get unique parent IDs
      const parentIds = [...new Set((data || [])
        .map((item: any) => item.parent)
        .filter((id): id is number => id !== null))]

      // Fetch all parent names in a single query
      let parentsMap: Record<number, string> = {}
      if (parentIds.length > 0) {
        const { data: parentsData } = await supabase
          .from("item")
          .select("id, name")
          .in("id", parentIds)

        if (parentsData) {
          parentsMap = parentsData.reduce((acc, parent) => {
            acc[parent.id] = parent.name
            return acc
          }, {} as Record<number, string>)
        }
      }

      // Map parent names to items
      const itemsWithParents = (data || []).map((item: any) => ({
        ...item,
        parent_item: item.parent ? { name: parentsMap[item.parent] || "Unknown" } : null
      }))

      setItems(itemsWithParents as unknown as Item[])
      setTotalItems(count || 0)
    } catch (error) {
      console.error("Error fetching items:", error)
      toast({
        title: "Սխալ",
        description: "Չհաջողվեց բեռնել ապրանքները",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchParentItems = async (searchTerm: string = "") => {
    try {
      let query = supabase
        .from("item")
        .select("id, name")
        .is("parent", null)

      // Apply search filter if provided
      if (searchTerm) {
        query = query.ilike("name", `%${searchTerm}%`)
      }

      const { data, error } = await query
        .order("name", { ascending: true })
        .limit(50) // Only load 50 at a time for performance

      if (error) throw error

      setParentItems(data || [])
    } catch (error) {
      console.error("Error fetching parent items:", error)
    }
  }

  const handleParentChange = async (itemId: number, newParentId: string | null) => {
    try {
      setUpdatingItemId(itemId)

      const { error } = await supabase
        .from("item")
        .update({ parent: newParentId ? parseInt(newParentId) : null })
        .eq("id", itemId)

      if (error) throw error

      toast({
        title: "Հաջողություն",
        description: "Ծնողը թարմացվեց",
      })

      await fetchItems()
      await fetchParentItems()
    } catch (error) {
      console.error("Error updating parent:", error)
      toast({
        title: "Սխալ",
        description: "Չհաջողվեց թարմացնել ծնողը",
        variant: "destructive",
      })
    } finally {
      setUpdatingItemId(null)
    }
  }

  const handleCreateItem = async () => {
    if (!newItemName.trim()) {
      toast({
        title: "Սխալ",
        description: "Անվանումը պարտադիր է",
        variant: "destructive",
      })
      return
    }

    try {
      setIsCreating(true)

      const { error } = await supabase
        .from("item")
        .insert({
          name: newItemName.trim(),
          atg: newItemAtg.trim() || null,
          code: newItemCode.trim() || null,
          unit: newItemUnit.trim() || null,
          parent: newItemParent ? parseInt(newItemParent) : null,
          seen: true,
        })

      if (error) throw error

      toast({
        title: "Հաջողություն",
        description: "Ապրանքը ստեղծվեց",
      })

      setIsCreateDialogOpen(false)
      setNewItemName("")
      setNewItemAtg("")
      setNewItemCode("")
      setNewItemUnit("")
      setNewItemParent("")
      await fetchItems()
      await fetchParentItems()
    } catch (error: any) {
      console.error("Error creating item:", error)
      toast({
        title: "Սխալ",
        description: error.message || "Չհաջողվեց ստեղծել ապրանքը",
        variant: "destructive",
      })
    } finally {
      setIsCreating(false)
    }
  }

  const totalPages = Math.ceil(totalItems / itemsPerPage)

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Ապրանքներ</h2>
        <p className="text-sm text-muted-foreground">
          Կառավարեք ապրանքների ցանկը և նրանց ծնող-ապրանքների կապերը
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Ապրանքների ցանկ ({totalItems})</CardTitle>
              <CardDescription>
                Բոլոր ապրանքները և նրանց ծնող-ապրանքները
              </CardDescription>
            </div>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Ավելացնել ապրանք
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Search */}
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Փնտրել ըստ անվանման, ԱՏԳ կոդի կամ կոդի..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
              {searchQuery !== debouncedSearchQuery && (
                <Loader2 className="absolute right-2 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-12">
              <Package className="mx-auto h-12 w-12 text-muted-foreground opacity-50" />
              <p className="mt-2 text-sm text-muted-foreground">
                {searchQuery ? "Ապրանքներ չեն գտնվել" : "Ապրանքներ դեռ չկան"}
              </p>
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Անվանում</TableHead>
                      <TableHead>ԱՏԳ Կոդ</TableHead>
                      <TableHead>Կոդ</TableHead>
                      <TableHead>Միավոր</TableHead>
                      <TableHead>Ծնող</TableHead>
                      <TableHead>Կարգավիճակ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono text-xs">
                          {item.id}
                        </TableCell>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {item.atg || "-"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {item.code || "-"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {item.unit || "-"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  role="combobox"
                                  className="w-[200px] justify-between"
                                  disabled={updatingItemId === item.id}
                                >
                                  {item.parent_item?.name || "Ծնող չկա"}
                                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-[250px] p-0">
                                <Command shouldFilter={false}>
                                  <CommandInput
                                    placeholder="Փնտրել ծնող..."
                                    value={parentSearchQuery}
                                    onValueChange={setParentSearchQuery}
                                  />
                                  <CommandList>
                                    <CommandEmpty>Ապրանք չի գտնվել</CommandEmpty>
                                    <CommandGroup>
                                      <CommandItem
                                        value="none"
                                        onSelect={() => {
                                          handleParentChange(item.id, null)
                                          setParentSearchQuery("")
                                        }}
                                      >
                                        <Check
                                          className={cn(
                                            "mr-2 h-4 w-4",
                                            !item.parent ? "opacity-100" : "opacity-0"
                                          )}
                                        />
                                        <span className="text-muted-foreground">Ծնող չկա</span>
                                      </CommandItem>
                                      {parentItems
                                        .filter(p => p.id !== item.id)
                                        .map((parentItem) => (
                                          <CommandItem
                                            key={parentItem.id}
                                            value={parentItem.id.toString()}
                                            onSelect={() => {
                                              handleParentChange(item.id, parentItem.id.toString())
                                              setParentSearchQuery("")
                                            }}
                                          >
                                            <Check
                                              className={cn(
                                                "mr-2 h-4 w-4",
                                                item.parent === parentItem.id ? "opacity-100" : "opacity-0"
                                              )}
                                            />
                                            {parentItem.name}
                                          </CommandItem>
                                        ))}
                                    </CommandGroup>
                                  </CommandList>
                                </Command>
                              </PopoverContent>
                            </Popover>
                            {updatingItemId === item.id && (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {item.seen ? (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                              Ստուգված
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                              Չստուգված
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Էջ {currentPage} / {totalPages} ({totalItems} ապրանք)
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(currentPage - 1)}
                      disabled={currentPage === 1}
                    >
                      Նախորդ
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                    >
                      Հաջորդ
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Create Item Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Ստեղծել նոր ապրանք</DialogTitle>
            <DialogDescription>
              Ավելացրեք նոր ապրանք համակարգ
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">
                Անվանում <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder="Ապրանքի անվանումը"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="atg">ԱՏԳ Կոդ</Label>
              <Input
                id="atg"
                value={newItemAtg}
                onChange={(e) => setNewItemAtg(e.target.value)}
                placeholder="ԱՏԳ կոդը"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="code">Կոդ</Label>
              <Input
                id="code"
                value={newItemCode}
                onChange={(e) => setNewItemCode(e.target.value)}
                placeholder="Ապրանքի կոդը"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="unit">Միավոր</Label>
              <Input
                id="unit"
                value={newItemUnit}
                onChange={(e) => setNewItemUnit(e.target.value)}
                placeholder="Չափման միավոր (օր՝ հատ, կգ)"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="parent">Ծնող ապրանք</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between"
                  >
                    {newItemParent
                      ? parentItems.find(p => p.id.toString() === newItemParent)?.name || "Ընտրել ծնող ապրանք"
                      : "Ծնող չկա"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0">
                  <Command shouldFilter={false}>
                    <CommandInput
                      placeholder="Փնտրել ծնող..."
                      value={parentSearchQuery}
                      onValueChange={setParentSearchQuery}
                    />
                    <CommandList>
                      <CommandEmpty>Ապրանք չի գտնվել</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value=""
                          onSelect={() => {
                            setNewItemParent("")
                            setParentSearchQuery("")
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              !newItemParent ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <span className="text-muted-foreground">Ծնող չկա</span>
                        </CommandItem>
                        {parentItems.map((parentItem) => (
                          <CommandItem
                            key={parentItem.id}
                            value={parentItem.id.toString()}
                            onSelect={(value) => {
                              setNewItemParent(value)
                              setParentSearchQuery("")
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                newItemParent === parentItem.id.toString() ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {parentItem.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCreateDialogOpen(false)}
              disabled={isCreating}
            >
              Չեղարկել
            </Button>
            <Button onClick={handleCreateItem} disabled={isCreating}>
              {isCreating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Ստեղծում...
                </>
              ) : (
                "Ստեղծել"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
