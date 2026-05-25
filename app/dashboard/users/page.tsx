"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useToast } from "@/hooks/use-toast"
import { Loader2, MoreHorizontal, Plus, KeyRound, Ban, Trash2, ShieldCheck } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

interface User {
  id: string
  email?: string | null
  phone?: string | null
  created_at: string
  last_sign_in_at?: string | null
  email_confirmed_at?: string | null
  banned_until?: string | null
  invited_at?: string | null
  app_metadata?: Record<string, any>
  user_metadata?: Record<string, any>
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [meId, setMeId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [createEmail, setCreateEmail] = useState("")
  const [creating, setCreating] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const { toast } = useToast()
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMeId(data.user?.id || null))
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/users?perPage=200")
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Չհաջողվեց բեռնել ցանկը")
      setUsers(json.users || [])
    } catch (err: any) {
      toast({ title: "Սխալ", description: err.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const handleInvite = async () => {
    if (!createEmail.trim()) return
    setCreating(true)
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: createEmail.trim() }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Չհաջողվեց հրավիրել")
      toast({ title: "Հաջողություն", description: `Հրավերն ուղարկվել է ${createEmail}-ին` })
      setCreateOpen(false)
      setCreateEmail("")
      fetchUsers()
    } catch (err: any) {
      toast({ title: "Սխալ", description: err.message, variant: "destructive" })
    } finally {
      setCreating(false)
    }
  }

  const handleResetPassword = async (u: User) => {
    setBusyId(u.id)
    try {
      const res = await fetch(`/api/users/${u.id}/reset-password`, { method: "POST" })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Չհաջողվեց ուղարկել")
      toast({ title: "Հաջողություն", description: `Վերականգնման հղումն ուղարկվել է ${u.email}-ին` })
    } catch (err: any) {
      toast({ title: "Սխալ", description: err.message, variant: "destructive" })
    } finally {
      setBusyId(null)
    }
  }

  const handleToggleBan = async (u: User) => {
    const isBanned = isUserBanned(u)
    setBusyId(u.id)
    try {
      const res = await fetch(`/api/users/${u.id}/ban`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ banned: !isBanned }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Չհաջողվեց փոխել կարգավիճակը")
      toast({
        title: "Հաջողություն",
        description: !isBanned ? `${u.email} արգելափակվեց` : `${u.email}-ի արգելափակումը հանվեց`,
      })
      fetchUsers()
    } catch (err: any) {
      toast({ title: "Սխալ", description: err.message, variant: "destructive" })
    } finally {
      setBusyId(null)
    }
  }

  const handleDelete = async (u: User) => {
    if (!confirm(`Ջնջե՞լ ${u.email} օգտատիրոջ հաշիվը։ Այս գործողությունն անհետացնելի է։`)) return
    setBusyId(u.id)
    try {
      const res = await fetch(`/api/users/${u.id}`, { method: "DELETE" })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Չհաջողվեց ջնջել")
      toast({ title: "Հաջողություն", description: `${u.email} ջնջվեց` })
      fetchUsers()
    } catch (err: any) {
      toast({ title: "Սխալ", description: err.message, variant: "destructive" })
    } finally {
      setBusyId(null)
    }
  }

  const filtered = users.filter((u) => {
    if (!search.trim()) return true
    const s = search.toLowerCase()
    return (u.email || "").toLowerCase().includes(s) || (u.id || "").toLowerCase().includes(s)
  })

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Օգտատերեր</h2>
          <p className="text-sm text-muted-foreground">Կառավարեք համակարգի օգտատերերին և մուտքի իրավունքները</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Հրավիրել օգտատեր
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
          <CardTitle className="text-lg">Ընդամենը {users.length}</CardTitle>
          <Input
            placeholder="Փնտրել ըստ էլ. փոստի կամ ID-ի..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs h-8"
          />
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">Օգտատերեր չեն գտնվել</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="text-xs">
                  <TableHead className="py-2">Էլ. փոստ</TableHead>
                  <TableHead className="py-2">Կարգավիճակ</TableHead>
                  <TableHead className="py-2">Ստեղծված</TableHead>
                  <TableHead className="py-2">Վերջին մուտքը</TableHead>
                  <TableHead className="py-2">Հաստատված</TableHead>
                  <TableHead className="py-2 w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((u) => {
                  const banned = isUserBanned(u)
                  const isSelf = u.id === meId
                  const isBusy = busyId === u.id
                  return (
                    <TableRow key={u.id} className="text-xs">
                      <TableCell className="py-2">
                        <div className="font-medium">{u.email || "—"}</div>
                        <div className="text-muted-foreground text-[10px] font-mono">{u.id}</div>
                      </TableCell>
                      <TableCell className="py-2">
                        {banned ? (
                          <Badge variant="destructive">Արգելափակված</Badge>
                        ) : u.last_sign_in_at ? (
                          <Badge variant="default">Ակտիվ</Badge>
                        ) : (
                          <Badge variant="secondary">Հրավիրված</Badge>
                        )}
                        {isSelf && <Badge variant="outline" className="ml-1">Դուք</Badge>}
                      </TableCell>
                      <TableCell className="py-2">{formatDateTime(u.created_at)}</TableCell>
                      <TableCell className="py-2">{u.last_sign_in_at ? formatDateTime(u.last_sign_in_at) : "—"}</TableCell>
                      <TableCell className="py-2">{u.email_confirmed_at ? formatDateTime(u.email_confirmed_at) : "—"}</TableCell>
                      <TableCell className="py-2">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7" disabled={isBusy}>
                              {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MoreHorizontal className="h-3.5 w-3.5" />}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleResetPassword(u)}>
                              <KeyRound className="h-3.5 w-3.5 mr-2" />
                              Վերականգնել գաղտնաբառը
                            </DropdownMenuItem>
                            {!isSelf && (
                              <DropdownMenuItem onClick={() => handleToggleBan(u)}>
                                {banned ? (
                                  <>
                                    <ShieldCheck className="h-3.5 w-3.5 mr-2" />
                                    Հանել արգելափակումը
                                  </>
                                ) : (
                                  <>
                                    <Ban className="h-3.5 w-3.5 mr-2" />
                                    Արգելափակել
                                  </>
                                )}
                              </DropdownMenuItem>
                            )}
                            {!isSelf && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleDelete(u)} className="text-destructive focus:text-destructive">
                                  <Trash2 className="h-3.5 w-3.5 mr-2" />
                                  Ջնջել
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Հրավիրել նոր օգտատեր</DialogTitle>
            <DialogDescription>
              Օգտատերը կստանա էլ. նամակ՝ գաղտնաբառ սահմանելու հղումով
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <label className="text-sm font-medium">Էլ. փոստ</label>
            <Input
              type="email"
              placeholder="user@example.com"
              value={createEmail}
              onChange={(e) => setCreateEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>Չեղարկել</Button>
            <Button onClick={handleInvite} disabled={creating || !createEmail.trim()}>
              {creating && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Ուղարկել հրավերը
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function isUserBanned(u: User): boolean {
  if (!u.banned_until) return false
  const t = new Date(u.banned_until).getTime()
  return !isNaN(t) && t > Date.now()
}

function formatDateTime(s: string): string {
  const d = new Date(s)
  return d.toLocaleString("hy-AM", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
}
