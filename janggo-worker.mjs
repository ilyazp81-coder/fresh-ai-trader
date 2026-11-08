// FRESH AI TRADER - BULLETPROOF DEBUG V1.4
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/telegram-webhook' && request.method === 'POST') {
      try {
        const update = await request.json();
        if (!update.message || !update.message.text) return new Response("OK");
        
        const chatId = String(update.message.chat.id);
        const userText = update.message.text.trim();
        const savedChatId = String(env.TELEGRAM_CHAT_ID || 'NOT_SET');

        // Hamesha reply karega taaki hum check kar sakein
        const replyText = `✅ BOT IS WORKING!\n\nTumne message bheja Chat ID se: \`${chatId}\`\nCloudflare mein saved hai: \`${savedChatId}\`\n\nAgar dono same hain, toh setup 100% perfect hai!`;

        await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text: replyText, parse_mode: 'Markdown' })
        });

        return new Response("OK");
      } catch (e) {
        return new Response("Error: " + e.message, { status: 500 });
      }
    }

    if (path === '/' || path === '/health') {
      return new Response("Fresh AI Trader Active! Bulletproof Mode ON", {
        headers: { 'Content-Type': 'text/plain' }
      });
    }

    return new Response("Not Found", { status: 404 });
  }
};

export class JanggoEngine {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }
  async fetch(request) {
    return new Response("Engine Running");
  }
}
