export default {
  async fetch(request, env) {
    if (request.method === 'POST') {
      try {
        const update = await request.json();
        const chatId = update.message?.chat?.id;
        if (chatId) {
          await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text: `✅ WORKING! Chat ID: ${chatId}` })
          });
        }
        return new Response("OK");
      } catch (e) {
        return new Response("Error");
      }
    }
    return new Response("Fresh AI Trader Active!");
  }
};
