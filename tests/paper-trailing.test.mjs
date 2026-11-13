import {paperWatchExit} from '../janggo-worker.mjs';
import test from 'node:test';import assert from 'node:assert/strict';import {paperTrail} from '../paper-trailing.mjs';
test('paper trailing activates at one initial risk, never loosens and does not call an order API',()=>{
 assert.equal(paperTrail({entry:100,initialStop:95,stop:95,price:104}).active,false);
 const a=paperTrail({entry:100,initialStop:95,stop:95,price:105});assert.equal(a.stop,100);assert.equal(a.notify,true);
 const b=paperTrail({entry:100,initialStop:95,stop:100,peak:105,price:108,lastNoticeStop:100});assert.equal(b.stop,103);assert.equal(b.notify,true);
 const c=paperTrail({entry:100,initialStop:95,stop:103,peak:108,price:107,lastNoticeStop:103});assert.equal(c.stop,103);assert.equal(c.notify,false);
 assert.equal(paperTrail({entry:100,initialStop:95,stop:103,price:102}),null);
});

test('a raised trailing stop above entry remains a valid monitored exit',()=>{const p={status:'OPEN',entryPremium:100,initialStop:95,stop:102,target:110,trailingActive:true};assert.equal(paperWatchExit(p,101).reason,'TRAIL_STOP');assert.equal(paperWatchExit(p,106).exit,false);assert.equal(paperWatchExit({...p,trailingActive:false},101).reason,'INVALID_POSITION_OR_QUOTE');});
