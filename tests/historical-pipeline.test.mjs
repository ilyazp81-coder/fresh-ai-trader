import test from 'node:test';import assert from 'node:assert/strict';
import {minuteCandles,historicalCandles,aggregateCandles,frameIntelligence,tenHistoricalChecks,normalizeAngelCandles,fetchHistoricalWindow} from '../janggo-worker.mjs';
import {researchAudit} from '../research-audit.mjs';
test('multi-day loader uses bounded IST days, preserves broker bars and produces complete research frames',async t=>{
 const calls=[];const timer=setTimeout;t.mock.method(globalThis,'setTimeout',(fn,ms,...args)=>timer(fn,0,...args));
 t.mock.method(globalThis,'fetch',async(url,init)=>{
  assert.match(url,/getCandleData$/);const q=JSON.parse(init.body);calls.push(q);
  assert.equal(q.fromdate.slice(0,10),q.todate.slice(0,10));assert.match(q.fromdate,/09:15:00$/);
  const start=Date.parse(q.fromdate.replace(' ','T')+'+05:30'),end=Date.parse(q.todate.replace(' ','T')+'+05:30');
  const span=q.interval==='ONE_MINUTE'?60000:300000,data=[];
  for(let at=start;at<end;at+=span)data.push([new Date(at).toISOString(),100,102,99,101,0]);
  return Response.json({status:true,data});
 });
 const minute=await minuteCandles({},'fake','NIFTY',7),five=await historicalCandles({},'fake','NIFTY',7);
 assert.ok(minute.length>=750);assert.ok(five.length>=150);
 assert.ok(calls.every(q=>q.exchange==='NSE'&&q.symboltoken==='99926000'));
 assert.equal(tenHistoricalChecks(five,'NIFTY').passed,10);
 for(const tf of [1,3,5,15]){const f=frameIntelligence(minute,tf);assert.equal(f.status,'RESEARCH_ONLY');assert.equal(f.vwapProxy,null);assert.equal(f.volumeRatio,null);}
 assert.equal(aggregateCandles(minute.filter((_,i)=>i!==1),3).length,aggregateCandles(minute,3).length-1);
});
test('bad prices, duplicate timestamps and forming candles cannot create extra complete bars',()=>{
 const now=Date.parse('2026-11-11T10:00:00+05:30');
 const rows=normalizeAngelCandles([
  ['2026-11-11 09:15:00',100,102,99,101,0],['2026-11-11 09:15:00',100,103,99,102,0],
  ['2026-11-11 09:16:00',100,102,-1,101,0],['2026-11-11 09:17:00',100,102,0,101,0],
  ['2026-11-11 10:00:00',100,102,99,101,0]],{now});
 assert.equal(rows.length,1);assert.equal(rows[0].c,102);assert.equal(rows[0].v,0);
});
test('minute precision bad requests are not shortened into invalid hour-only dates',async t=>{
 let calls=0;t.mock.method(globalThis,'fetch',async()=>{calls++;return new Response('{}',{status:400});});
 await assert.rejects(fetchHistoricalWindow({},'fake',{exchange:'NSE',symboltoken:'99926000',interval:'ONE_MINUTE',fromdate:'2026-11-11 09:15',todate:'2026-11-11 09:20',label:'test'}));
 assert.equal(calls,1);
});
test('full history audit distinguishes available data from strategy validation and sends once',async()=>{
 let saved=null,sent=0;const deps={index:'NIFTY',read:async()=>saved,write:async x=>{saved=structuredClone(x);return true;},analyse:async()=>({observations:1500,frames:[1,3,5,15].map(n=>({timeframe:n+'m',count:100,status:'RESEARCH_ONLY'}))}),benchmark:async()=>({benchmarkEligible:true,passed:10,rows:300}),send:async text=>{sent++;assert.match(text,/no strategy validation/);}};
 const r=await researchAudit(deps);assert.equal(r.status,'HISTORY_AND_ANALYSIS_READY');assert.equal(r.liveSignalsVerified,false);assert.equal(r.telegram,'API_CONFIRMED');
 await researchAudit(deps);assert.equal(sent,1);
});
