"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Check, X, Undo2 } from "lucide-react"

interface TransferStatusTransfer {
  id: number
  acepted_at: string | null
  rejected_at: string | null
  delivered_at: string | null
}

type StatusAction = "accept" | "reject" | "pending"

// Status-change buttons for a transfer, valid from ANY current status
// (including already accepted/rejected), each behind a confirm dialog.
export function TransferStatusActions({
  transfer,
  onChanged,
}: {
  transfer: TransferStatusTransfer
  onChanged: () => void
}) {
  const [confirmAction, setConfirmAction] = useState<StatusAction | null>(null)
  const [processing, setProcessing] = useState(false)
  const supabase = createClient()
  const { toast } = useToast()

  const isAccepted = !!transfer.acepted_at && !transfer.rejected_at
  const isRejected = !!transfer.rejected_at

  const dialogCopy: Record<StatusAction, { title: string; description: string; confirm: string }> = {
    accept: {
      title: "Ընդունե՞լ տեղափոխումը",
      description: isRejected
        ? "Մերժված տեղափոխումը կնշվի որպես ընդունված, և ապրանքները կհաշվառվեն պահեստի մնացորդում։"
        : "Տեղափոխումը կնշվի որպես ընդունված, և ապրանքները կհաշվառվեն պահեստի մնացորդում։",
      confirm: "Ընդունել",
    },
    reject: {
      title: "Մերժե՞լ տեղափոխումը",
      description: isAccepted
        ? "Ընդունված տեղափոխումը կնշվի որպես մերժված, և ապրանքները կհանվեն պահեստի հաշվառումից։"
        : "Տեղափոխումը կնշվի որպես մերժված։",
      confirm: "Մերժել",
    },
    pending: {
      title: "Վերադարձնե՞լ սպասման",
      description: isAccepted
        ? "Ընդունումը կչեղարկվի, ապրանքները կհանվեն պահեստի հաշվառումից, և տեղափոխումը կվերադառնա սպասման վիճակի։"
        : "Մերժումը կչեղարկվի, և տեղափոխումը կվերադառնա սպասման վիճակի։",
      confirm: "Վերադարձնել",
    },
  }

  const applyAction = async (action: StatusAction) => {
    setProcessing(true)
    try {
      const now = new Date().toISOString()
      const updateData: Record<string, string | null> =
        action === "accept"
          ? { acepted_at: now, rejected_at: null, ...(transfer.delivered_at ? {} : { delivered_at: now }) }
          : action === "reject"
            ? { rejected_at: now, acepted_at: null }
            : { acepted_at: null, rejected_at: null }

      const { error } = await supabase.from("transfer").update(updateData).eq("id", transfer.id)
      if (error) throw error

      toast({
        title: "Հաջողություն",
        description:
          action === "accept"
            ? "Տեղափոխումը ընդունվեց"
            : action === "reject"
              ? "Տեղափոխումը մերժվեց"
              : "Տեղափոխումը վերադարձվեց սպասման",
      })
      setConfirmAction(null)
      onChanged()
    } catch (error: any) {
      console.error("Error updating transfer status:", error)
      toast({ title: "Սխալ", description: error?.message || "Չհաջողվեց փոխել կարգավիճակը", variant: "destructive" })
    } finally {
      setProcessing(false)
    }
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {!isAccepted && (
          <Button variant="default" size="sm" onClick={() => setConfirmAction("accept")}>
            <Check className="h-4 w-4 mr-1" />
            Ընդունել
          </Button>
        )}
        {!isRejected && (
          <Button variant="destructive" size="sm" onClick={() => setConfirmAction("reject")}>
            <X className="h-4 w-4 mr-1" />
            Մերժել
          </Button>
        )}
        {(isAccepted || isRejected) && (
          <Button variant="outline" size="sm" onClick={() => setConfirmAction("pending")}>
            <Undo2 className="h-4 w-4 mr-1" />
            Վերադարձնել սպասման
          </Button>
        )}
      </div>

      <Dialog open={confirmAction !== null} onOpenChange={(o) => !o && !processing && setConfirmAction(null)}>
        <DialogContent className="sm:max-w-md">
          {confirmAction && (
            <>
              <DialogHeader>
                <DialogTitle>{dialogCopy[confirmAction].title}</DialogTitle>
                <DialogDescription>{dialogCopy[confirmAction].description}</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setConfirmAction(null)} disabled={processing}>
                  Չեղարկել
                </Button>
                <Button
                  variant={confirmAction === "reject" ? "destructive" : "default"}
                  onClick={() => applyAction(confirmAction)}
                  disabled={processing}
                >
                  {processing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {dialogCopy[confirmAction].confirm}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
