/* Offline fictional liquid-asset portfolio game. No market feeds or real money. */
(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;else root.LiquidPortfolio=api;})(typeof globalThis!=="undefined"?globalThis:this,function(){
"use strict";
const VERSION=2,MAX_DAYS=120,START=100000,LOAN_LIMIT=30000;
const ASSETS=Object.freeze([
 Object.freeze({id:"reserve",name:"流動性リザーブ",subtitle:"価格変動は小さめ",base:100,vol:.012,tint:"#7ccab4"}),
 Object.freeze({id:"index",name:"架空の市場バスケット",subtitle:"幅広い企業をまとめて保有",base:125,vol:.035,tint:"#b49af4"}),
 Object.freeze({id:"growth",name:"架空の成長企業群",subtitle:"上昇も下落も大きい",base:155,vol:.065,tint:"#f0bc75"}),
 Object.freeze({id:"global",name:"架空の世界事業",subtitle:"複数地域に分散",base:108,vol:.045,tint:"#77b1ef"})
]);
function integer(n,label,min,max){if(!Number.isSafeInteger(n)||n<min||n>max)throw Error(label+"は"+min+"〜"+max+"の整数にしてください。");return n;}
function hash(seed,day,asset){let x=(seed^Math.imul(day,0x9e3779b1)^Math.imul(asset+1,0x85ebca6b))>>>0;
 x^=x>>>16;x=Math.imul(x,0x7feb352d);x^=x>>>15;x=Math.imul(x,0x846ca68b);x^=x>>>16;return(x>>>0)/4294967296;}
function initial(seed=20261018){integer(seed,"乱数",1,2147483647);return{version:VERSION,seed,day:1,cash:START,debt:0,
 prices:ASSETS.map(x=>x.base),shares:ASSETS.map(()=>0),paidFees:0,paidInterest:0,events:[],trail:[START]};}
function equity(s){return s.cash+s.shares.reduce((v,q,i)=>v+q*s.prices[i],0)-s.debt;}
function value(s){return s.shares.reduce((v,q,i)=>v+q*s.prices[i],0);}
function fee(v){return Math.max(1,Math.round(v*.002));}
function execute(s,event){
 if(!event||typeof event!=="object"||Array.isArray(event))throw Error("注文が不正です。");
 if(s.events.length>=2000)throw Error("記録が上限に達しました。");
 const op=event.op;let cash=s.cash,debt=s.debt,shares=[...s.shares],prices=[...s.prices],day=s.day;
 let paidFees=s.paidFees,paidInterest=s.paidInterest,trail=[...s.trail];
 if(op==="buy"||op==="sell"){
  if(Object.keys(event).sort().join(",")!=="asset,op,quantity")throw Error("取引の形式が不正です。");
  const i=ASSETS.findIndex(a=>a.id===event.asset);if(i<0)throw Error("商品が不明です。");
  integer(event.quantity,"売買数量",1,10000);const gross=prices[i]*event.quantity,commission=fee(gross);
  if(op==="buy"){
   if(cash<gross+commission)throw Error("手数料を含む購入額に現金が足りません。");
   cash-=gross+commission;shares[i]+=event.quantity;
  }else{
   if(shares[i]<event.quantity)throw Error("保有口数を超えて売れません。");
   shares[i]-=event.quantity;cash+=gross-commission;
  }paidFees+=commission;
 }else if(op==="borrow"||op==="repay"){
  if(Object.keys(event).sort().join(",")!=="amount,op")throw Error("借入の形式が不正です。");
  integer(event.amount,"金額",1,30000);
  if(op==="borrow"){if(debt+event.amount>LOAN_LIMIT)throw Error("借入上限を超えます。");
    cash+=event.amount;debt+=event.amount;}
  else{if(event.amount>debt||event.amount>cash)throw Error("借入残高または現金が不足しています。");
    cash-=event.amount;debt-=event.amount;}
 }else if(op==="next"){
  if(Object.keys(event).sort().join(",")!=="op")throw Error("時間操作の形式が不正です。");
  if(day>=MAX_DAYS)throw Error("全120営業日を完走しました。");
  const interest=debt?Math.max(1,Math.round(debt*.0003)):0;
  if(cash<interest)throw Error("利息を支払う現金が必要です。保有資産を売却してください。");
  cash-=interest;paidInterest+=interest;day++;
  prices=prices.map((price,i)=>{
   const noise=(hash(s.seed,day,i)-.5)*2;
   const market=(hash(s.seed,day,91)-.5)*.022;
   return Math.max(10,Math.round(price*(1+market+noise*ASSETS[i].vol)));
  });
 }else throw Error("未知の操作です。");
 const next={version:VERSION,seed:s.seed,day,cash,debt,prices,shares,paidFees,paidInterest,events:s.events.concat([event]),trail};
 if(op==="next")next.trail=trail.concat([equity(next)]);
 return next;
}
function validate(raw){
 if(!raw||raw.version!==VERSION||!Array.isArray(raw.events)||raw.events.length>2000)throw Error("セーブ形式が不正です。");
 const seed=integer(raw.seed,"乱数",1,2147483647);let current=initial(seed);
 for(const event of raw.events)current=execute(current,event);
 if(JSON.stringify(current)!==JSON.stringify(raw))throw Error("取引履歴と資産の残高が一致しません。元データを保護します。");
 return current;
}
function apply(raw,event){return execute(validate(raw),event);}
return Object.freeze({VERSION,MAX_DAYS,START,ASSETS,LOAN_LIMIT,initial,validate,apply,equity,value,fee});
});