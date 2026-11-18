import test from 'node:test';import assert from 'node:assert/strict';
import {buildNiftyContext,combinedNiftyEnabled} from '../nifty-context.mjs';
import {researchEntriesPaused} from '../janggo-worker.mjs';
const now=Date.parse('2026-11-18T14:00:00+05:30'),frame={timeframe:'5m',status:'RESEARCH_ONLY',lastCompleteCandle:new Date(now-5*60000).toISOString(),close:25200,trend:'UP',ema9:25199,ema21:25190,ema50:25180,atr14:12};
test('only real complete and current candle frames reach combined AI context',()=>{
 const r=buildNiftyContext({frames:[frame,{...frame,timeframe:'1m',lastCompleteCandle:new Date(now-20*60000).toISOString()},{...frame,timeframe:'3m',lastCompleteCandle:new Date(now).toISOString()}]},null,now);
 assert.equal(r.status,'AVAILABLE');assert.equal(r.frames[0].trend,'UP');assert.equal(r.frames[1].trend,null);assert.equal(r.frames[2].trend,null);
 assert.equal(buildNiftyContext({frames:[]},null,now).status,'UNAVAILABLE');assert.equal(buildNiftyContext({frames:[frame]}, {status:'OPEN'},now).legacyPositionOpen,true);
 assert.equal(combinedNiftyEnabled({NIFTY_COMBINED_DECISION:'yes'}),true);assert.equal(combinedNiftyEnabled({}),false);
});
test('combined mode retires independent research entries without a KV mutation',async()=>{assert.equal(await researchEntriesPaused({NIFTY_COMBINED_DECISION:'yes'}),true);});
