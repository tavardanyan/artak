"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import { useToast } from "@/hooks/use-toast"
import { Loader2, Settings, Key, Warehouse, List } from "lucide-react"
import { EditConfigDrawer } from "@/components/edit-config-drawer"

interface Config {
  key: string
  value: {
    tin?: string
    login?: string
    password?: string
  }
}

interface WarehouseOption {
  id: number
  name: string
}

export default function ConfigsPage() {
  const [configs, setConfigs] = useState<Config[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedConfig, setSelectedConfig] = useState<Config | null>(null)
  const [isEditDrawerOpen, setIsEditDrawerOpen] = useState(false)
  const [defaultWarehouse, setDefaultWarehouse] = useState("")
  const [matchLimit, setMatchLimit] = useState("")
  const [savingWarehouse, setSavingWarehouse] = useState(false)
  const [savingLimit, setSavingLimit] = useState(false)
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([])
  const { toast } = useToast()
  const supabase = createClient()

  useEffect(() => {
    fetchConfigs()
    fetchSettings()
    fetchWarehouses()
  }, [])

  const fetchConfigs = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from("settings")
        .select("*")
        .order("key")

      if (error) throw error
      setConfigs(data || [])
    } catch (error) {
      console.error("Error fetching configs:", error)
      toast({
        title: "Սխալ",
        description: "Չհաջողվեց բեռնել կարգավորումների ցանկը",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchSettings = async () => {
    try {
      const [warehouseData, limitData] = await Promise.all([
        supabase.from("settings").select("value").eq("key", "default_transfer_warehouse").single(),
        supabase.from("settings").select("value").eq("key", "item_matching_limit").single(),
      ])

      if (warehouseData.data?.value) {
        setDefaultWarehouse(warehouseData.data.value)
      }
      if (limitData.data?.value) {
        setMatchLimit(limitData.data.value)
      }
    } catch (error) {
      console.error("Error fetching settings:", error)
    }
  }

  const fetchWarehouses = async () => {
    try {
      const { data, error } = await supabase
        .from("warehouse")
        .select("id, name")
        .order("name")

      if (error) throw error

      setWarehouses(data || [])
    } catch (error) {
      console.error("Error fetching warehouses:", error)
    }
  }

  const handleSaveWarehouse = async () => {
    setSavingWarehouse(true)
    try {
      const { error } = await supabase
        .from("settings")
        .upsert({ key: "default_transfer_warehouse", value: defaultWarehouse })

      if (error) throw error

      toast({
        title: "Հաջողություն",
        description: "Պահեստը հաջողությամբ պահպանվեց",
      })
    } catch (error) {
      console.error("Error saving warehouse:", error)
      toast({
        title: "Սխալ",
        description: "Չհաջողվեց պահպանել պահեստը",
        variant: "destructive",
      })
    } finally {
      setSavingWarehouse(false)
    }
  }

  const handleSaveMatchLimit = async () => {
    setSavingLimit(true)
    try {
      const { error } = await supabase
        .from("settings")
        .upsert({ key: "item_matching_limit", value: matchLimit })

      if (error) throw error

      toast({
        title: "Հաջողություն",
        description: "Սահմանաչափը հաջողությամբ պահպանվեց",
      })
    } catch (error) {
      console.error("Error saving match limit:", error)
      toast({
        title: "Սխալ",
        description: "Չհաջողվեց պահպանել սահմանաչափը",
        variant: "destructive",
      })
    } finally {
      setSavingLimit(false)
    }
  }

  const handleEditConfig = (config: Config) => {
    setSelectedConfig(config)
    setIsEditDrawerOpen(true)
  }

  const handleCreateTaxServiceConfig = () => {
    const newConfig: Config = {
      key: "tax_service",
      value: {
        tin: "",
        login: "",
        password: "",
      },
    }
    setSelectedConfig(newConfig)
    setIsEditDrawerOpen(true)
  }

  const getTaxServiceConfig = () => {
    return configs.find((c) => c.key === "tax_service")
  }

  const taxServiceConfig = getTaxServiceConfig()

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Կարգավորումներ</h2>
        <p className="text-muted-foreground">
          Կառավարեք համակարգի կարգավորումները և հավատարմագրերը
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Tax Service Card */}
          <Card className="hover:bg-accent/50 transition-colors">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Key className="h-5 w-5 text-primary" />
                  <CardTitle>Հարկային ծառայություն</CardTitle>
                </div>
                {taxServiceConfig && (
                  <Settings className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              <CardDescription>
                Հարկային ծառայության հավատարմագրեր
              </CardDescription>
            </CardHeader>
            <CardContent>
              {taxServiceConfig ? (
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">ՀՎՀՀ</p>
                    <p className="text-base mt-1">
                      {taxServiceConfig.value.tin || "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Մուտքանուն</p>
                    <p className="text-base mt-1">
                      {taxServiceConfig.value.login || "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Գաղտնաբառ</p>
                    <p className="text-base mt-1">
                      {taxServiceConfig.value.password ? "••••••••" : "-"}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full mt-4"
                    onClick={() => handleEditConfig(taxServiceConfig)}
                  >
                    Խմբագրել
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Հարկային ծառայության հավատարմագրերը դեռ կարգավորված չեն
                  </p>
                  <Button
                    variant="default"
                    className="w-full"
                    onClick={handleCreateTaxServiceConfig}
                  >
                    Կարգավորել
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Default Invoice Transfer Warehouse */}
          <Card className="hover:bg-accent/50 transition-colors">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Warehouse className="h-5 w-5 text-primary" />
                <CardTitle>Ապրանքագրերի նկատմամբ պահեստ</CardTitle>
              </div>
              <CardDescription>
                Անավարտ փոխանցումների լռելյայն նկատմամբ պահեստ
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="warehouse">Ընտրել պահեստ</Label>
                  <Select
                    value={defaultWarehouse}
                    onValueChange={setDefaultWarehouse}
                  >
                    <SelectTrigger id="warehouse">
                      <SelectValue placeholder="Ընտրել պահեստ" />
                    </SelectTrigger>
                    <SelectContent>
                      {warehouses.map((warehouse) => (
                        <SelectItem key={warehouse.id} value={warehouse.id.toString()}>
                          {warehouse.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleSaveWarehouse}
                  disabled={savingWarehouse || !defaultWarehouse}
                >
                  {savingWarehouse ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Պահպանվում է...
                    </>
                  ) : (
                    "Պահպանել"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Item Matching Limit */}
          <Card className="hover:bg-accent/50 transition-colors">
            <CardHeader>
              <div className="flex items-center gap-2">
                <List className="h-5 w-5 text-primary" />
                <CardTitle>Համապատասխանության սահմանաչափ</CardTitle>
              </div>
              <CardDescription>
                Ապրանքների համապատասխանության ցանկի երկարություն
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="matchLimit">Առավելագույն քանակ</Label>
                  <Input
                    id="matchLimit"
                    type="number"
                    value={matchLimit}
                    onChange={(e) => setMatchLimit(e.target.value)}
                    placeholder="10"
                  />
                </div>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleSaveMatchLimit}
                  disabled={savingLimit || !matchLimit}
                >
                  {savingLimit ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Պահպանվում է...
                    </>
                  ) : (
                    "Պահպանել"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {selectedConfig && (
        <EditConfigDrawer
          open={isEditDrawerOpen}
          onOpenChange={setIsEditDrawerOpen}
          config={selectedConfig}
          onSuccess={fetchConfigs}
        />
      )}
    </div>
  )
}
