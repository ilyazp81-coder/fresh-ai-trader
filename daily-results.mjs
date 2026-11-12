// Independent fresh-project results; never infer fills or outcomes from missing prices.
export function researchDailySummary(day,positions,claims={}){
 const rows=positions.filter(Boolean),closed=rows.filter(x=>x.status==='CLOSED'&&Number.isFinite(x.points)&&x.entryDelivery==='DELIVERED');
 const delivered=Object.entries(claims||{}).filter(([,x])=>x?.state==='SENT').map(([symbol])=>symbol);
 const tracked=new Set(rows.filter(x=>x.entryDelivery==='DELIVERED'||x.delivery==='DELIVERED').map(x=>x.symbol));
 return {project:'FRESH_RESEARCH',day,mode:'EXPERIMENTAL_SAMPLED_PAPER',ordersPlaced:false,deliveredDirectionalAlerts:delivered.length,wins:closed.filter(x=>x.points>0).length,losses:closed.filter(x=>x.points<0).length,flat:closed.filter(x=>x.points===0).length,open:rows.filter(x=>x.status==='OPEN').length,untrackedDirectionalAlerts:delivered.filter(x=>!tracked.has(x)).length,uncertainPositions:rows.filter(x=>x.entryDelivery!=='DELIVERED'&&x.delivery!=='DELIVERED').length,chargesIncluded:false,performanceValidated:false};
}
export function researchDailyMessage(r){return 'JANGGO | Fresh research daily paper results\n'+r.day+'\nWins '+r.wins+' | Losses '+r.losses+' | Flat '+r.flat+'\nOpen/unresolved '+r.open+' | Untracked alerts '+r.untrackedDirectionalAlerts+' | Uncertain '+r.uncertainPositions+'\nConfirmed directional alerts '+r.deliveredDirectionalAlerts+'\nSampled paper observations only; no actual fills or orders. Fees/slippage excluded. Untracked/open/uncertain results excluded from wins and losses.';}
