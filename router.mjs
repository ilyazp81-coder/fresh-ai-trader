
const enc=new TextEncoder();
export async function signCommand(token,body){const key=await crypto.subtle.importKey('raw',enc.encode(token),{name:'HMAC',hash:'SHA-256'},false,['sign']);return [...new Uint8Array(await crypto.subtle.sign('HMAC',key,enc.encode(body)))].map(x=>x.toString(16).padStart(2,'0')).join('');}
export async function readSigned(request,env){
 if(!env.TELEGRAM_BOT_TOKEN)return null;const body=await request.text();if(body.length>4096)return null;
 const expected=await signCommand(env.TELEGRAM_BOT_TOKEN,body),given=request.headers.get('x-janggo-signature')||'';
 if(expected.length!==given.length)return null;let mismatch=0;for(let i=0;i<expected.length;i++)mismatch|=expected.charCodeAt(i)^given.charCodeAt(i);if(mismatch)return null;
 let data;try{data=JSON.parse(body);}catch{return null;}
 return Number.isSafeInteger(data.at)&&Math.abs(Date.now()-data.at)<=120000&&String(data.chatId)===String(env.TELEGRAM_CHAT_ID)?data:null;
}
export async function chainCommand(env,command,extra={}){
 if(!env.OPTION_CHAIN)throw Error('OPTION_CHAIN binding missing');
 const body=JSON.stringify({command,chatId:String(env.TELEGRAM_CHAT_ID),at:Date.now(),...extra});
 const response=await env.OPTION_CHAIN.fetch('https://chain.internal/internal/command',{method:'POST',
  headers:{'content-type':'application/json','x-janggo-signature':await signCommand(env.TELEGRAM_BOT_TOKEN,body)},body});
 if(!response.ok)throw Error('OPTION_CHAIN HTTP '+response.status);
 return response.json();
}
export async function ensureBotRouter(env){
 if(!env.TELEGRAM_BOT_TOKEN||!env.TELEGRAM_WEBHOOK_SECRET)throw Error('TELEGRAM_ROUTER_SECRETS_MISSING');
 const url='https://fresh-ai-trader.ilyazp81.workers.dev/telegram-webhook';
 const response=await fetch('https://api.telegram.org/bot'+env.TELEGRAM_BOT_TOKEN+'/getWebhookInfo',{signal:AbortSignal.timeout(8000)});
 const info=await response.json();if(!response.ok||info.ok!==true)throw Error('TELEGRAM_WEBHOOK_INFO_FAILED');
 // Reapply the existing secret idempotently; never discard queued updates.
 {
  const changed=await fetch('https://api.telegram.org/bot'+env.TELEGRAM_BOT_TOKEN+'/setWebhook',{method:'POST',signal:AbortSignal.timeout(8000),
   headers:{'content-type':'application/json'},body:JSON.stringify({url,secret_token:env.TELEGRAM_WEBHOOK_SECRET,allowed_updates:['message','edited_message'],drop_pending_updates:false})});
  const result=await changed.json();if(!changed.ok||result.ok!==true)throw Error('TELEGRAM_WEBHOOK_SETUP_FAILED');
 }
 return {configured:true,router:'fresh-ai-trader',optionChainService:!!env.OPTION_CHAIN,pendingUpdates:Number(info.result?.pending_update_count)||0,ordersEnabled:false};
}
let localSlots={};
export async function brokerSlot(env,kind){
 if(kind!=='login'&&env.OPTION_CHAIN){
  const slot=await chainCommand(env,'broker-slot',{kind});
  if(!Number.isSafeInteger(slot.at)||slot.at>Date.now()+10000)throw Error('INVALID_BROKER_SLOT');
  const wait=slot.at-Date.now();if(wait>0)await new Promise(r=>setTimeout(r,wait));return;
 }
 const now=Date.now(),gap=kind==='history'?550:1100,at=Math.max(now,localSlots[kind]||0);
 if(at-now>8000)throw Error('LOCAL_BROKER_QUEUE_FULL');localSlots[kind]=at+gap;
 if(at>now)await new Promise(r=>setTimeout(r,at-now));
}

export async function hydrateBrokerIdentity(env){
 if(!env.OPTION_CHAIN||!env.SMART_CLIENT_CODE)return;
 if(env.__brokerIdentity?.at&&Date.now()-env.__brokerIdentity.at<1800000)return;
 const identity=await chainCommand(env,'identity');
 const expected=[...new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(String(env.SMART_CLIENT_CODE))))].map(x=>x.toString(16).padStart(2,'0')).join('');
 if(identity.clientHash!==expected){env.__brokerIdentity={at:Date.now(),accountMatches:false};return;}
 const mac=typeof identity.mac==='string'&&/^[0-9a-f]{2}(?::[0-9a-f]{2}){5}$/i.test(identity.mac)?identity.mac:null;
 const ip=value=>typeof value==='string'&&/^(?:\d{1,3}\.){3}\d{1,3}$/.test(value)?value:null;
 env.__brokerIdentity={mac,publicIp:ip(identity.publicIp),localIp:ip(identity.localIp),at:Date.now()};
}
