// FRESH AI TRADER - SUPER DEBUG MODE V1.3
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // 1. TELEGRAM WEBHOOK
    if (path === '/telegram-webhook' && request.method === 'POST') {
      try {
        const update = await request.json();
        if (!update.message || !update.message.text) return new Response("OK");
        
        const chatId = String(update.message.chat.id);
        const botToken = env.TELEGRAM_BOT_TOKEN;
        const savedChatId = env.TELEGRAM_CHAT_ID;

        let replyText = "";
        
        if (!botToken) {
          replyText = "❌ ERROR: TELEGRAM_BOT_TOKEN Cloudflare mein set nahi hai! Please check Variables.";
        } else {
          replyText = `✅ Message Received!\n\nTumhara Actual Chat ID: \`${chatId}\`\nCloudflare mein saved Chat ID: \`${savedChatId || 'NOT SET'}\`\nBot Token Status: ✅ Set Hai`;
        }

        if (botToken) {
          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text: replyText, parse_mode: 'Markdown' })
          });
        }

        return new Response("OK");
      } catch (e) {
        console.error("Worker Error:", e);
        return new Response("Error: " + e.message, { status: 500 });
      }
    }

    // 2. HEALTH CHECK (Yeh tumhe browser mein sab dikha dega)
    if (path === '/' || path === '/health') {
      return new Response(`Fresh AI Trader Active!\n\n--- DEBUG INFO ---\nBot Token Set: ${env.TELEGRAM_BOT_TOKEN ? 'YES ✅' : 'NO ❌'}\nChat ID Set: ${env.TELEGRAM_CHAT_ID ? 'YES ✅' : 'NO ❌'}\nSaved Chat ID Value: ${env.TELEGRAM_CHAT_ID || 'NOT SET'}`, {
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
