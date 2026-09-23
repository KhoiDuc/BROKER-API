export async function notifyChannel(channel: string, text: string): Promise<boolean> {
  if (channel === "telegram") {
    const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
    const chat = process.env.TELEGRAM_CHAT_ID?.trim();
    if (!token || !chat) return false;
    const resp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chat, text }),
    });
    return resp.ok;
  }

  const webhook = process.env.DISCORD_WEBHOOK_URL?.trim();
  if (!webhook) return false;
  const resp = await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: text }),
  });
  return resp.ok;
}
