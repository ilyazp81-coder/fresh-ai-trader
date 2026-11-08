export default {
  async fetch(request, env) {
    if (request.method === 'POST') {
      try {
        const update = await request.json();
        const chatId = update.message?.chat?.id;
        
        if (!chatId) return new Response("No chat ID found");

        const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text: "Hello from Cloudflare!" })
        });
        
        const data = await res.text();
        // Yeh line error ko Telegram ke logs mein bhej degi
        return new Response(data); 
      } catch (e) {
        return new Response("CRITICAL ERROR: " + e.message);
      }
    }
    return new Response("Fresh AI Trader Active!");
  }
};

export class JanggoEngine {
  constructor(state, env) { this.state = state; this.env = env; }
  async fetch(request) { return new Response("Engine Running"); }
}
