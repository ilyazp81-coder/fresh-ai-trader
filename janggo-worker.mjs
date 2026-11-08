// FRESH AI TRADER - DEBUG MODE V1.2
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
        
        console.log("Incoming Chat ID:", chatId);
        console.log("Saved Env Chat ID:", env.TELEGRAM_CHAT_ID);

        const debugReply = `✅ Message Received!\n\nTumhara Actual Chat ID: \`${chatId}\`\nCloudflare mein saved ID: \`${env.TELEGRAM_CHAT_ID || 'NOT SET'}\``;

        await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text: debugReply, parse_mode: 'Markdown' })
        });

        return new Response("OK");
      } catch (e) {
        console.error("Worker Error:", e);
        return new Response("Error: " + e.message, { status: 500 });
      }
    }

    if (path === '/' || path === '/health') {
      return new Response("Fresh AI Trader Active! Debug Mode ON", {
        headers: { 'Content-Type': 'text/plain' }
      });
    }

    return new Response("Not Found", { status: 404 });
  }
};

// Yeh class zaroori hai agar wrangler.jsonc mein Durable Objects set hain
export class JanggoEngine {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }
  async fetch(request) {
    return new Response("Engine Running");
  }
}
