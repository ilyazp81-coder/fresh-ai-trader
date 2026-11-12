import {signCommand} from './router.mjs';
// Cache requests require the existing owner identity, a timestamp and an HMAC.
// Do not expose an unauthenticated cache read or write route.
export async function authorizedCandleCacheRequest(request,env){
 if(request.method!=='POST'||!env.TELEGRAM_BOT_TOKEN)return null;
 const given=request.headers.get('x-janggo-signature')||'';if(!/^[a-f0-9]{64}$/.test(given))return null;
 const body=await request.text();if(body.length>2000000)return null;
 const expected=await signCommand(env.TELEGRAM_BOT_TOKEN,body);let different=0;
 for(let i=0;i<expected.length;i++)different|=expected.charCodeAt(i)^given.charCodeAt(i);if(different)return null;
 let data;try{data=JSON.parse(body)}catch{return null;}
 if(!Number.isSafeInteger(data.at)||Math.abs(Date.now()-data.at)>120000||String(data.chatId)!==String(env.TELEGRAM_CHAT_ID)||!['cache-read','cache-write'].includes(data.command))return null;
 return data;
}
export async function requestCandleCache(env,stub,command,cache){
 const body=JSON.stringify({command,cache,at:Date.now(),chatId:String(env.TELEGRAM_CHAT_ID)});
 return stub.fetch('https://coordinator.internal/internal/candle-cache',{method:'POST',headers:{'content-type':'application/json','x-janggo-signature':await signCommand(env.TELEGRAM_BOT_TOKEN,body)},body});
}
// Refresh both independent index research views; quotes never substitute for OHLC.
export async function refreshCandleEvidence({now,day,readCache,writeCache,seed,today,analyse,saveEvidence,safeError}){
 const cache=await readCache()||{rows:{},errors:{}};cache.rows||={};cache.errors||={};
 const outcomes={};
 for(const index of ['NIFTY','SENSEX']){
  try{
   const blocked=cache.errors[index];if(blocked?.retryAfter>now)throw Error(blocked.reason);
   const existing=Array.isArray(cache.rows[index])?cache.rows[index]:[];
   const loaded=existing.length?await today(index):await seed(index);
   const byTime=new Map(existing.map(x=>[x.t,x]));for(const row of loaded)byTime.set(row.t,row);
   const rows=[...byTime.values()].filter(x=>x.t>=now-8*86400000&&x.t+60000<=now).sort((a,b)=>a.t-b.t).slice(-5000);
   const last=rows.at(-1);
   if(!last||new Date(last.t+19800000).toISOString().slice(0,10)!==day)throw Error('NO_CLOSED_CANDLES_TODAY');
   if(now-last.t>240000)throw Error('HISTORICAL_CANDLES_STALE');
   cache.rows[index]=rows;delete cache.errors[index];
   const evidence={at:now,...analyse(index,rows),candleFresh:true};
   if(await saveEvidence(index,evidence)===false)throw Error('CANDLE_EVIDENCE_SAVE_FAILED');
   outcomes[index]={status:'REFRESHED',rows:rows.length,lastCompleteCandle:new Date(last.t).toISOString()};
  }catch(error){
   const reason=safeError(error);const limited=/RATE_LIMITED|HTTP 429/.test(reason);
   const denied=!limited&&/ACCESS_DENIED|HTTP 401|HTTP 403/.test(reason);
   if(!cache.errors[index]||cache.errors[index].retryAfter<=now)cache.errors[index]={reason,retryAfter:now+(denied?1800000:limited?300000:60000)};
   outcomes[index]={status:'UNAVAILABLE',reason,retryAfter:cache.errors[index].retryAfter};
   await saveEvidence(index,{at:now,underlying:index,status:'HISTORICAL_REFRESH_UNAVAILABLE',historicalError:reason,candleFresh:false,signalEligible:false,ordersPlaced:false});
  }
 }
 cache.at=now;await writeCache(cache);return {at:now,indices:outcomes,ordersEnabled:false};
}

// Durable Object KV values have a per-value size limit. Keep history in small chunks.
export function packCandleCache(cache){
 const writes={},manifest={at:cache.at,errors:cache.errors||{},indices:{}};
 for(const index of ['NIFTY','SENSEX']){
  const rows=cache.rows?.[index]||[];if(rows.length>5000)throw Error('HISTORY_CACHE_TOO_LARGE');
  manifest.indices[index]=Math.ceil(rows.length/100);
  for(let i=0;i<rows.length;i+=100){const part=rows.slice(i,i+100);if(new TextEncoder().encode(JSON.stringify(part)).length>110000)throw Error('HISTORY_CHUNK_TOO_LARGE');writes['candles:'+index+':'+i/100]=part;}
 }
 writes['candles:manifest']=manifest;return writes;
}
export async function readPackedCandleCache(storage){
 const manifest=await storage.get('candles:manifest');if(!manifest)return null;
 const rows={};for(const index of ['NIFTY','SENSEX']){const count=manifest.indices[index]||0;if(count>50)throw Error('INVALID_HISTORY_MANIFEST');rows[index]=(await Promise.all(Array.from({length:count},(_,i)=>storage.get('candles:'+index+':'+i)))).flatMap(x=>Array.isArray(x)?x:[]);}
 return {at:manifest.at,rows,errors:manifest.errors||{}};
}
