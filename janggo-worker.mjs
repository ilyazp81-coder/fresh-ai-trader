// FRESH AI TRADER - DEBUG MODE V1.1
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
        
        // Debug: Cloudflare logs mein dekhne ke liye
        console.log("Incoming Chat ID:", chatId);
        console.log("Saved Env Chat ID:", env.TELEGRAM_CHAT_ID);

        // Debug Reply: Yeh message tumhe wapas aayega
        const debugReply = `✅ Message Received!\n\nTumhara Actual Chat ID: \`${chatId}\`\nCloudflare mein saved ID: \`${env.TELEGRAM_CHAT_ID || 'NOT SET'}\`\n\nAgar dono same hain, toh humara setup perfect hai!`;

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
