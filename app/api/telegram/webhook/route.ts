import { NextRequest, NextResponse, after } from "next/server"
import { generateText } from "ai"
import { createAdminClient } from "@/lib/supabase/admin"
import { createAssistantAgent } from "@/lib/ai/assistant-agent"

export const maxDuration = 120
export const dynamic = "force-dynamic"

// Telegram bot for the database assistant. Users write (or send voice
// messages); the assistant answers in Armenian. Access is limited to chat IDs
// listed in settings.telegram_bot.allowed_chat_ids.
//
// Setup:
// 1. Create a bot with @BotFather, put the token in TELEGRAM_BOT_TOKEN.
// 2. Pick a random TELEGRAM_WEBHOOK_SECRET.
// 3. Register the webhook:
//    curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=<APP_URL>/api/telegram/webhook&secret_token=<SECRET>"

const TELEGRAM_INSTRUCTIONS = `## Telegram mode

- You are answering inside a Telegram chat. ALWAYS respond in Armenian (հայերեն), no matter what language the user writes or speaks in.
- Plain text only: no markdown headers, no markdown tables, no code fences. Use short lines, simple numbered/dash lists, and blank lines for structure.
- Be concise — this is a phone chat. Lead with the answer, keep detail minimal unless asked.
- Keep each reply under 3500 characters.`

interface ChatMessage {
  role: "user" | "assistant"
  content: string
}

const tgApi = () => `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`

async function tg(method: string, payload: Record<string, unknown>) {
  try {
    const res = await fetch(`${tgApi()}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    if (!res.ok) console.error(`[Telegram] ${method} failed:`, await res.text())
  } catch (err) {
    console.error(`[Telegram] ${method} error:`, err)
  }
}

const sendText = async (chatId: number, text: string) => {
  // Telegram caps messages at 4096 chars
  for (let i = 0; i < text.length; i += 4000) {
    await tg("sendMessage", { chat_id: chatId, text: text.slice(i, i + 4000) })
  }
}

// Armenian voice notes are transcribed by Gemini (audio input via the gateway)
async function transcribeVoice(fileId: string): Promise<string | null> {
  const fileInfo = await fetch(`${tgApi()}/getFile?file_id=${fileId}`).then((r) => r.json())
  const filePath = fileInfo?.result?.file_path
  if (!filePath) return null

  const audioRes = await fetch(
    `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${filePath}`
  )
  if (!audioRes.ok) return null
  const audio = new Uint8Array(await audioRes.arrayBuffer())

  const { text } = await generateText({
    model: "google/gemini-3.7-flash",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Transcribe this voice message verbatim. It is most likely in Armenian. Return ONLY the transcribed text with no commentary. If speech is unintelligible, return an empty response.",
          },
          { type: "file", mediaType: "audio/ogg", data: audio },
        ],
      },
    ],
  })
  const transcript = text.trim()
  return transcript.length > 0 ? transcript : null
}

async function handleMessage(message: any) {
  const chatId: number = message.chat.id
  const supabase = createAdminClient()

  // Access control
  const { data: cfg } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "telegram_bot")
    .maybeSingle()
  const allowed: number[] = cfg?.value?.allowed_chat_ids || []
  if (!allowed.includes(chatId)) {
    await sendText(
      chatId,
      `Դուք գրանցված չեք այս բոտում։\nՁեր chat ID-ն է՝ ${chatId}\nԽնդրեք ադմինիստրատորին ավելացնել այն թույլատրված ցուցակում։`
    )
    return
  }

  if (message.text === "/start") {
    await sendText(
      chatId,
      "Բարև 👋 Ես Գագոն եմ՝ ընկերության տվյալների օգնականը։ Շեֆս Արտակն է, բայց ձեզ էլ սիրով կօգնեմ 😄\n\nՀարցրեք ինչ ուզում եք տվյալների մասին՝ գրավոր կամ ձայնային հաղորդագրությամբ․ օրինակ՝ «Որքա՞ն է պահեստի մնացորդը» կամ «Ո՞ր մատակարարից ենք ամենաշատը գնել այս ամիս»։"
    )
    return
  }

  await tg("sendChatAction", { chat_id: chatId, action: "typing" })

  // Resolve the question: plain text or transcribed voice
  let userText: string | null = message.text?.trim() || null
  if (!userText && message.voice?.file_id) {
    userText = await transcribeVoice(message.voice.file_id)
    if (!userText) {
      await sendText(chatId, "Չհաջողվեց հասկանալ ձայնային հաղորդագրությունը։ Խնդրում եմ կրկնել կամ գրել տեքստով։")
      return
    }
    // Echo the transcription so the user can verify what was understood
    await sendText(chatId, `🎤 «${userText}»`)
    await tg("sendChatAction", { chat_id: chatId, action: "typing" })
  }
  if (!userText) {
    await sendText(chatId, "Խնդրում եմ ուղարկել տեքստ կամ ձայնային հաղորդագրություն։")
    return
  }

  // Short rolling conversation history per chat
  const { data: histRow } = await supabase
    .from("telegram_chat")
    .select("messages")
    .eq("chat_id", chatId)
    .maybeSingle()
  const history = ((histRow?.messages || []) as ChatMessage[]).slice(-10)

  const agent = createAssistantAgent(supabase, { extraInstructions: TELEGRAM_INSTRUCTIONS })
  const result = await agent.generate({
    messages: [...history, { role: "user", content: userText }],
  })
  const answer = result.text?.trim() || "Չհաջողվեց պատասխան ստանալ, խնդրում եմ փորձել նորից։"

  await sendText(chatId, answer)

  await supabase.from("telegram_chat").upsert({
    chat_id: chatId,
    messages: [...history, { role: "user", content: userText }, { role: "assistant", content: answer }].slice(-12),
    updated_at: new Date().toISOString(),
  })
}

export async function POST(req: NextRequest) {
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    return NextResponse.json({ ok: true })
  }

  const secret = process.env.TELEGRAM_WEBHOOK_SECRET
  if (secret && req.headers.get("x-telegram-bot-api-secret-token") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const update = await req.json().catch(() => null)
  const message = update?.message
  if (!message?.chat?.id) {
    return NextResponse.json({ ok: true })
  }

  // Ack immediately so Telegram doesn't retry, keep working in the background
  after(async () => {
    try {
      await handleMessage(message)
    } catch (err) {
      console.error("[Telegram] Failed to handle message:", err)
      await sendText(message.chat.id, "Սխալ տեղի ունեցավ։ Խնդրում եմ փորձել մի փոքր ուշ։")
    }
  })

  return NextResponse.json({ ok: true })
}
