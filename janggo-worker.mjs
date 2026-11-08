
const J = (x,status=200)=>new Response(JSON.stringify(x),{status,headers:{"content-type":"application/json; charset=utf-8"}});
const safe=(s)=>String(s??"").replace(/[<>&]/g,"");
async function tg(env,chat,text,extra={}){
  if(!env.TELEGRAM_BOT_TOKEN) throw Error("Missing TELEGRAM_BOT_TOKEN");
  const r=await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,{
    method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({chat_id:chat,text,disable_web_page_preview:true,...extra})
  }); const x=await r.json();if(!x.ok)throw Error("Telegram: "+x.description);return x;
}
const admin=(env,id)=>String(id)===String(env.TELEGRAM_CHAT_ID||"");
async function ai(env,prompt){
  if(!env.AI)return "AI binding unavailable.";
  try {
    const r=await env.AI.run("@cf/meta/llama-3.1-8b-instruct",{
      messages:[{role:"system",content:"You are a cautious Hinglish trading education assistant. Do not fabricate live prices, verified signals, or market news. Never promise profits. You do not place orders. Answer concisely."},{role:"user",content:prompt.slice(0,3500)}],max_tokens:400
    });return String(r.response||"AI response unavailable");
  }catch(e){return "AI temporarily unavailable: "+e.message}
}
async function store(env,key,value){if(env.STATE)await env.STATE.put(key,JSON.stringify(value))}
async function load(env,key){if(!env.STATE)return null;try{return JSON.parse(await env.STATE.get(key))}catch{return null}}
function istDate(){return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date())}
function istClock(){return new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Kolkata",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(new Date())}
function marketWindow(){const d=new Date(), day=new Intl.DateTimeFormat("en-US",{timeZone:"Asia/Kolkata",weekday:"short"}).format(d),t=istClock();return !["Sat","Sun"].includes(day)&&t>="09:15"&&t<="15:30"}
async function angelSession(env){
  const required=["ANGEL_API_KEY","ANGEL_CLIENT_CODE","ANGEL_PIN","ANGEL_TOTP_SECRET"];
  const missing=required.filter(x=>!env[x]);if(missing.length)throw Error("Missing "+missing.join(", "));
  // TOTP from a locally configured base32 secret. Secret is never logged or sent to Telegram.
  const base32=String(env.ANGEL_TOTP_SECRET).toUpperCase().replace(/[\s=]/g,"");
  let bits=0,val=0,bytes=[];
  for(const c of base32){const i="ABCDEFGHIJKLMNOPQRSTUVWXYZ234567".indexOf(c);if(i<0)throw Error("Invalid TOTP secret");val=(val<<5)|i;bits+=5;if(bits>=8){bytes.push((val>>>(bits-=8))&255)}}
  const counter=Math.floor(Date.now()/30000),data=new Uint8Array(8);
  let n=BigInt(counter);for(let i=7;i>=0;i--){data[i]=Number(n&255n);n>>=8n}
  const key=await crypto.subtle.importKey("raw",new Uint8Array(bytes),{name:"HMAC",hash:"SHA-1"},false,["sign"]);
  const sig=new Uint8Array(await crypto.subtle.sign("HMAC",key,data)),offset=sig[19]&15;
  const otp=(((sig[offset]&127)<<24)|((sig[offset+1]&255)<<16)|((sig[offset+2]&255)<<8)|(sig[offset+3]&255))%1000000;
  const r=await fetch("https://apiconnect.angelone.in/rest/auth/angelbroking/user/v1/loginByPassword",{
    method:"POST",headers:{"Content-Type":"application/json","Accept":"application/json","X-UserType":"USER","X-SourceID":"WEB","X-ClientLocalIP":"127.0.0.1","X-ClientPublicIP":"127.0.0.1","X-MACAddress":"00:00:00:00:00:00","X-PrivateKey":env.ANGEL_API_KEY},
    body:JSON.stringify({clientcode:env.ANGEL_CLIENT_CODE,password:env.ANGEL_PIN,totp:String(otp).padStart(6,"0")})
  });const x=await r.json();if(!r.ok||!x.status||!x.data?.jwtToken)throw Error("Angel login failed: "+(x.message||r.status));return x.data.jwtToken;
}
async function angelQuote(env,jwt,exchange,tokens){
  const r=await fetch("https://apiconnect.angelone.in/rest/secure/angelbroking/market/v1/quote/",{
    method:"POST",headers:{"Content-Type":"application/json","Accept":"application/json","Authorization":"Bearer "+jwt,"X-UserType":"USER","X-SourceID":"WEB","X-ClientLocalIP":"127.0.0.1","X-ClientPublicIP":"127.0.0.1","X-MACAddress":"00:00:00:00:00:00","X-PrivateKey":env.ANGEL_API_KEY},
    body:JSON.stringify({mode:"FULL",exchangeTokens:{[exchange]:tokens}})
  });const x=await r.json();if(!r.ok||!x.status)throw Error("Quote unavailable: "+(x.message||r.status));return x.data?.fetched||[];
}
function contracts(env){
  try{const a=JSON.parse(env.CONTRACTS_JSON||"[]");return Array.isArray(a)?a.filter(x=>x.exchange&&x.token&&x.symbol&&x.expiry&&["CE","PE"].includes(x.side)):[]}catch{return []}
}
async function scan(env,{manual=false}={}){
  if(!env.TELEGRAM_CHAT_ID)throw Error("TELEGRAM_CHAT_ID missing");
  if(!manual&&!marketWindow())return {status:"closed",note:"Normal session closed; special sessions require explicit schedule configuration"};
  const cs=contracts(env);if(!cs.length)return {status:"not_configured",note:"CONTRACTS_JSON needs verified, current Angel instrument tokens and expiries"};
  if(!env.STATE)return {status:"not_configured",note:"STATE KV binding required for safe deduplication"};
  const jwt=await angelSession(env);
  const grouped={};for(const c of cs)(grouped[c.exchange]??=[]).push(String(c.token));
  const quotes=[];for(const [exchange,tokens] of Object.entries(grouped))quotes.push(...await angelQuote(env,jwt,exchange,tokens));
  const byToken=new Map(quotes.map(q=>[String(q.symbolToken??q.symboltoken??q.token),q]));
  let evaluated=0,alerts=0,blocked=0;
  for(const c of cs){
    const q=byToken.get(String(c.token));if(!q){blocked++;continue}
    const ltp=Number(q.ltp),open=Number(q.open),high=Number(q.high),low=Number(q.low),volume=Number(q.tradeVolume??q.volume??0);
    if(![ltp,open,high,low].every(Number.isFinite)||ltp<=0||open<=0||high<=low||volume<=0){blocked++;continue}
    evaluated++;
    // Watch alerts ONLY: one price snapshot is insufficient for a verified entry/exit signal.
    const change=(ltp/open-1)*100;
    if(change>=3&&ltp>=high*0.995){
      const key=`watch:${istDate()}:${c.exchange}:${c.token}`;
      if(await load(env,key))continue;
      const msg=`👀 WATCHLIST ONLY — NOT A VERIFIED BUY SIGNAL\n${c.symbol} ${c.side} | Expiry ${c.expiry}\nLTP ₹${ltp.toFixed(2)} | Day change +${change.toFixed(2)}%\nVolume ${volume}\nReason: premium near session high; trend, spread, data freshness, Greeks and risk checks NOT yet verified.\nNo order will be placed.`;
      await tg(env,env.TELEGRAM_CHAT_ID,msg);await store(env,key,{at:Date.now(),ltp});alerts++;
    }
  }
  return {status:"ok",evaluated,alerts,blocked,disclaimer:"Watchlist observations only; no verified entries"};
}
async function handle(env,update){
  const msg=update.message||update.edited_message;const chat=msg?.chat?.id;
  if(!chat||!admin(env,chat))return;
  const raw=(msg.text||"").trim(),cmd=raw.split(/\s+/)[0].split("@")[0].toLowerCase();
  let reply="";
  if(cmd==="/start"||cmd==="/help")reply="🤖 Cloud AI Signals\n/status — system checks\n/scan — inspect current option quotes (watchlist only)\n/nifty, /sensex — request AI educational analysis\n/news — news feed status\n/performance — stored alert count\nAny text — ask AI\n⚠️ No real orders; verified buy/sell signals are disabled until full validation.";
  else if(cmd==="/status")reply=`System: online\nIST: ${istDate()} ${istClock()}\nNormal market window: ${marketWindow()?"OPEN":"CLOSED"}\nContracts: ${contracts(env).length}\nState KV: ${env.STATE?"yes":"missing"}\nAngel configured: ${["ANGEL_API_KEY","ANGEL_CLIENT_CODE","ANGEL_PIN","ANGEL_TOTP_SECRET"].every(x=>!!env[x])?"yes":"no"}\nMode: WATCHLIST ONLY; live signals not certified`;
  else if(cmd==="/scan"){try{reply=JSON.stringify(await scan(env,{manual:true}),null,2)}catch(e){reply="Scan failed: "+e.message}}
  else if(cmd==="/performance")reply="Verified trade performance: not available. Watchlist alerts are not executed trades; do not interpret as win rate.";
  else if(cmd==="/news")reply="Verified news provider not configured. No headlines will be invented.";
  else if(cmd==="/nifty"||cmd==="/sensex")reply=await ai(env,`Explain a safe research checklist for ${cmd.slice(1).toUpperCase()}. No current quotes or headlines were provided; explicitly say live analysis is unavailable.`);
  else reply=await ai(env,raw);
  await tg(env,chat,reply.slice(0,3900));
}
export default {
  async fetch(req,env){
    const u=new URL(req.url);
    if(u.pathname==="/health")return J({ok:true,service:"cloud-ai-signals",mode:"watchlist-only"});
    if(u.pathname==="/telegram"&&req.method==="POST"){
      if(!env.TELEGRAM_WEBHOOK_SECRET||req.headers.get("X-Telegram-Bot-Api-Secret-Token")!==env.TELEGRAM_WEBHOOK_SECRET)return J({error:"unauthorized"},403);
      let update;try{update=await req.json()}catch{return J({error:"invalid json"},400)}
      // Telegram may retry deliveries; KV dedup prevents duplicate command responses.
      if(env.STATE&&update.update_id!==undefined){
        const k="tg:"+update.update_id;
        if(await load(env,k))return J({ok:true,duplicate:true});
        await store(env,k,{at:Date.now()});
      }
      try{await handle(env,update);return J({ok:true})}catch(e){console.error("Telegram handler error",e.message);return J({ok:false,error:"handler failed"},500)}
    }
    return J({error:"not found"},404);
  },
  async scheduled(event,env,ctx){
    ctx.waitUntil((async()=>{try{
      if(!marketWindow())return;
      const r=await scan(env);console.log("scheduled scan",JSON.stringify(r));
    }catch(e){console.error("scheduled scan failed",e.message);if(env.TELEGRAM_CHAT_ID&&env.STATE){const k="error:"+istDate();if(!await load(env,k)){await tg(env,env.TELEGRAM_CHAT_ID,"⚠️ Cloud AI data/scan unavailable; alerts paused. Check /status.");await store(env,k,{at:Date.now()})}}}})());
  }
};

// Preserve the class export required by the existing Cloudflare Durable Object binding.
// This is the original placeholder behavior shown by the user, NOT a trading engine.
export class JanggoEngine {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }
  async fetch(request) {
    return new Response('Engine Running');
  }
}
