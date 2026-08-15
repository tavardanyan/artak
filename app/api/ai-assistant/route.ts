import { NextResponse } from "next/server"
import { createAgentUIStreamResponse } from "ai"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { createAssistantAgent } from "@/lib/ai/assistant-agent"

export const maxDuration = 120
export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { messages } = await req.json()

  // The agent's SQL tool runs through the user's session (authenticated role),
  // hitting the SELECT-only ai_execute_sql RPC
  return createAgentUIStreamResponse({
    agent: createAssistantAgent(supabase),
    uiMessages: messages,
  })
}
