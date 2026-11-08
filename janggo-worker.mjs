export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // TELEGRAM WEBHOOK
    if (url.pathname === '/telegram-webhook' && request.method === 'POST') {
      try {
        const update = await request.json();
        const chatId = update.message?.chat?.id;
        const text = update.message?.text || 'No text';

        if (chatId) {
          const reply = `✅ Bot Working!\n\nTumne likha: ${text}\n\nCloudflare ne message receive kar liya.`;
          
          await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text: reply })
          });
        }
        return new Response("OK");
      } catch (e) {
        return new Response("Error: " + e.message, { status: 500 });
      }
    }

    // HEALTH CHECK
    if (url.pathname === '/') {
      return new Response("Telegram Bot is ALIVE and listening!");
    }

    return new Response("Not Found", { status: 404 });
  }
};

// Required for wrangler.jsonc Durable Objects setting
export class JanggoEngine {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }
  async fetch(request) {
    return new Response("Engine Running");
  }
}
