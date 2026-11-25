import test from 'node:test';import assert from 'node:assert/strict';
import {minuteCandles,historicalCandles,aggregateCandles,frameIntelligence,tenHistoricalChecks,normalizeBrokerCandles,fetchHistoricalWindow} from '../janggo-worker.mjs';
import {researchAudit} from '../research-audit.mjs';

test('bad prices, duplicate timestamps and forming candles cannot create extra complete bars',()=>{
 const now=Date.parse('2026-11-11T10:00:00+05:30');
 const rows=normalizeBrokerCandles([
  ['2026-11-11 09:15:00',100,102,99,101,0],['2026-11-11 09:15:00',100,103,99,102,0],
  ['2026-11-11 09:16:00',100,102,-1,101,0],['2026-11-11 09:17:00',100,102,0,101,0],
  ['2026-11-11 10:00:00',100,102,99,101,0]],{now});
 assert.equal(rows.length,1);assert.equal(rows[0].c,102);assert.equal(rows[0].v,0);
});

test('full history audit distinguishes available data from strategy validation and sends once',async()=>{
 let saved=null,sent=0;const deps={index:'NIFTY',read:async()=>saved,write:async x=>{saved=structuredClone(x);return true;},analyse:async()=>({observations:1500,frames:[1,3,5,15].map(n=>({timeframe:n+'m',count:100,status:'RESEARCH_ONLY'}))}),benchmark:async()=>({benchmarkEligible:true,passed:10,rows:300}),send:async text=>{sent++;assert.match(text,/no strategy validation/);}};
 const r=await researchAudit(deps);assert.equal(r.status,'HISTORY_AND_ANALYSIS_READY');assert.equal(r.liveSignalsVerified,false);assert.equal(r.telegram,'API_CONFIRMED');
 await researchAudit(deps);assert.equal(sent,1);
});
