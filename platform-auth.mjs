import {signCommand,readSigned} from './router.mjs';
const COOKIE='__Host-janggo_desk',MAX_AGE=30*86400;
const hex=n=>[...crypto.getRandomValues(new Uint8Array(n))].map(x=>x.toString(16).padStart(2,'0')).join('');
const hash=async s=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))].map(x=>x.toString(16).padStart(2,'0')).join('');
export const sameOrigin=r=>r.headers.get('origin')===new URL(r.url).origin;
export function deskCookie(request){const v=(request.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);return /^[a-f0-9]{64}$/.test(v||'')?v:null;}
export const privateJson=(body,status=200,headers={})=>Response.json(body,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff',...headers}});
export async function deskRpc(env,action,args={}){
 if(!env.PAPER_COORDINATOR||!env.TELEGRAM_BOT_TOKEN)throw Error('DESK_LOGIN_UNAVAILABLE');
 const body=JSON.stringify({command:'platform-session',action,...args,chatId:String(env.TELEGRAM_CHAT_ID),at:Date.now()});
 const stub=env.PAPER_COORDINATOR.get(env.PAPER_COORDINATOR.idFromName('janggo-platform-sessions-v1'));
 const r=await stub.fetch('https://desk.internal/internal/platform-session',{method:'POST',headers:{'content-type':'application/json','x-janggo-signature':await signCommand(env.TELEGRAM_BOT_TOKEN,body)},body});
 if(!r.ok)throw Error(r.status===429?'DESK_LOGIN_BUSY':r.status===403?'DESK_SESSION_AUTH_REJECTED':'DESK_SESSION_UNAVAILABLE');return r.json();
}
export async function deskSessionRequest(request,env,storage){
 const d=await readSigned(request,env);if(!d||d.command!=='platform-session')return privateJson({error:'FORBIDDEN'},403);
 const now=Date.now(),validHash=/^[a-f0-9]{64}$/.test(d.hash||''),validChallenge=/^[a-f0-9]{32}$/.test(d.challenge||'');
 if(d.action==='approve'){
  if(!validChallenge)return privateJson({approved:false});
  const key='desk:challenge:'+d.challenge,p=await storage.get(key);if(!p||p.expires<=now)return privateJson({approved:false});
  const s=await storage.get('desk:session:'+p.hash);if(!s||s.expires<=now)return privateJson({approved:false});
  await storage.put('desk:session:'+p.hash,{approved:true,expires:now+MAX_AGE*1000,sessionPolicy:'30_DAYS_FIXED'});await storage.delete(key);return privateJson({approved:true});
 }
 if(!validHash)return privateJson({approved:false});
 const key='desk:session:'+d.hash,s=await storage.get(key);
 if(d.action==='check'){const approved=s?.approved===true&&s.expires>now;if(approved&&!s.sessionPolicy){s.expires=s.expires-28800000+MAX_AGE*1000;s.sessionPolicy='30_DAYS_FIXED';await storage.put(key,s);}return privateJson({approved,expires:s?.expires>now?s.expires:null});}
 if(d.action==='logout'){await storage.delete(key);return privateJson({approved:false});}
 if(d.action!=='begin'||!validChallenge)return privateJson({error:'INVALID_ACTION'},400);
 const all=await storage.list({prefix:'desk:',limit:128});let pending=0;
 for(const [k,v]of all){if(v.expires<=now)await storage.delete(k);else if(k.startsWith('desk:challenge:'))pending++;}
 if(pending>=24)return privateJson({error:'LOGIN_BUSY'},429);
 const expires=now+300000;await storage.put({[key]:{approved:false,expires},['desk:challenge:'+d.challenge]:{hash:d.hash,expires}});return privateJson({approved:false,expires});
}
export async function approvedDesk(request,env){const cookie=deskCookie(request);return cookie?(await deskRpc(env,'check',{hash:await hash(cookie)})).approved===true:false;}
export async function deskSessionStatus(request,env){const cookie=deskCookie(request);if(!cookie)return privateJson({approved:false});const state=await deskRpc(env,'check',{hash:await hash(cookie)}),remaining=Math.max(0,Math.min(MAX_AGE,Math.floor((state.expires-Date.now())/1000)));return privateJson({...state,sessionDays:30},200,state.approved?{'set-cookie':COOKIE+'='+cookie+'; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age='+remaining}:{});}
let botName=null;
export async function beginDesk(request,env){
 if(!sameOrigin(request))return privateJson({error:'ORIGIN_REJECTED'},403);
 if(!botName){const r=await fetch('https://api.telegram.org/bot'+env.TELEGRAM_BOT_TOKEN+'/getMe',{signal:AbortSignal.timeout(8000)});const b=await r.json();if(!r.ok||!b.ok||!/^\w{5,64}$/.test(b.result?.username||''))throw Error('DESK_BOT_UNAVAILABLE');botName=b.result.username;}
 const sid=hex(32),challenge=hex(16),state=await deskRpc(env,'begin',{hash:await hash(sid),challenge});
 return privateJson({approved:false,expires:state.expires,loginUrl:'https://t.me/'+botName+'?start=desk_'+challenge},200,{'set-cookie':COOKIE+'='+sid+'; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age='+MAX_AGE});
}
export async function logoutDesk(request,env){
 if(!sameOrigin(request))return privateJson({error:'ORIGIN_REJECTED'},403);
 const cookie=deskCookie(request);if(cookie)await deskRpc(env,'logout',{hash:await hash(cookie)});
 return privateJson({approved:false},200,{'set-cookie':COOKIE+'=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0'});
}
