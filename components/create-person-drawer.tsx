"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
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
  SheetFooter,
} from "@/components/ui/sheet"
import { useToast } from "@/hooks/use-toast"

interface CreatePersonDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  type: "staff" | "contact"
  onSuccess?: () => void
}

export function CreatePersonDrawer({ open, onOpenChange, type, onSuccess }: CreatePersonDrawerProps) {
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [bday, setBday] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [address, setAddress] = useState("")
  const [position, setPosition] = useState("")

  // Account creation (only for staff)
  const [createAccount, setCreateAccount] = useState(false)
  const [accountName, setAccountName] = useState("")
  const [accountType, setAccountType] = useState("bank")
  const [accountBank, setAccountBank] = useState("")
  const [accountNumber, setAccountNumber] = useState("")
  const [accountCurrency, setAccountCurrency] = useState("amd")

  const [isSubmitting, setIsSubmitting] = useState(false)

  const supabase = createClient()
  const { toast } = useToast()

  const resetForm = () => {
    setFirstName("")
    setLastName("")
    setBday("")
    setEmail("")
    setPhone("")
    setAddress("")
    setPosition("")
    setCreateAccount(false)
    setAccountName("")
    setAccountType("bank")
    setAccountBank("")
    setAccountNumber("")
    setAccountCurrency("amd")
  }

  const handleSubmit = async () => {
    // Validation
    if (!firstName) {
      toast({
        title: "Սխալ",
        description: "Խնդրում ենք լրացնել անունը",
        variant: "destructive",
      })
      return
    }

    if (type === "staff" && createAccount && !accountName) {
      toast({
        title: "Սխալ",
        description: "Խնդրում ենք լրացնել հաշվի անվանումը",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)

    try {
      let accountId = null

      // Create account if needed (only for staff)
      if (type === "staff" && createAccount) {
        const { data: account, error: accountError } = await supabase
          .from("account")
          .insert([{
            name: accountName,
            type: accountType,
            bank: accountBank || null,
            number: accountNumber || null,
            currency: accountCurrency,
            internal: false,
          }])
          .select()
          .single()

        if (accountError) throw accountError
        accountId = account.id
      }

      // Create person
      const { error: personError } = await supabase
        .from("person")
        .insert([{
          type: type,
          first_name: firstName,
          last_lame: lastName || null,
          bday: bday ? new Date(bday).toISOString() : null,
          email: email || null,
          phone: phone || null,
          address: address || null,
          position: position || null,
          account_id: accountId,
        }])

      if (personError) throw personError

      toast({
        title: "Հաջողություն",
        description: type === "staff"
          ? "Աշխատակիցը հաջողությամբ ավելացվեց"
          : "Կոնտակտը հաջողությամբ ավելացվեց",
      })

      resetForm()
      onOpenChange(false)

      if (onSuccess) {
        onSuccess()
      }
    } catch (error) {
      console.error("Error:", error)
      toast({
        title: "Սխալ",
        description: type === "staff"
          ? "Չհաջողվեց ավելացնել աշխատակիցը"
          : "Չհաջողվեց ավելացնել կոնտակտը",
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
            {type === "staff" ? "Ավելացնել աշխատակից" : "Ավելացնել կոնտակտ"}
          </SheetTitle>
          <SheetDescription>
            Լրացրեք {type === "staff" ? "աշխատակցի" : "կոնտակտի"} տվյալները
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 py-6">
          {/* Person Info */}
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
              <Input
                id="position"
                placeholder="Պաշտոնը"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
              />
            </div>
          </div>

          {/* Create Account Section - Only for staff */}
          {type === "staff" && (
            <div className="space-y-4 pt-4 border-t">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="create-account">Ստեղծել հաշիվ</Label>
                  <p className="text-sm text-muted-foreground">
                    Ստեղծել ֆինանսական հաշիվ այս աշխատակցի համար
                  </p>
                </div>
                <Switch
                  id="create-account"
                  checked={createAccount}
                  onCheckedChange={setCreateAccount}
                />
              </div>

              {createAccount && (
                <div className="space-y-4 pl-4 border-l-2">
                  <div className="space-y-2">
                    <Label htmlFor="account-name">
                      Հաշվի անվանում <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="account-name"
                      placeholder="Հաշվի անվանումը"
                      value={accountName}
                      onChange={(e) => setAccountName(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="account-type">Հաշվի տեսակ</Label>
                    <Select value={accountType} onValueChange={setAccountType}>
                      <SelectTrigger id="account-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bank">Բանկ</SelectItem>
                        <SelectItem value="cash">Կանխիկ</SelectItem>
                        <SelectItem value="card">Քարտ</SelectItem>
                        <SelectItem value="other">Այլ</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="account-bank">Բանկ</Label>
                    <Input
                      id="account-bank"
                      placeholder="Բանկի անվանումը"
                      value={accountBank}
                      onChange={(e) => setAccountBank(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="account-number">Հաշվեհամար</Label>
                    <Input
                      id="account-number"
                      placeholder="Հաշվեհամարը"
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="account-currency">Արժույթ</Label>
                    <Select value={accountCurrency} onValueChange={setAccountCurrency}>
                      <SelectTrigger id="account-currency">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="amd">AMD (֏)</SelectItem>
                        <SelectItem value="usd">USD ($)</SelectItem>
                        <SelectItem value="eur">EUR (€)</SelectItem>
                        <SelectItem value="rub">RUB (₽)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <SheetFooter>
          <Button
            variant="outline"
            onClick={() => {
              resetForm()
              onOpenChange(false)
            }}
            disabled={isSubmitting}
          >
            Չեղարկել
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Ավելացնում..." : "Ավելացնել"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
