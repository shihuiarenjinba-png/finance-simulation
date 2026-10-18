/* Fictional Finance Simulation — no real stock data, banking, or external APIs. */
(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;else root.FictionalFinance=api;})(typeof globalThis!=="undefined"?globalThis:this,function(){
"use strict";
const VERSION=1,MAX_TURNS=24,INITIAL_CASH=100000;
const PROJECTS=Object.freeze([
 {id:"stable",name:"まちの生活インフラ",description:"利益は控えめだが変動が小さい",up:8,down:-5,likelihood:0.76},
 {id:"growth",name:"新しい製品工房",description:"成長の余地があるが、業績は波打つ",up:28,down:-20,likelihood:0.60},
 {id:"bold",name:"未知への開発投資",description:"成功時は大きいが、損失も大きい",up:70,down:-45,likelihood:0.40}
]);
const feeRateBps=50; // fictional transaction fee, 0.5% of invested principal
function integer(x,name,min,max){if(!Number.isSafeInteger(x)||x<min||x>max)throw Error(name+"は"+min+"～"+max+"の整数を指定してください。");return x;}
function hash(seed,turn,salt){let x=(seed^Math.imul(turn,0x9e3779b1)^Math.imul(salt+1,0x85ebca6b))>>>0;x^=x>>>16;x=Math.imul(x,0x7feb352d);x^=x>>>15;x=Math.imul(x,0x846ca68b);x^=x>>>16;return (x>>>0)/4294967296;}
function initial(seed=20261018){integer(seed,"seed",1,2147483647);return {version:VERSION,seed,turn:1,cash:INITIAL_CASH,peak:INITIAL_CASH,maxDrawdownBps:0,history:[],complete:false};}
function outcomes(seed,turn){
 const economy=hash(seed,turn,77),phase=economy<.28?"逆風":economy>.78?"追い風":"平常";
 return {phase,projects:PROJECTS.map((p,i)=>{
  const roll=hash(seed,turn,i+100);
  const probability=Math.max(.10,Math.min(.94,p.likelihood+(phase==="追い風"?.11:phase==="逆風"?-.14:0)));
  const good=roll<probability;
  return {id:p.id,up:good,returnBps:(good?p.up:p.down)*100};
 })};
}
function checkAllocations(raw,cash){
 if(!raw||typeof raw!=="object"||Array.isArray(raw))throw Error("資金配分がありません。");
 if(Object.keys(raw).some(id=>!PROJECTS.some(p=>p.id===id)))throw Error("不明な投資先です。");
 const values=PROJECTS.map(p=>integer(raw[p.id]??0,p.id,0,100000000));
 const invested=values.reduce((n,v)=>n+v,0);
 const fees=Math.ceil(invested*feeRateBps/10000);
 if(invested+fees>cash)throw Error("投資額と手数料が手元資金を超えています。");
 return {invested,fees,values};
}
function validate(raw){
 if(!raw||raw.version!==VERSION||!Array.isArray(raw.history))throw Error("セーブ形式が不正です。");
 const seed=integer(raw.seed,"seed",1,2147483647),turn=integer(raw.turn,"turn",1,MAX_TURNS+1);
 if(raw.history.length!==turn-1||raw.complete!==(turn>MAX_TURNS))throw Error("セーブの進行記録が不正です。");
 let cash=INITIAL_CASH,peak=INITIAL_CASH,maxDrawdownBps=0;
 const history=[];
 for(let i=0;i<raw.history.length;i++){
  const h=raw.history[i];if(!h||h.turn!==i+1)throw Error("履歴の順序が不正です。");
  const a=checkAllocations(h.allocations,cash);
  const performance=outcomes(seed,i+1),details=PROJECTS.map((p,j)=>{
   const amount=a.values[j],gain=Math.round(amount*performance.projects[j].returnBps/10000);
   return {id:p.id,amount,profit:gain,returnBps:performance.projects[j].returnBps};
  });
  const gains=details.reduce((sum,x)=>sum+x.profit,0);
  cash=cash+gains-a.fees;
  peak=Math.max(peak,cash);
  maxDrawdownBps=Math.max(maxDrawdownBps,Math.round((peak-cash)*10000/peak));
  if(h.cash!==cash||h.profit!==gains-a.fees||h.fees!==a.fees||h.invested!==a.invested||
   h.phase!==performance.phase||h.peak!==peak||h.maxDrawdownBps!==maxDrawdownBps)throw Error("帳簿の結果が一致しません。");
  history.push({turn:i+1,allocations:Object.fromEntries(PROJECTS.map((p,j)=>[p.id,a.values[j]])),
   invested:a.invested,fees:a.fees,profit:gains-a.fees,cash,phase:performance.phase,peak,maxDrawdownBps});
 }
 if(raw.cash!==cash||raw.peak!==peak||raw.maxDrawdownBps!==maxDrawdownBps)throw Error("資金の履歴が一致しません。");
 return {version:VERSION,seed,turn,cash,peak,maxDrawdownBps,history,complete:turn>MAX_TURNS};
}
function preview(raw,alloc){
 const s=validate(raw);if(s.complete)throw Error("24四半期を完走しました。");
 const a=checkAllocations(alloc,s.cash);
 const maxRisk=PROJECTS.reduce((sum,p,i)=>sum+a.values[i]*p.down/100,0)-a.fees;
 const maxUpside=PROJECTS.reduce((sum,p,i)=>sum+a.values[i]*p.up/100,0)-a.fees;
 return {turn:s.turn,cash:s.cash,phaseHint:"次の景気はまだ確定していません。",invested:a.invested,
  fees:a.fees,buffer:s.cash-a.invested-a.fees,worstCase:Math.round(maxRisk),bestCase:Math.round(maxUpside),
  bufferPercent:Math.round((s.cash-a.invested-a.fees)/s.cash*100)};
}
function advance(raw,alloc){
 const s=validate(raw);const prior=preview(s,alloc);const a=checkAllocations(alloc,s.cash),performance=outcomes(s.seed,s.turn);
 const detail=PROJECTS.map((p,i)=>{
  const amount=a.values[i],gain=Math.round(amount*performance.projects[i].returnBps/10000);
  return {name:p.name,id:p.id,amount,profit:gain,returnPercent:performance.projects[i].returnBps/100};
 });
 const gross=detail.reduce((sum,x)=>sum+x.profit,0),profit=gross-a.fees;
 const cash=s.cash+profit,peak=Math.max(s.peak,cash);
 const maxDrawdownBps=Math.max(s.maxDrawdownBps,Math.round((peak-cash)*10000/peak));
 const h={turn:s.turn,allocations:Object.fromEntries(PROJECTS.map((p,i)=>[p.id,a.values[i]])),
  invested:a.invested,fees:a.fees,profit,cash,phase:performance.phase,peak,maxDrawdownBps};
 const next={...s,cash,peak,maxDrawdownBps,turn:s.turn+1,
  complete:s.turn===MAX_TURNS,history:s.history.concat(h)};
 return {state:validate(next),report:{turn:s.turn,phase:performance.phase,invested:a.invested,fees:a.fees,
  cash,profit,buffer:prior.buffer,details:detail,drawdownPercent:maxDrawdownBps/100,
  message:profit>=0?"資産が増えました。ただし次の四半期の結果は未知です。":"今回は損失。守った現金があれば次の決断を続けられます。"}};
}
return Object.freeze({VERSION,MAX_TURNS,INITIAL_CASH,PROJECTS,feeRateBps,initial,validate,preview,advance,outcomes});
});