import test from 'node:test';import assert from 'node:assert/strict';
import {reviewDirectionalSignals,reviewResearchWithAI,scanIndices,scanContracts} from '../janggo-worker.mjs';
import {refreshCandleEvidence} from '../candle-refresh.mjs';
test('a held option remains monitored after moving outside nearby ATM selection',async()=>{
 const rows=Array.from({length:20},(_,i)=>({underlying:'SENSEX',exchange:'BFO',token:String(i+1),symbol:'SENSEX'+i+'CE',side:'CE',strike:80000+i*100,expiry:'19NOV2026',lotsize:20}));
 const env={TRADE_UNDERLYINGS:'NIFTY',STATE:{get:async()=>JSON.stringify({status:'OPEN',exchange:'BFO',token:'20'}),put:async()=>{}}};
 const selected=await scanContracts(env,rows,'SENSEX',80000);assert.ok(selected.some(c=>c.token==='20'));assert.equal(selected.filter(c=>c.token==='20').length,1);
});
test('NIFTY-only scans retain a paused index only while an existing paper position is open',async()=>{
 const env={TRADE_UNDERLYINGS:'NIFTY',STATE:{get:async()=>null,put:async()=>{}}};assert.deepEqual(await scanIndices(env),['NIFTY']);
 env.STATE.get=async()=>JSON.stringify({status:'OPEN'});assert.deepEqual(await scanIndices(env),['NIFTY','SENSEX']);
 env.STATE.get=async()=>JSON.stringify({status:'CLOSED'});assert.deepEqual(await scanIndices(env),['NIFTY']);
});
test('paused SENSEX consumes no new history or backfill requests',async()=>{
 const now=Date.parse('2026-11-16T12:00:00+05:30'),calls=[];const row={t:now-60000,o:100,h:102,l:99,c:101,v:10};
 await refreshCandleEvidence({now,day:'2026-11-16',enabledIndices:['NIFTY'],readCache:async()=>null,writeCache:async()=>{},today:async index=>{calls.push(index);return[row]},seed:async index=>{calls.push(index);return[row]},analyse:()=>({}),saveEvidence:async()=>true,safeError:e=>e.message});assert.deepEqual(calls,['NIFTY','NIFTY']);
});
test('paused SENSEX watches do not consume either research or directional AI calls',async()=>{
 const env={TRADE_UNDERLYINGS:'NIFTY',AI:{run:()=>assert.fail('Paused index cannot reach AI')}};
 const watches=[{underlying:'SENSEX',symbol:'SENSEXCE',side:'CE'}];
 assert.equal((await reviewDirectionalSignals(env,watches,{SENSEX:{}})).status,'NO_CANDIDATES');
 assert.equal((await reviewResearchWithAI(env,watches,{SENSEX:{}})).status,'NO_CANDIDATES');
});
test('mixed observations pass only NIFTY evidence to directional AI',async()=>{
 let input;const env={TRADE_UNDERLYINGS:'NIFTY',AI:{run:async(model,payload)=>{input=JSON.parse(payload.messages[1].content);return {response:{decisions:[{symbol:'NIFTYCE',action:'WAIT',reason:'No justified entry yet'}]}}}}};
 const r=await reviewDirectionalSignals(env,[{underlying:'SENSEX',symbol:'SENSEXCE',side:'CE'},{underlying:'NIFTY',symbol:'NIFTYCE',side:'CE'}],{SENSEX:{},NIFTY:{}});
 assert.equal(r.status,'AI_REVIEWED');assert.deepEqual(Object.keys(input.indices),['NIFTY']);assert.equal(input.evidence.length,1);assert.equal(input.tradePreferences.targetsMandatory,false);
});
