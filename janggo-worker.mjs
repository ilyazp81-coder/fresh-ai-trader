export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    if (url.pathname === '/telegram-webhook' && request.method === 'POST') {
      try {
        const update = await request.json();
        
        // Har cheez ko console mein print karo taaki hum dekh sakein Telegram kya bhej raha hai
        console.log("FULL TELEGRAM UPDATE:", JSON.stringify(update));

        // Chat ID ko kahi se bhi nikal lo (message ya button click se)
        const chatId = update.message?.chat?.id || update.callback_query?.message?.chat?.id;
        
        if (!chatId) return new Response("OK");

        const replyText = `🎯 SUCCESS!\n\nTumhara Actual Chat ID: ${chatId}\nCloudflare Saved ID: ${env.TELEGRAM_CHAT_ID || 'NOT SET'}\nToken Status: ${env.TELEGRAM_BOT_TOKEN ? '✅ SET' : '❌ MISSING'}`;

        await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text: replyText })
        });

        return new Response("OK");
      } catch (e) {
        return new Response("Error: " + e.message, { status: 500 });
      }
    }

    if (url.pathname === '/') {
      return new Response("Fresh AI Trader is ALIVE and Listening!");
    }

    return new Response("Not Found", { status: 404 });
  }
};
