import { ToolLoopAgent, tool, InferAgentUIMessage } from "ai"
import { z } from "zod"
import { SupabaseClient } from "@supabase/supabase-js"
import { ASSISTANT_SYSTEM_PROMPT } from "./system-prompt"

// Database assistant: answers questions by running read-only SQL through the
// ai_execute_sql RPC (SELECT-only role, 500-row cap, 15s timeout).
// The model is reached through the Vercel AI Gateway (AI_GATEWAY_API_KEY or
// OIDC when deployed on Vercel).
export function createAssistantAgent(
  supabase: SupabaseClient,
  opts?: { extraInstructions?: string }
) {
  return new ToolLoopAgent({
    model: "anthropic/claude-sonnet-5",
    instructions: opts?.extraInstructions
      ? `${ASSISTANT_SYSTEM_PROMPT}\n\n${opts.extraInstructions}`
      : ASSISTANT_SYSTEM_PROMPT,
    tools: {
      queryDatabase: tool({
        description:
          "Execute a single read-only PostgreSQL SELECT (or WITH … SELECT) statement against the company database. Returns rows as JSON, capped at 500 rows. Mutations are impossible.",
        inputSchema: z.object({
          query: z.string().describe("One PostgreSQL SELECT statement, no trailing semicolon"),
        }),
        execute: async ({ query }) => {
          const { data, error } = await supabase.rpc("ai_execute_sql", { query })
          if (error) return { error: error.message }
          return { rows: data }
        },
      }),
    },
  })
}

export type AssistantUIMessage = InferAgentUIMessage<ReturnType<typeof createAssistantAgent>>
