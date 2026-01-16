"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { ArrowUpRight, ArrowDownLeft } from "lucide-react"

interface Partner {
  id: number
  name: string
  type: string
}

interface Person {
  id: number
  type: string
  first_name: string
  last_lame: string | null
  nickname: string | null
  bday: string | null
  email: string | null
  phone: string | null
  second_phone: string | null
  address: string | null
  position: string | null
  account_id: number | null
  partner_id: number | null
}

interface Contract {
  id: number
  description: string
  total: number
  status: string
  start: string | null
  end: string | null
  project: {
    name: string
    code: string
  }
}

interface Transaction {
  id: number
  amount: number
  created_at: string
  note: string | null
  from: number
  to: number
  from_account: {
    name: string
    currency: string
  }
  to_account: {
    name: string
    currency: string
  }
}

interface EditPersonDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  person: Person
  onSuccess?: () => void
}

const formatCurrency = (amount: number, currency: string = "amd") => {
  const currencySymbols: Record<string, string> = {
    amd: "֏",
    usd: "$",
    eur: "€",
    rub: "₽",
  }

  const symbol = currencySymbols[currency.toLowerCase()] || currency.toUpperCase()
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)

  return `${formatted} ${symbol}`
}

const formatDate = (dateString: string | null | undefined) => {
  if (!dateString) return "-"
  return new Date(dateString).toLocaleDateString("hy-AM", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

const getContractStatusBadge = (status: string) => {
  const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    planned: { label: "Պլանավորված", variant: "secondary" },
    "in progress": { label: "Ընթացքի մեջ", variant: "default" },
    done: { label: "Կատարված", variant: "outline" },
    rejected: { label: "Մերժված", variant: "destructive" },
  }

  const statusInfo = statusMap[status] || { label: status, variant: "outline" as const }
  return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
}

export function EditPersonDrawer({ open, onOpenChange, person, onSuccess }: EditPersonDrawerProps) {
  const [firstName, setFirstName] = useState(person.first_name)
  const [lastName, setLastName] = useState(person.last_lame || "")
  const [nickname, setNickname] = useState(person.nickname || "")
  const [bday, setBday] = useState(
    person.bday ? new Date(person.bday).toISOString().split("T")[0] : ""
  )
  const [email, setEmail] = useState(person.email || "")
  const [phone, setPhone] = useState(person.phone || "")
  const [secondPhone, setSecondPhone] = useState(person.second_phone || "")
  const [address, setAddress] = useState(person.address || "")
  const [position, setPosition] = useState(person.position || "")
  const [partnerId, setPartnerId] = useState(person.partner_id?.toString() || "")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [contracts, setContracts] = useState<Contract[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [partners, setPartners] = useState<Partner[]>([])
  const [loadingRelated, setLoadingRelated] = useState(false)

  const supabase = createClient()
  const { toast } = useToast()

  // Update form when person changes
  useEffect(() => {
    setFirstName(person.first_name)
    setLastName(person.last_lame || "")
    setNickname(person.nickname || "")
    setBday(person.bday ? new Date(person.bday).toISOString().split("T")[0] : "")
    setEmail(person.email || "")
    setPhone(person.phone || "")
    setSecondPhone(person.second_phone || "")
    setAddress(person.address || "")
    setPosition(person.position || "")
    setPartnerId(person.partner_id?.toString() || "")
  }, [person])

  // Fetch partners when drawer opens for contacts
  useEffect(() => {
    if (open && person.type === "contact") {
      fetchPartners()
    }
  }, [open, person.type])

  const fetchPartners = async () => {
    try {
      const { data, error } = await supabase
        .from("partner")
        .select("id, name, type")
        .order("name")

      if (error) throw error
      setPartners(data || [])
    } catch (error) {
      console.error("Error fetching partners:", error)
    }
  }

  // Fetch related contracts and transactions when drawer opens
  useEffect(() => {
    if (open && person.id) {
      fetchRelatedData()
    }
  }, [open, person.id])

  const fetchRelatedData = async () => {
    setLoadingRelated(true)

    // Fetch contracts
    const { data: contractsData, error: contractsError } = await supabase
      .from("contract")
      .select(`
        id,
        description,
        total,
        status,
        start,
        end,
        project:project_id(name, code)
      `)
      .eq("person_id", person.id)
      .order("created_at", { ascending: false })

    if (!contractsError && contractsData) {
      setContracts(contractsData)
    }

    // Fetch transactions if person has account
    if (person.account_id) {
      const { data: transactionsData, error: transactionsError } = await supabase
        .from("transaction")
        .select(`
          id,
          amount,
          created_at,
          note,
          from,
          to,
          from_account:from(name, currency),
          to_account:to(name, currency)
        `)
        .or(`from.eq.${person.account_id},to.eq.${person.account_id}`)
        .order("created_at", { ascending: false })
        .limit(20)

      if (!transactionsError && transactionsData) {
        setTransactions(transactionsData)
      }
    }

    setLoadingRelated(false)
  }

  const handleSubmit = async () => {
    if (!firstName) {
      toast({
        title: "Սխալ",
        description: "Խնդրում ենք լրացնել անունը",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)

    try {
      const { error } = await supabase
        .from("person")
        .update({
          first_name: firstName,
          last_lame: lastName || null,
          nickname: nickname || null,
          bday: bday ? new Date(bday).toISOString() : null,
          email: email || null,
          phone: phone || null,
          second_phone: secondPhone || null,
          address: address || null,
          position: position || null,
          partner_id: partnerId ? parseInt(partnerId) : null,
        })
        .eq("id", person.id)

      if (error) throw error

      toast({
        title: "Հաջողություն",
        description: person.type === "staff"
          ? "Աշխատակիցը հաջողությամբ թարմացվեց"
          : "Կոնտակտը հաջողությամբ թարմացվեց",
      })

      onOpenChange(false)

      if (onSuccess) {
        onSuccess()
      }
    } catch (error) {
      console.error("Error:", error)
      toast({
        title: "Սխալ",
        description: person.type === "staff"
          ? "Չհաջողվեց թարմացնել աշխատակիցը"
          : "Չհաջողվեց թարմացնել կոնտակտը",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-[50vw] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {person.type === "staff" ? "Խմբագրել աշխատակցի տվյալները" : "Խմբագրել կոնտակտի տվյալները"}
          </SheetTitle>
          <SheetDescription>
            Թարմացրեք {person.type === "staff" ? "աշխատակցի" : "կոնտակտի"} տեղեկատվությունը
          </SheetDescription>
        </SheetHeader>

        <div className="grid grid-cols-2 gap-6 py-6">
          {/* Left Column - Person Info */}
          <div className="space-y-4">
            <h3 className="font-semibold">Անձնական տվյալներ</h3>

            <div className="space-y-2">
              <Label htmlFor="first-name">
                Անուն <span className="text-destructive">*</span>
              </Label>
              <Input
                id="first-name"
                placeholder="Անունը"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="last-name">Ազգանուն</Label>
              <Input
                id="last-name"
                placeholder="Ազգանունը"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="nickname">Մականուն</Label>
              <Input
                id="nickname"
                placeholder="Մականունը"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bday">Ծննդյան օր</Label>
              <Input
                id="bday"
                type="date"
                value={bday}
                onChange={(e) => setBday(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Էլ. փոստ</Label>
              <Input
                id="email"
                type="email"
                placeholder="example@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Հեռախոս</Label>
              <Input
                id="phone"
                placeholder="+374 XX XXXXXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="second-phone">Երկրորդ հեռախոս</Label>
              <Input
                id="second-phone"
                placeholder="+374 XX XXXXXX"
                value={secondPhone}
                onChange={(e) => setSecondPhone(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Հասցե</Label>
              <Input
                id="address"
                placeholder="Հասցեն"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="position">Պաշտոն</Label>
              <Select value={position} onValueChange={setPosition}>
                <SelectTrigger id="position">
                  <SelectValue placeholder="Ընտրել պաշտոնը" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Տնօրինություն">Տնօրինություն</SelectItem>
                  <SelectItem value="Վարորդ">Վարորդ</SelectItem>
                  <SelectItem value="Արհեստավոր">Արհեստավոր</SelectItem>
                  <SelectItem value="Հաշվապահ">Հաշվապահ</SelectItem>
                  <SelectItem value="Ինժեներ">Ինժեներ</SelectItem>
                  <SelectItem value="Հսկիչ">Հսկիչ</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Partner Selection - Only for contact */}
            {person.type === "contact" && (
              <div className="space-y-2">
                <Label htmlFor="partner">Գործընկեր (ոչ պարտադիր)</Label>
                <Select value={partnerId} onValueChange={setPartnerId}>
                  <SelectTrigger id="partner">
                    <SelectValue placeholder="Ընտրել գործընկերը" />
                  </SelectTrigger>
                  <SelectContent>
                    {partners.length === 0 ? (
                      <SelectItem value="empty" disabled>Գործընկերներ չկան</SelectItem>
                    ) : (
                      partners.map((partner) => (
                        <SelectItem key={partner.id} value={partner.id.toString()}>
                          {partner.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Right Column - Related Data */}
          <div className="space-y-4">
            <h3 className="font-semibold">Կապված տվյալներ</h3>

            {/* Contracts Section */}
            <div className="space-y-2">
              <Label>Պայմանագրեր ({contracts.length})</Label>
              {loadingRelated ? (
                <p className="text-sm text-muted-foreground">Բեռնում...</p>
              ) : contracts.length === 0 ? (
                <p className="text-sm text-muted-foreground">Պայմանագրեր չկան</p>
              ) : (
                <div className="border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Նախագիծ</TableHead>
                        <TableHead>Գումար</TableHead>
                        <TableHead>Վիճակ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {contracts.map((contract) => (
                        <TableRow key={contract.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium text-sm">{contract.project.name}</p>
                              <p className="text-xs text-muted-foreground line-clamp-1">
                                {contract.description}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">
                            {formatCurrency(contract.total)}
                          </TableCell>
                          <TableCell>
                            {getContractStatusBadge(contract.status)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            {/* Transactions Section */}
            {person.account_id && (
              <div className="space-y-2">
                <Label>Գործարքներ ({transactions.length})</Label>
                {loadingRelated ? (
                  <p className="text-sm text-muted-foreground">Բեռնում...</p>
                ) : transactions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Գործարքներ չկան</p>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {transactions.map((transaction) => {
                      const isOutgoing = transaction.from === person.account_id
                      return (
                        <div
                          key={transaction.id}
                          className="p-3 border rounded-md bg-muted/50 space-y-1"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {isOutgoing ? (
                                <ArrowUpRight className="h-4 w-4 text-red-500" />
                              ) : (
                                <ArrowDownLeft className="h-4 w-4 text-green-500" />
                              )}
                              <span className="font-medium text-sm">
                                {formatCurrency(
                                  transaction.amount,
                                  isOutgoing
                                    ? transaction.from_account.currency
                                    : transaction.to_account.currency
                                )}
                              </span>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {formatDate(transaction.created_at)}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {transaction.from_account.name} → {transaction.to_account.name}
                          </p>
                          {transaction.note && (
                            <p className="text-xs text-muted-foreground italic">
                              {transaction.note}
                            </p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <SheetFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Չեղարկել
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Պահպանում..." : "Պահպանել"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
