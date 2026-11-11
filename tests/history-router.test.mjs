
import test from 'node:test';import assert from 'node:assert/strict';
import {historicalRequest,normalizeAngelCandles,angelHeaders} from '../janggo-worker.mjs';
import {chainCommand,readSigned,signCommand,ensureBotRouter,hydrateBrokerIdentity} from '../router.mjs';
test('broker rate-limit 403 is not reported as access denial and true 403 is not retried',async()=>{
 let calls=0;
 await assert.rejects(historicalRequest('https://broker/history',{},{
  retries:0,fetchImpl:async()=>{calls++;return new Response('Access denied because of exceeding access rate',{status:403});}
 }),e=>e.code==='RATE_LIMITED'&&e.status===403);
 assert.equal(calls,1);calls=0;
 await assert.rejects(historicalRequest('https://broker/history',{},{
  retries:2,fetchImpl:async()=>{calls++;return new Response('Not authorized for this resource',{status:403});},sleepImpl:async()=>{}
 }),e=>e.code==='ACCESS_DENIED');
 assert.equal(calls,1);
});
test('every historical attempt reserves pacing and a pacing failure sends no broker request',async()=>{
 let reservations=0,requests=0;
 const result=await historicalRequest('https://broker/history',{},{
  beforeRequest:async()=>{reservations++;},retries:1,sleepImpl:async()=>{},
  fetchImpl:async()=>{requests++;return requests===1?new Response('',{status:429}):Response.json({status:true,data:[]});}
 });
 assert.equal(result.status,true);assert.equal(reservations,2);assert.equal(requests,2);
 await assert.rejects(historicalRequest('https://broker/history',{},{
  beforeRequest:async()=>{throw Error('do not expose private data');},fetchImpl:async()=>assert.fail()
 }),e=>e.code==='REQUEST_PACING_UNAVAILABLE');
});
test('explicit identity metadata wins and naive IST candles remain correctly timestamped',()=>{
 const headers=angelHeaders({SMART_API_KEY:'fake',SMART_CLIENT_PUBLIC_IP:'198.51.100.2',SMART_CLIENT_MAC:'aa:bb:cc:dd:ee:ff'});
 assert.equal(headers['X-ClientPublicIP'],'198.51.100.2');assert.equal(headers['X-MACAddress'],'aa:bb:cc:dd:ee:ff');
 const now=Date.parse('2026-11-11T10:00:00+05:30');
 const rows=normalizeAngelCandles([['2026-11-11 09:15:00',100,102,99,101,10]],{now});
 assert.equal(rows[0].t,Date.parse('2026-11-11T09:15:00+05:30'));
});
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

test('broker metadata is accepted only for the same account and explicit local settings win',async()=>{
 const code='fake-client';
 const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(code)))].map(x=>x.toString(16).padStart(2,'0')).join('');
 const env={SMART_CLIENT_CODE:code,SMART_CLIENT_MAC:'11:22:33:44:55:66',TELEGRAM_BOT_TOKEN:'fake',TELEGRAM_CHAT_ID:'7',
  OPTION_CHAIN:{fetch:async()=>Response.json({clientHash:hash,mac:'aa:bb:cc:dd:ee:ff',publicIp:'198.51.100.2'})}};
 await hydrateBrokerIdentity(env);assert.equal(env.__brokerIdentity.mac,'aa:bb:cc:dd:ee:ff');
 assert.equal(angelHeaders(env)['X-MACAddress'],'11:22:33:44:55:66');
 const wrong={...env,__brokerIdentity:null,OPTION_CHAIN:{fetch:async()=>Response.json({clientHash:'wrong',mac:'aa:bb:cc:dd:ee:ff'})}};
 await hydrateBrokerIdentity(wrong);
 assert.equal(wrong.__brokerIdentity.accountMatches,false);assert.equal(wrong.__brokerIdentity.mac,undefined);
});
