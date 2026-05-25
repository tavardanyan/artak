"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"
import { Loader2 } from "lucide-react"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const origin = window.location.origin
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${origin}/auth/callback?next=/auth/set-password`,
      })
      if (error) throw error
      setSent(true)
    } catch (err: any) {
      setError(err.message || "Չհաջողվեց ուղարկել նամակը")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Մոռացե՞լ եք գաղտնաբառը</CardTitle>
          <CardDescription>
            Մուտքագրեք էլ. փոստի հասցեն և մենք կուղարկենք գաղտնաբառի վերականգնման հղում
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="space-y-4">
              <div className="rounded-md bg-emerald-100 p-3 text-sm text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200">
                Նամակն ուղարկվել է {email} հասցեին։ Բացեք էլ. փոստը և սեղմեք հղման վրա։
              </div>
              <Link href="/login" className="block text-center text-sm text-muted-foreground hover:underline">
                Վերադառնալ մուտքի էջ
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Էլ. փոստ</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="user@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  autoComplete="email"
                />
              </div>

              {error && (
                <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Ուղարկել հղումը
              </Button>

              <Link href="/login" className="block text-center text-sm text-muted-foreground hover:underline">
                Վերադառնալ մուտքի էջ
              </Link>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
