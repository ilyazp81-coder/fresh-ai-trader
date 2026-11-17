import {paperSize} from './paper-sizing.mjs';
import {deskHtml,deskCss,deskJs} from './platform-page.mjs';
import {approvedDesk,beginDesk,logoutDesk,privateJson,sameOrigin,deskSessionStatus} from './platform-auth.mjs';
import {deskSnapshot} from './platform-data.mjs';
import {chainCommand} from './router.mjs';
const headers={'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer','x-frame-options':'DENY','permissions-policy':'camera=(), microphone=(), geolocation=()','content-security-policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"};
const snapshots=new WeakMap(),charts=new WeakMap();
async function snapshot(env,deps){const old=snapshots.get(env);if(old&&Date.now()-old.at<15000)return old.promise;const promise=deskSnapshot(env,deps);snapshots.set(env,{at:Date.now(),promise});try{return await promise}catch(e){snapshots.delete(env);throw e;}}
async function chart(env,deps,tradeId){
 let instrumentToken='Nifty 50',exchangeSegment='nse_cm',symbol='NIFTY 50',kind='INDEX';
 if(tradeId==='commodity'){const c=(await snapshot(env,deps)).commodity?.marketSample;if(!c||!/^\d{1,12}$/.test(c.token||''))throw Error('CHART_DATA_UNAVAILABLE');instrumentToken=c.token;exchangeSegment='mcx_fo';symbol=c.symbol;kind='OPTION';}
 else if(tradeId&&tradeId!=='index'){
  if(tradeId.length>240)throw Error('CHART_NOT_LISTED');
  const trade=(await snapshot(env,deps)).trades.find(t=>t.id===tradeId);
  if(!trade||trade.provider!=='KOTAK_NEO'||!/^\d{1,12}$/.test(trade.instrumentToken||''))throw Error('CHART_NOT_LISTED');
  instrumentToken=trade.instrumentToken;exchangeSegment=trade.exchange==='NFO'?'nse_fo':trade.exchange==='BFO'?'bse_fo':trade.exchange==='MCX'?'mcx_fo':null;if(!exchangeSegment)throw Error('CHART_NOT_LISTED');symbol=trade.symbol;kind='OPTION';
 }
 const old=charts.get(env),key=exchangeSegment+'|'+instrumentToken+'|'+deps.date;
 if(old?.key===key&&Date.now()-old.at<60000)return old.promise;
 const promise=(async()=>{
  const fromDate=new Date(Date.now()-6*86400000+19800000).toISOString().slice(0,10);
  const data=await chainCommand(env,'neo-read',{operation:'candles',args:{exchangeSegment,instrumentToken,fromDate,toDate:deps.date,interval:'1min'}});
  if(data.provider!=='KOTAK_NEO'||!Array.isArray(data.candles))throw Error('CHART_DATA_UNAVAILABLE');
  const sessionHours=exchangeSegment==='mcx_fo'?{openMinute:540,closeMinute:1435}:{openMinute:555,closeMinute:930};
  const candles=data.candles.filter(c=>{const d=new Date(c.at),local=new Date(d.getTime()+19800000),minute=local.getUTCHours()*60+local.getUTCMinutes();return minute>=sessionHours.openMinute&&minute<sessionHours.closeMinute&&d.getTime()+60000<=Date.now();}).slice(-2500);
  return {provider:'KOTAK_NEO',kind,symbol,asOf:data.receivedAt,sessionHours,candles,sessionValidated:false,ordersEnabled:false};
 })();charts.set(env,{key,at:Date.now(),promise});try{return await promise}catch(e){charts.delete(env);throw e;}
}
export async function platformFetch(request,env,deps){
 const path=new URL(request.url).pathname;if(path!=='/platform'&&!path.startsWith('/platform/'))return null;
 try{
  if(request.method==='GET'&&(path==='/platform'||path==='/platform/'))return new Response(deskHtml,{headers:{...headers,'content-type':'text/html; charset=utf-8'}});
  if(request.method==='GET'&&path==='/platform/style.css')return new Response(deskCss,{headers:{...headers,'content-type':'text/css; charset=utf-8'}});
  if(request.method==='GET'&&path==='/platform/app.js')return new Response(deskJs,{headers:{...headers,'content-type':'text/javascript; charset=utf-8'}});
  if(path==='/platform/auth'&&request.method==='POST')return await beginDesk(request,env);
  if(path==='/platform/logout'&&request.method==='POST')return await logoutDesk(request,env);
  if(path==='/platform/session'&&request.method==='GET')return deskSessionStatus(request,env);
  if(!await approvedDesk(request,env))return privateJson({message:'Approve this browser through Janggo first.'},401);
  if(path==='/platform/data'&&request.method==='GET')return privateJson(await snapshot(env,deps));
  if(path==='/platform/chart'&&request.method==='GET')return privateJson(await chart(env,deps,new URL(request.url).searchParams.get('trade')));
  if(path==='/platform/settings'&&request.method==='POST'){
   if(!sameOrigin(request))return privateJson({message:'Use settings from your own desk page.'},403);
   const raw=await request.text();if(raw.length>256)return privateJson({message:'Invalid size setting.'},400);let d;try{d=JSON.parse(raw);paperSize(1,d.lots)}catch{return privateJson({message:'Choose a whole number from 1 to 10 lots.'},400);}
   if(!['chain','research','commodity'].includes(d.project))return privateJson({message:'Choose one of your two desks.'},400);
   if(d.project==='chain')await chainCommand(env,'paper-settings',{lots:d.lots});else if(d.project==='commodity')await chainCommand(env,'commodity-settings',{lots:d.lots});else await env.STATE.put('platform:paper-lots',JSON.stringify(d.lots));
   snapshots.delete(env);return privateJson({project:d.project,lots:d.lots,newEntriesOnly:true,ordersEnabled:false});
  }
  if(path==='/platform/control'&&request.method==='POST'){
   if(!sameOrigin(request))return privateJson({message:'Open controls from your own desk page.'},403);
   if(Number(request.headers.get('content-length'))>256)return privateJson({message:'Invalid control request.'},400);
   const input=await request.text();if(input.length>256)return privateJson({message:'Invalid control request.'},400);
   let d;try{d=JSON.parse(input)}catch{return privateJson({message:'Invalid control request.'},400);}
   if(!['chain','research'].includes(d.project)||!['pause','resume'].includes(d.action))return privateJson({message:'Only paper entry pause/resume is supported.'},400);
   if(d.project==='chain')await chainCommand(env,d.action);
   else await env.STATE.put('platform:research-paused',JSON.stringify(d.action==='pause'));
   snapshots.delete(env);return privateJson({project:d.project,paused:d.action==='pause',existingPositionsRemainMonitored:true,ordersEnabled:false});
  }
  return privateJson({message:'Page not found.'},404);
 }catch(error){
  console.warn('platform-request-unavailable:'+(/^DESK_[A-Z_]+$/.test(error?.message||'')?error.message:'DATA_UNAVAILABLE'));
  return privateJson({code:/^DESK_[A-Z_]+$/.test(error?.message||'')?error.message:'DESK_DATA_UNAVAILABLE',message:path==='/platform/chart'?'Broker candles are unavailable for this chart. No sample data was substituted.':'The desk could not complete this request. Please retry.'},503);
 }
}
