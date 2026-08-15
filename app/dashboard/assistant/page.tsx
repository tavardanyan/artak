"use client"

import { useState, useRef, useEffect } from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import type { AssistantUIMessage } from "@/lib/ai/assistant-agent"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Bot, Send, Loader2, Database, User } from "lucide-react"

const SUGGESTIONS = [
  "Որքա՞ն է ընդհանուր պահեստի մնացորդի արժեքը",
  "Ո՞ր մատակարարներից ենք ամենաշատը գնել այս տարի",
  "Ցույց տուր վերջին ամսվա գործարքների ամփոփումը ըստ նախագծերի",
  "Կա՞ն տվյալների խնդիրներ (problem views)",
]

export default function AssistantPage() {
  const [input, setInput] = useState("")
  const bottomRef = useRef<HTMLDivElement>(null)

  const { messages, sendMessage, status } = useChat<AssistantUIMessage>({
    transport: new DefaultChatTransport({ api: "/api/ai-assistant" }),
  })

  const busy = status === "submitted" || status === "streaming"

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const submit = (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || busy) return
    sendMessage({ text: trimmed })
    setInput("")
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-w-4xl mx-auto">
      <div className="pb-4">
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Bot className="h-6 w-6" />
          Գագո
        </h2>
        <p className="text-sm text-muted-foreground">
          Ձեր AI օգնականը․ հարցրեք տվյալների մասին՝ վերլուծություն, ստուգումներ, հաշվետվություններ
        </p>
      </div>

      <Card className="flex-1 min-h-0 flex flex-col">
        <CardContent className="flex-1 min-h-0 overflow-y-auto py-4 space-y-4">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center gap-4 text-center">
              <Bot className="h-12 w-12 text-muted-foreground opacity-50" />
              <p className="text-sm text-muted-foreground">Օրինակ՝</p>
              <div className="flex flex-col gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    className="text-sm border rounded-md px-3 py-2 hover:bg-accent text-left"
                    onClick={() => submit(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((message) => (
            <div key={message.id} className="flex gap-3">
              <div className="shrink-0 h-7 w-7 rounded-full bg-muted flex items-center justify-center">
                {message.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
              </div>
              <div className="flex-1 min-w-0 space-y-2 pt-0.5">
                {message.parts.map((part, i) => {
                  if (part.type === "text") {
                    return (
                      <p key={i} className="text-sm whitespace-pre-wrap leading-relaxed">
                        {part.text}
                      </p>
                    )
                  }
                  if (part.type === "tool-queryDatabase") {
                    const query = (part.input as { query?: string } | undefined)?.query
                    return (
                      <details key={i} className="text-xs border rounded-md bg-muted/50">
                        <summary className="cursor-pointer px-2 py-1.5 flex items-center gap-1.5 text-muted-foreground">
                          <Database className="h-3.5 w-3.5" />
                          SQL հարցում
                          {part.state === "input-streaming" || part.state === "input-available" ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : part.state === "output-error" ? (
                            <Badge variant="destructive" className="text-[10px] px-1 py-0">սխալ</Badge>
                          ) : null}
                        </summary>
                        {query && (
                          <pre className="px-2 pb-2 overflow-x-auto whitespace-pre-wrap font-mono">{query}</pre>
                        )}
                        {part.state === "output-available" && (
                          <pre className="px-2 pb-2 overflow-x-auto max-h-48 font-mono text-muted-foreground">
                            {JSON.stringify(part.output, null, 2)}
                          </pre>
                        )}
                      </details>
                    )
                  }
                  return null
                })}
              </div>
            </div>
          ))}

          {status === "submitted" && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground pl-10">
              <Loader2 className="h-4 w-4 animate-spin" />
              Մտածում է...
            </div>
          )}
          {status === "error" && (
            <p className="text-sm text-destructive pl-10">
              Սխալ տեղի ունեցավ։ Փորձեք նորից։
            </p>
          )}
          <div ref={bottomRef} />
        </CardContent>

        <div className="border-t p-3">
          <form
            className="flex gap-2 items-end"
            onSubmit={(e) => {
              e.preventDefault()
              submit(input)
            }}
          >
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Հարցրեք ինչ որ բան տվյալների մասին..."
              rows={2}
              className="resize-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  submit(input)
                }
              }}
            />
            <Button type="submit" size="icon" disabled={busy || !input.trim()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </form>
        </div>
      </Card>
    </div>
  )
}
