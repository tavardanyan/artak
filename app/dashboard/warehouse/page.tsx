"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from "@/components/ui/sheet"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Plus, Warehouse as WarehouseIcon, MapPin, Package, Pencil } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { WarehouseContent } from "@/components/warehouse-content"

interface Warehouse {
  id: number
  name: string
  address: string
  type: string
}

export default function WarehousePage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [selectedWarehouse, setSelectedWarehouse] = useState<Warehouse | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [isEditDrawerOpen, setIsEditDrawerOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  // Form state for new warehouse
  const [newWarehouse, setNewWarehouse] = useState({
    name: "",
    address: "",
    type: "main",
  })

  // Form state for editing warehouse
  const [editWarehouse, setEditWarehouse] = useState({
    id: 0,
    name: "",
    address: "",
    type: "main",
  })

  const supabase = createClient()

  // Fetch warehouses from Supabase
  const fetchWarehouses = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from("warehouse")
        .select("*")
        .order("id", { ascending: true })

      if (error) {
        console.error("Error fetching warehouses:", error)
        toast({
          title: "Սխալ",
          description: "Չհաջողվեց բեռնել պահեստների ցանկը",
          variant: "destructive",
        })
        return
      }

      setWarehouses(data || [])
      if (data && data.length > 0 && !selectedWarehouse) {
        setSelectedWarehouse(data[0])
      }
    } catch (error) {
      console.error("Error:", error)
    } finally {
      setLoading(false)
    }
  }

  // Add new warehouse
  const handleAddWarehouse = async () => {
    if (!newWarehouse.name || !newWarehouse.address) {
      toast({
        title: "Սխալ",
        description: "Խնդրում ենք լրացնել բոլոր դաշտերը",
        variant: "destructive",
      })
      return
    }

    try {
      const { data, error } = await supabase
        .from("warehouse")
        .insert([newWarehouse])
        .select()

      if (error) {
        console.error("Error adding warehouse:", error)
        toast({
          title: "Սխալ",
          description: "Չհաջողվեց ավելացնել պահեստը",
          variant: "destructive",
        })
        return
      }

      toast({
        title: "Հաջողություն",
        description: "Պահեստը հաջողությամբ ավելացվեց",
      })

      // Reset form
      setNewWarehouse({ name: "", address: "", type: "main" })
      setIsDrawerOpen(false)

      // Refresh list
      fetchWarehouses()
    } catch (error) {
      console.error("Error:", error)
    }
  }

  // Open edit drawer
  const handleEditClick = (warehouse: Warehouse, e: React.MouseEvent) => {
    e.stopPropagation() // Prevent selecting the warehouse
    setEditWarehouse(warehouse)
    setIsEditDrawerOpen(true)
  }

  // Update warehouse
  const handleUpdateWarehouse = async () => {
    if (!editWarehouse.name || !editWarehouse.address) {
      toast({
        title: "Սխալ",
        description: "Խնդրում ենք լրացնել բոլոր դաշտերը",
        variant: "destructive",
      })
      return
    }

    try {
      const { error } = await supabase
        .from("warehouse")
        .update({
          name: editWarehouse.name,
          address: editWarehouse.address,
          type: editWarehouse.type,
        })
        .eq("id", editWarehouse.id)

      if (error) {
        console.error("Error updating warehouse:", error)
        toast({
          title: "Սխալ",
          description: "Չհաջողվեց թարմացնել պահեստը",
          variant: "destructive",
        })
        return
      }

      toast({
        title: "Հաջողություն",
        description: "Պահեստը հաջողությամբ թարմացվեց",
      })

      setIsEditDrawerOpen(false)

      // Refresh list and update selected warehouse if it was edited
      fetchWarehouses()
      if (selectedWarehouse?.id === editWarehouse.id) {
        setSelectedWarehouse({ ...editWarehouse })
      }
    } catch (error) {
      console.error("Error:", error)
    }
  }

  useEffect(() => {
    fetchWarehouses()
  }, [])

  const getTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      main: "Հիմնական",
      secondary: "Երկրորդական",
      temporary: "Ժամանակավոր",
      storage: "Պահեստ",
    }
    return types[type] || type
  }

  const getTypeBadgeVariant = (type: string): "default" | "secondary" | "outline" => {
    const variants: Record<string, "default" | "secondary" | "outline"> = {
      main: "default",
      secondary: "secondary",
      temporary: "outline",
      storage: "outline",
    }
    return variants[type] || "outline"
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] gap-6">
      {/* Sidebar with warehouse list */}
      <div className="w-80 flex-shrink-0 flex flex-col">
        <div className="mb-4">
          <h2 className="text-2xl font-bold">Պահեստներ</h2>
        </div>

        {/* Warehouse List */}
        <div className="space-y-2 overflow-y-auto flex-1">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <p className="text-muted-foreground">Բեռնում...</p>
            </div>
          ) : warehouses.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-center">
              <WarehouseIcon className="h-12 w-12 text-muted-foreground mb-2" />
              <p className="text-muted-foreground">Պահեստներ չկան</p>
              <p className="text-xs text-muted-foreground">
                Սեղմեք ներքևի կոճակը՝ ավելացնելու համար
              </p>
            </div>
          ) : (
            warehouses.map((warehouse) => (
              <Card
                key={warehouse.id}
                className={`cursor-pointer transition-colors hover:bg-accent ${
                  selectedWarehouse?.id === warehouse.id
                    ? "border-primary bg-accent"
                    : ""
                }`}
                onClick={() => setSelectedWarehouse(warehouse)}
              >
                <CardHeader className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base truncate">
                        {warehouse.name}
                      </CardTitle>
                      <CardDescription className="text-xs mt-1 flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        <span className="truncate">{warehouse.address}</span>
                      </CardDescription>
                    </div>
                    <Badge variant={getTypeBadgeVariant(warehouse.type)} className="flex-shrink-0">
                      {getTypeLabel(warehouse.type)}
                    </Badge>
                  </div>
                </CardHeader>
              </Card>
            ))
          )}

          {/* Add New Warehouse Button at Bottom */}
          <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
            <SheetTrigger asChild>
              <Card className="cursor-pointer transition-colors hover:bg-accent border-dashed mt-2">
                <CardHeader className="p-4">
                  <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <Plus className="h-5 w-5" />
                    <span className="font-medium">Ավելացնել նոր պահեստ</span>
                  </div>
                </CardHeader>
              </Card>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Ավելացնել նոր պահեստ</SheetTitle>
                <SheetDescription>
                  Լրացրեք պահեստի տվյալները
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-4 py-6">
                <div className="space-y-2">
                  <Label htmlFor="name">Անվանում</Label>
                  <Input
                    id="name"
                    placeholder="Պահեստի անվանումը"
                    value={newWarehouse.name}
                    onChange={(e) =>
                      setNewWarehouse({ ...newWarehouse, name: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Հասցե</Label>
                  <Input
                    id="address"
                    placeholder="Պահեստի հասցեն"
                    value={newWarehouse.address}
                    onChange={(e) =>
                      setNewWarehouse({ ...newWarehouse, address: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="type">Տեսակ</Label>
                  <Select
                    value={newWarehouse.type}
                    onValueChange={(value) =>
                      setNewWarehouse({ ...newWarehouse, type: value })
                    }
                  >
                    <SelectTrigger id="type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="main">Հիմնական</SelectItem>
                      <SelectItem value="secondary">Երկրորդական</SelectItem>
                      <SelectItem value="temporary">Ժամանակավոր</SelectItem>
                      <SelectItem value="storage">Պահեստ</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <SheetFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsDrawerOpen(false)}
                >
                  Չեղարկել
                </Button>
                <Button onClick={handleAddWarehouse}>Ավելացնել</Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 overflow-auto">
        {selectedWarehouse ? (
          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <h2 className="text-3xl font-bold tracking-tight">
                    {selectedWarehouse.name}
                  </h2>
                  <Badge variant={getTypeBadgeVariant(selectedWarehouse.type)}>
                    {getTypeLabel(selectedWarehouse.type)}
                  </Badge>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => handleEditClick(selectedWarehouse, e)}
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  Խմբագրել
                </Button>
              </div>
              <p className="text-muted-foreground flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                {selectedWarehouse.address}
              </p>
            </div>

            <WarehouseContent
              warehouseId={selectedWarehouse.id}
              warehouseName={selectedWarehouse.name}
            />
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <WarehouseIcon className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">
                Ընտրեք պահեստը ձախ կողմից
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Edit Warehouse Drawer */}
      <Sheet open={isEditDrawerOpen} onOpenChange={setIsEditDrawerOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Խմբագրել պահեստը</SheetTitle>
            <SheetDescription>
              Փոփոխեք պահեստի տվյալները
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-4 py-6">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Անվանում</Label>
              <Input
                id="edit-name"
                placeholder="Պահեստի անվանումը"
                value={editWarehouse.name}
                onChange={(e) =>
                  setEditWarehouse({ ...editWarehouse, name: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-address">Հասցե</Label>
              <Input
                id="edit-address"
                placeholder="Պահեստի հասցեն"
                value={editWarehouse.address}
                onChange={(e) =>
                  setEditWarehouse({ ...editWarehouse, address: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-type">Տեսակ</Label>
              <Select
                value={editWarehouse.type}
                onValueChange={(value) =>
                  setEditWarehouse({ ...editWarehouse, type: value })
                }
              >
                <SelectTrigger id="edit-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="main">Հիմնական</SelectItem>
                  <SelectItem value="secondary">Երկրորդական</SelectItem>
                  <SelectItem value="temporary">Ժամանակավոր</SelectItem>
                  <SelectItem value="storage">Պահեստ</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <SheetFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsEditDrawerOpen(false)}
            >
              Չեղարկել
            </Button>
            <Button onClick={handleUpdateWarehouse}>Պահպանել</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}
