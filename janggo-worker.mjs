// FRESH AI TRADER - V1.0
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
        const userText = update.message.text.trim();
        
        // Security check
        if (chatId !== env.TELEGRAM_CHAT_ID) return new Response("OK");

        // AI Reply
        const prompt = `Tum ek smart Hinglish trading assistant ho. User ne pucha: "${userText}". Seedha, short aur friendly jawab do (max 50 words).`;
        
        const aiResponse = await env.AI.run('@cf/meta/llama-3.1-8b-instruct-fp8', {
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 100
        });

        // Send reply back to Telegram
        await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: aiResponse.response.trim() })
        });

        return new Response("OK");
      } catch (e) {
        return new Response("Error", { status: 500 });
      }
    }

    // 2. HEALTH CHECK
    if (path === '/' || path === '/health') {
      return new Response("Fresh AI Trader Active! Version 1.0", {
        headers: { 'Content-Type': 'text/plain' }
      });
    }

    return new Response("Not Found", { status: 404 });
  }
};
