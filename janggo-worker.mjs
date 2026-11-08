
const VERSION = '1.0.0-FRESH';
const MASTER_URL = 'https://margincalculator.angelone.in/OpenAPI_File/files/OpenAPIScripMaster.json';

// --- TELEGRAM FUNCTION ---
async function sendTelegram(env, text) {
    if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return;
    try {
        await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: text, parse_mode: 'Markdown' })
        });
    } catch (e) { console.error("Telegram Error", e); }
}

// --- CORE WORKER ---
export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const path = url.pathname;

        // 1. Telegram Webhook Handler
        if (path === '/telegram-webhook' && request.method === 'POST') {
            try {
                const update = await request.json();
                if (!update.message || !update.message.text) return new Response("OK");
                
                const chatId = String(update.message.chat.id);
                const userText = update.message.text.trim();
                
                if (chatId !== env.TELEGRAM_CHAT_ID) return new Response("OK");

                // AI Boss Reply Logic
                const prompt = `Tum ek smart Hinglish trading assistant ho. User ne pucha: "${userText}". Seedha, short aur friendly jawab do (max 50 words).`;
                const aiResponse = await env.AI.run('@cf/meta/llama-3.1-8b-instruct-fp8', {
                    messages: [{ role: 'user', content: prompt }],
                    max_tokens: 100
                });

                await sendTelegram(env, aiResponse.response.trim());
                return new Response("OK");
            } catch (e) {
                return new Response("Error", { status: 500 });
            }
        }

        // 2. Health Check
        if (path === '/' || path === '/health') {
            return new Response(`Fresh AI Trader Active! Version: ${VERSION}`, {
                headers: { 'Content-Type': 'text/plain' }
            });
        }

        // 3. Nifty + Sensex Master Fetch Test
        if (path === '/api/test-master') {
            try {
                const res = await fetch(MASTER_URL);
                const data = await res.json();
                
                // Filter Nifty and Sensex Options
                const niftySensex = data.filter(i => {
                    const isNifty = i.name === 'NIFTY' && i.exch_seg === 'NFO';
                    const isSensex = i.name === 'SENSEX' && i.exch_seg === 'BFO';
                    return (isNifty || isSensex) && i.instrumenttype === 'OPTIDX';
                });

                return Response.json({ 
                    status: 'SUCCESS', 
                    totalFound: niftySensex.length,
                    sample: niftySensex.slice(0, 5) 
                });
            } catch (e) {
                return Response.json({ status: 'ERROR', message: e.message }, { status: 500 });
            }
        }

        return new Response("Not Found", { status: 404 });
    }
};

// --- DURABLE OBJECT (Placeholder for future engine) ---
export class JanggoEngine {
    constructor(state, env) {
        this.state = state;
        this.env = env;
    }
    async fetch(request) {
        return new Response("Engine Running");
    }
}
