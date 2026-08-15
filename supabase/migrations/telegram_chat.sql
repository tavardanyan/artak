-- Telegram bot conversation history (short rolling window per chat)
create table telegram_chat (
  chat_id bigint primary key,
  messages jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
