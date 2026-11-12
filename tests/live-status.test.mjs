import test from 'node:test';import assert from 'node:assert/strict';
import worker from '../janggo-worker.mjs';
test('live audit reads each project independently and cannot request a scan or order',async t=>{
 t.mock.method(globalThis,'fetch',async()=>assert.fail('No external API should be requested'));
 const cached={underlying:'NIFTY',at:Date.now(),frames:[{timeframe:'1m',status:'RESEARCH_ONLY'}]};
 const env={TELEGRAM_BOT_TOKEN:'fake-token',TELEGRAM_CHAT_ID:'7',STATE:{get:async key=>key==='marketintel:NIFTY'?JSON.stringify(cached):null,put:async()=>assert.fail('Read-only route must not write')},OPTION_CHAIN:{fetch:async(url,init)=>{
  assert.equal(JSON.parse(init.body).command,'status');
  return Response.json({project:'OPTION_CHAIN_ONLY',lastScan:{fresh:700},aiConnectionAudit:{selector:'READY'}});
 }}};
 const response=await worker.fetch(new Request('https://worker/research-data-audit'),env);
 assert.equal(response.status,200);const result=await response.json();
 assert.equal(result.optionChain.project,'OPTION_CHAIN_ONLY');assert.equal(result.currentResearch.NIFTY.underlying,'NIFTY');assert.equal(result.currentResearch.SENSEX,null);
 assert.equal(result.ordersEnabled,false);assert.ok(!JSON.stringify(result).includes('fake-token'));
});
