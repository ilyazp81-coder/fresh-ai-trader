import {niftyOnly} from './entry-policy.mjs';
import {chainCommand,signCommand} from './router.mjs';
import {combinedNiftyEnabled} from './nifty-context.mjs';
const n=x=>typeof x==='number'&&Number.isFinite(x)?x:null;
export function deskTrade(p,project,state,meta={}){
 const entry=n(p.entry??p.entryPremium),exit=n(meta.exitPrice??p.exitPremium),quantity=n(p.quantity??p.lot??p.lotSize),closed=state==='PAPER_CLOSED'||state==='CLOSED';
 return {lots:p.lots??1,lotSize:n(p.lotSize??p.lot),priceMultiplier:n(p.priceMultiplier)??1,countable:project==='chain'||p.entryDelivery==='DELIVERED',instrumentToken:typeof p.token==='string'?p.token:null,exchange:p.exchange||null,id:String(meta.id??p.signalId??project+':'+p.index+':'+p.entryAt),project,provider:p.provider||'UNKNOWN',symbol:String(p.symbol||'Unknown contract'),side:p.side||null,state,entry,exit,quantity,
  stop:n(p.stop),targets:Array.isArray(p.targets)?p.targets.map(n).filter(x=>x!==null):n(p.target)!==null?[p.target]:[],
  planStyle:p.planStyle||'RESEARCH',trailing:p.trailingActive===true,openedAt:meta.createdAt??p.entryAt??null,closedAt:meta.closedAt??p.exitAt??null,timeExit:p.timeExit??null,
  entryReason:typeof p.analysisReason==='string'?p.analysisReason:typeof p.thesis==='string'?p.thesis:null,analysisId:p.analysisId??null,invalidation:p.invalidation??null,decisionModel:p.decisionModel??null,initialStop:n(p.initialStop??p.stop),entryPremiumChangePct:n(p.premiumChangePct),entryOiChangePct:n(p.oiChangePct),entryVolumeChange:n(p.volumeChange),exitReason:meta.exitReason??p.exitReason??null,delivery:p.entryDelivery??p.delivery??(state==='DELIVERY_UNCONFIRMED'?'UNCONFIRMED':null),
  points:closed&&entry!==null&&exit!==null?+(exit-entry).toFixed(2):null,
  grossPnl:closed&&entry!==null&&exit!==null&&quantity>0?+((exit-entry)*quantity*(n(p.priceMultiplier)??1)).toFixed(2):null};
}
export function deskTotals(trades){
 const allClosed=trades.filter(t=>['PAPER_CLOSED','CLOSED'].includes(t.state)),closed=allClosed.filter(t=>t.countable),priced=closed.filter(t=>t.points!==null);
 return {open:trades.filter(t=>['PAPER_OPEN','OPEN'].includes(t.state)).length,wins:priced.filter(t=>t.points>0).length,losses:priced.filter(t=>t.points<0).length,flat:priced.filter(t=>t.points===0).length,unpriced:closed.length-priced.length,uncertain:allClosed.length-closed.length,grossPnl:closed.some(t=>t.grossPnl!==null)?+closed.reduce((s,t)=>s+(t.grossPnl??0),0).toFixed(2):null};
}
export async function researchDeskJournal(env,date){
 const stub=env.PAPER_COORDINATOR.get(env.PAPER_COORDINATOR.idFromName('janggo-paper-alerts-v1'));
 const body=JSON.stringify({command:'platform-journal',day:date,chatId:String(env.TELEGRAM_CHAT_ID),at:Date.now()});
 const r=await stub.fetch('https://paper.internal/internal/platform-journal',{method:'POST',headers:{'content-type':'application/json','x-janggo-signature':await signCommand(env.TELEGRAM_BOT_TOKEN,body)},body});
 if(!r.ok)throw Error('RESEARCH_JOURNAL_UNAVAILABLE');return r.json();
}
export async function deskSnapshot(env,{read,date,session,marketOpen}){
 const [chain,journal,research,scan,audit,paused,daily,lots]=await Promise.allSettled([chainCommand(env,'status'),chainCommand(env,'journal',{day:date}),researchDeskJournal(env,date),read('scan:last'),read('broker:neo:commissioning'),read('platform:research-paused'),read('research:paper:alerts:last'),read('platform:paper-lots')]);
 const value=(x,f=null)=>x.status==='fulfilled'?x.value:f,c=value(chain),j=value(journal,{trades:[]}),r=value(research,{trades:[]}),shared=c?.sharedAiBudget?.enabled?c.sharedAiBudget:null;
 const trades=[...(j.trades||[]).map(t=>deskTrade(t.body,'chain',t.state,t)),...(r.trades||[]).map(p=>deskTrade(p,'research',p.status))];
 return {at:new Date().toISOString(),day:date,niftyOnly:true,marketOpen,niftyOpen:marketOpen,session,mode:'EXPERIMENTAL_PAPER',ordersEnabled:false,underlying:'NIFTY',underlyings:['NIFTY'],sections:c?.sections??[],trades,totals:{...deskTotals(trades),complete:journal.status==='fulfilled'&&research.status==='fulfilled'},
 chain:c?{modularPaper:c.modularPaper??null,connected:true,enabled:c.enabled,paperAlertsEnabled:c.paperAlertsEnabled,combined:c.niftyCombinedDecision===true,candleContext:c.niftyContext??null,aiDecisionMode:c.aiDecisionMode,aiCallsPerSetup:c.aiCallsPerSetup,lots:c.paperLots??1,provider:c.broker?.activeProvider,scan:c.lastScan,review:c.lastAIReview,block:c.lastEntryBlock,error:c.lastError,aiCalls:c.aiCallsToday,callCap:c.aiBudgetLimit,nextReview:c.nextAIReviewAt,spot:c.broker?.probe?.spot}:{connected:false,error:'Chain status unavailable'},
 research:{connected:audit.status==='fulfilled',enabled:!combinedNiftyEnabled(env)&&value(paused)!==true,merged:combinedNiftyEnabled(env),lots:value(lots)??1,provider:'KOTAK_NEO',scan:value(scan),audit:value(audit),paper:value(daily)},
 budget:{scope:'NIFTY_ONLY',shares:shared?.shares??null,sharedEnabled:!!shared,calls:shared?.calls??c?.aiCallsToday??null,callCap:shared?.callCap??80,estimatedUsed:shared?.estimatedUsed??null,estimatedLimit:shared?.estimatedLimit??null,priorUsageUnknown:shared?.priorUsageUnknown??true,byCaller:shared?.byCaller??null,lastBlock:shared?.lastBlock??null,chainCalls:c?.aiCallsToday??null,chainCap:c?.aiBudgetLimit??80,providerUsageKnown:false,freeNeuronAllowance:10000,paidEnabled:false,note:'Call count is not the shared Cloudflare neuron balance. Paper exits do not require AI.'},
 analysis:{nifty:c?.advancedAnalysis?.NFO||null,niftyHealth:c?.health||null,niftyEvaluation:j.analysis||null,archiveErrors:[c?.analyticsArchiveError].filter(Boolean)},
 issues:[...(c?.lastError?['Option-chain scan blocked: '+c.lastError]:[]),...(marketOpen&&c?.lastScan&&Date.now()-Date.parse(c.lastScan.at)>180000?['Option-chain scan is stale; new entries need a fresh scan.']:[]),...[chain,journal,research].flatMap((x,i)=>x.status==='rejected'?[['Chain status','Chain journal','Research journal'][i]+' unavailable']:[])]};
}
