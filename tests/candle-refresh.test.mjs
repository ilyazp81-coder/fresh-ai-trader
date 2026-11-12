import test from 'node:test';import assert from 'node:assert/strict';
import {refreshCandleEvidence,requestCandleCache} from '../candle-refresh.mjs';
import {signCommand} from '../router.mjs';
import {PaperAlertCoordinator,runScheduledPaperCycle} from '../janggo-worker.mjs';
test('candle cache rejects unauthenticated, stale and wrong-owner requests; authenticated large caches remain bounded',async()=>{
 const values=new Map();let puts=0;
 const storage={get:async key=>values.get(key),put:async writes=>{puts++;for(const [key,value] of Object.entries(writes)){assert.ok(Buffer.byteLength(JSON.stringify(value))<110001);values.set(key,structuredClone(value));}}};
 const env={TELEGRAM_BOT_TOKEN:'fake-token',TELEGRAM_CHAT_ID:'7'};
 const coordinator=new PaperAlertCoordinator({storage},env);
 for(const method of ['GET','POST','PUT'])assert.equal((await coordinator.fetch(new Request('https://private/internal/candle-cache',{method}))).status,403);
 assert.equal(puts,0);
 const stub={fetch:(url,init)=>coordinator.fetch(new Request(url,init))};
 const now=Date.now(),rows=Array.from({length:2000},(_,i)=>({t:now-(2001-i)*60000,o:100,h:102,l:99,c:101,v:0}));
 const cache={at:now,rows:{NIFTY:rows,SENSEX:rows},errors:{}};
 assert.equal((await requestCandleCache(env,stub,'cache-write',cache)).status,200);
 const returned=await (await requestCandleCache(env,stub,'cache-read')).json();assert.equal(returned.rows.NIFTY.length,2000);assert.equal(returned.rows.SENSEX.length,2000);assert.equal(returned.rows.NIFTY[0].v,0);
 for(const extra of [{at:now-130000,chatId:'7'},{at:now,chatId:'8'}]){
  const body=JSON.stringify({command:'cache-write',cache,...extra});
  assert.equal((await coordinator.fetch(new Request('https://private/internal/candle-cache',{method:'POST',headers:{'x-janggo-signature':await signCommand(env.TELEGRAM_BOT_TOKEN,body)},body}))).status,403);
 }
 assert.equal(puts,1);
});
test('scheduled candles seed once, merge broker updates and fail closed on stale history',async()=>{
 let now=Date.parse('2026-11-12T10:00:00+05:30'),cache=null,seeds=0,loads=0;const saved={};
 const row=()=>({t:now-120000,o:100,h:102,l:99,c:101,v:0});
 const deps={now,day:'2026-11-12',readCache:async()=>cache,writeCache:async x=>{cache=structuredClone(x);},seed:async()=>{seeds++;return [row()];},today:async()=>{loads++;return [row()];},analyse:(index,rows)=>({underlying:index,observations:rows.length}),saveEvidence:async(index,value)=>{saved[index]=value;return true;},safeError:e=>e.message};
 await refreshCandleEvidence(deps);assert.equal(seeds,2);assert.equal(saved.NIFTY.candleFresh,true);
 now+=180000;await refreshCandleEvidence({...deps,now});assert.equal(seeds,2);assert.equal(loads,2);assert.equal(saved.NIFTY.observations,2);
 now+=300000;await refreshCandleEvidence({...deps,now,today:async()=>[]});assert.equal(saved.NIFTY.candleFresh,false);assert.equal(saved.SENSEX.candleFresh,false);assert.equal(saved.NIFTY.status,'HISTORICAL_REFRESH_UNAVAILABLE');
});
test('stale research cannot trigger review or selection and unchanged waits do not flood KV diagnostics',async()=>{
 let now=Date.now(),reviews=0,writes=0;const memory=new Map();
 const kv={get:async key=>memory.get(key)||null,put:async(key,text)=>{writes++;memory.set(key,JSON.parse(text));}};
 const deps={kv,marketOpen:true,now:()=>now,track:async()=>({status:'IDLE'}),loadEvidence:async()=>({market:{at:now-3600000},options:{at:now-3600000}}),review:async()=>{reviews++;},select:async()=>assert.fail('Cannot select from stale evidence')};
 const result=await runScheduledPaperCycle(deps);assert.ok(result.results.every(x=>x.status==='EVIDENCE_STALE'));assert.equal(reviews,0);assert.equal(writes,2);
 now+=180000;await runScheduledPaperCycle(deps);assert.equal(writes,2);
});

test('an expired broker backoff is renewed after a new rate-limit rejection',async()=>{
 const now=Date.now(),cache={rows:{},errors:{NIFTY:{reason:'RATE_LIMITED',retryAfter:now-1}}};let saved;
 await refreshCandleEvidence({now,day:'2026-11-12',readCache:async()=>cache,writeCache:async x=>{saved=x;},seed:async()=>{throw Error('RATE_LIMITED');},today:async()=>[],analyse:()=>({}),saveEvidence:async()=>true,safeError:e=>e.message});
 assert.ok(saved.errors.NIFTY.retryAfter>=now+300000);
});
