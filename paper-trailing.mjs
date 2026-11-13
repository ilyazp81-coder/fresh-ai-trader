// Sampled paper trailing policy, not a broker order or guaranteed fill.
export function paperTrail({entry,initialStop,stop,peak,price,lastNoticeStop}){
 if(![entry,initialStop,stop,price].every(Number.isFinite)||entry<=0||initialStop<=0||initialStop>=entry||price<=stop)return null;
 const risk=entry-initialStop,highest=Math.max(Number.isFinite(peak)?peak:entry,price);
 if(highest-entry<risk)return {stop,peak:highest,active:false,notify:false};
 const next=Math.max(stop,entry,highest-risk);
 return {stop:Math.round(next*100)/100,peak:highest,active:true,notify:next>stop&&(stop<entry||!Number.isFinite(lastNoticeStop)||next-lastNoticeStop>=risk*.5)};
}
