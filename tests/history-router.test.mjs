
import test from 'node:test';import assert from 'node:assert/strict';

import {chainCommand,readSigned,signCommand,ensureBotRouter} from '../router.mjs';



test('shared bot routing signs requests and refuses stale or tampered requests',async()=>{
 const token='fake-token',body=JSON.stringify({command:'status',chatId:'7',at:Date.now()});
 const env={TELEGRAM_BOT_TOKEN:token,TELEGRAM_CHAT_ID:'7',OPTION_CHAIN:{fetch:async(url,init)=>{
  assert.equal(url,'https://chain.internal/internal/command');
  const decoded=await readSigned(new Request(url,init),env);assert.equal(decoded.command,'status');
  return Response.json({project:'OPTION_CHAIN_ONLY'});
 }}};
 assert.equal((await chainCommand(env,'status')).project,'OPTION_CHAIN_ONLY');
 const signature=await signCommand(token,body);
 assert.equal(await readSigned(new Request('https://worker/internal',{method:'POST',headers:{'x-janggo-signature':signature},body:body+' '}),env),null);
});
test('webhook setup preserves queued updates and existing secret never appears in result',async t=>{
 const bodies=[];
 t.mock.method(globalThis,'fetch',async(url,options)=>{
  if(url.endsWith('/getWebhookInfo'))return Response.json({ok:true,result:{url:'https://old.example/',pending_update_count:3}});
  bodies.push(JSON.parse(options.body));return Response.json({ok:true,result:true});
 });
 const result=await ensureBotRouter({TELEGRAM_BOT_TOKEN:'fake',TELEGRAM_WEBHOOK_SECRET:'private-value',OPTION_CHAIN:{}});
 assert.equal(bodies[0].drop_pending_updates,false);
 assert.equal(bodies[0].secret_token,'private-value');
 assert.equal(JSON.stringify(result).includes('private-value'),false);
});



test('live Telegram health only reads webhook metadata, caches across invocation wrappers and never exposes the token',async t=>{const {telegramHealth}=await import('../router.mjs');let calls=0;const env={TELEGRAM_BOT_TOKEN:'health-only-private-token'};t.mock.method(globalThis,'fetch',async(url,init)=>{calls++;assert.ok(url.endsWith('/getWebhookInfo'));assert.equal(init.method,undefined);return Response.json({ok:true,result:{url:'https://fresh-ai-trader.ilyazp81.workers.dev/telegram-webhook',pending_update_count:0}});});const a=await telegramHealth(env);assert.equal(a.configured,true);assert.equal(a.pendingUpdates,0);assert.equal(a.messageSentByCheck,false);assert.ok(!JSON.stringify(a).includes(env.TELEGRAM_BOT_TOKEN));await telegramHealth({...env});assert.equal(calls,1);});
