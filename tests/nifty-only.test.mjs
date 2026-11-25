import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {deskSnapshot} from '../platform-data.mjs';
import {deskHtmlFor,deskJs} from '../platform-page.mjs';
import {entryUniverse} from '../entry-policy.mjs';
import worker from '../janggo-worker.mjs';
test('NIFTY-only dashboard never requests commodity status or journal and shows no commodity totals',async()=>{
 const commands=[],env={NIFTY_ONLY:'yes',NIFTY_COMBINED_DECISION:'yes',COMMODITY_ENABLED:'no',TELEGRAM_BOT_TOKEN:'synthetic-token',TELEGRAM_CHAT_ID:'7',OPTION_CHAIN:{fetch:async(url,init)=>{const d=JSON.parse(init.body);commands.push(d.command);if(d.command==='status')return Response.json({niftyCombinedDecision:true,sharedAiBudget:{enabled:true,calls:55,callCap:80,estimatedUsed:7865,estimatedLimit:8000,shares:{chain:80,research:0,commodity:0}}});if(d.command==='journal')return Response.json({trades:[]});assert.fail('Unexpected desk request '+d.command);}},PAPER_COORDINATOR:{idFromName:x=>x,get:()=>({fetch:async()=>Response.json({trades:[]})})}};
 const data=await deskSnapshot(env,{date:'2026-11-18',session:{},marketOpen:false,read:async()=>null});assert.deepEqual(commands.sort(),['journal','status']);assert.deepEqual(data.underlyings,['NIFTY']);assert.equal(data.marketOpen,false);assert.equal(data.niftyOnly,true);assert.equal('commodity' in data,false);assert.equal(data.totals.complete,true);assert.equal(data.budget.estimatedUsed,7865);assert.equal(data.budget.scope,'NIFTY_ONLY');assert.deepEqual(entryUniverse({...env,TRADE_UNDERLYINGS:'NIFTY,SENSEX'}),['NIFTY']);
 const html=deskHtmlFor(env);assert.match(html,/NIFTY ONLY/);assert.doesNotMatch(html,/commodity-desk|save-commodity/);assert.doesNotMatch(html,/<option value="commodity">/);assert.doesNotMatch(html,/NIFTY \+ CRUDE OIL/);
 const nodes=new Map([...html.matchAll(/id="([^"]+)"/g)].map(([,id])=>[id,{id,hidden:false,disabled:true,value:id==='chart-series'?'index':id==='journal-filter'?'all':'',textContent:'',innerHTML:'',style:{},dataset:{},options:[{value:'index'}],classList:{toggle(){}},addEventListener(){}}]));
 const paths=[],context={document:{getElementById:id=>nodes.get(id)||null,querySelectorAll:()=>[],addEventListener(){},hidden:false},fetch:async path=>{paths.push(path);return Response.json(path.endsWith('/session')?{approved:true}:path.endsWith('/data')?data:{candles:[]});},setInterval:()=>1,clearInterval(){},setTimeout,URL,Blob,Date,Map,console};await vm.runInNewContext(deskJs,context);assert.equal(nodes.get('notice').hidden,true,nodes.get('notice').textContent);assert.equal(nodes.has('commodity-desk'),false);assert.doesNotMatch(nodes.get('analysis-text').textContent,/Crude:|MCX historical/);assert.ok(paths.every(p=>!p.includes('commodity')));
});
test('a stale evening trigger cannot start health, broker, storage or AI work in NIFTY-only mode',async t=>{
 const jobs=[];let network=0,reads=0;t.mock.method(globalThis,'fetch',async()=>{network++;throw Error('No evening network request permitted');});
 await worker.scheduled({cron:'*/5 12-18 * * *',scheduledTime:Date.now()},{NIFTY_ONLY:'yes',AI_SHARED_BUDGET:'yes',STATE:{get:async()=>{reads++;throw Error('No evening storage work permitted');},put:async()=>assert.fail('No write')}},{waitUntil:p=>jobs.push(p)});await Promise.all(jobs);assert.equal(network,0);assert.equal(reads,0);
});
