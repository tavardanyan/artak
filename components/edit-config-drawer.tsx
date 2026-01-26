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
import { useToast } from "@/hooks/use-toast"
import { Eye, EyeOff } from "lucide-react"

interface Config {
  key: string
  value: {
    tin?: string
    login?: string
    password?: string
  }
}

interface EditConfigDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  config: Config
  onSuccess?: () => void
}

export function EditConfigDrawer({ open, onOpenChange, config, onSuccess }: EditConfigDrawerProps) {
  const [tin, setTin] = useState(config.value.tin || "")
  const [login, setLogin] = useState(config.value.login || "")
  const [password, setPassword] = useState(config.value.password || "")
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const supabase = createClient()
  const { toast } = useToast()

  // Update form when config changes
  useEffect(() => {
    setTin(config.value.tin || "")
    setLogin(config.value.login || "")
    setPassword(config.value.password || "")
  }, [config])

  const handleSubmit = async () => {
    // Validation
    if (!tin || !login || !password) {
      toast({
        title: "Սխալ",
        description: "Խնդրում ենք լրացնել բոլոր դաշտերը",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)

    try {
      const configData = {
        key: config.key,
        value: {
          tin,
          login,
          password,
        },
      }

      // Check if config exists
      const { data: existingConfig } = await supabase
        .from("settings")
        .select("key")
        .eq("key", config.key)
        .single()

      if (existingConfig) {
        // Update existing config
        const { error } = await supabase
          .from("settings")
          .update({ value: configData.value })
          .eq("key", config.key)

        if (error) throw error
      } else {
        // Insert new config
        const { error } = await supabase
          .from("settings")
          .insert(configData)

        if (error) throw error
      }

      toast({
        title: "Հաջողություն",
        description: "Կարգավորումները հաջողությամբ պահպանվեցին",
      })

      onOpenChange(false)

      if (onSuccess) {
        onSuccess()
      }
    } catch (error) {
      console.error("Error:", error)
      toast({
        title: "Սխալ",
        description: "Չհաջողվեց պահպանել կարգավորումները",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Հարկային ծառայության հավատարմագրեր</SheetTitle>
          <SheetDescription>
            Մուտքագրեք հարկային ծառայության հավատարմագրերը
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 py-6">
          <div className="space-y-2">
            <Label htmlFor="tin">
              ՀՎՀՀ <span className="text-destructive">*</span>
            </Label>
            <Input
              id="tin"
              placeholder="ՀՎՀՀ համարը"
              value={tin}
              onChange={(e) => setTin(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="login">
              Մուտքանուն <span className="text-destructive">*</span>
            </Label>
            <Input
              id="login"
              placeholder="Մուտքանունը"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">
              Գաղտնաբառ <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Գաղտնաբառը"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Գաղտնաբառը պահվում է անվտանգ կերպով
            </p>
          </div>

          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm text-amber-900">
              <strong>Ուշադրություն:</strong> Այս հավատարմագրերը օգտագործվում են հարկային ծառայության հետ ինտեգրման համար։ Համոզվեք, որ տվյալները ճիշտ են։
            </p>
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
