/* Purely local accessible UI for the liquid portfolio game. */
(function(){"use strict";
const E=window.LiquidPortfolio,$=id=>document.getElementById(id),SAVE="liquid-portfolio:save:v2",BACKUP="liquid-portfolio:backup:v2";
let state,recovery=false,unreadable=null,notice="",view="overview";
const money=v=>Math.round(v).toLocaleString("ja-JP")+" pt";
function node(tag,text,cls){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;}
function store(){if(recovery)return false;try{localStorage.setItem(SAVE,JSON.stringify(state));return true;}catch(e){notice="保存できませんでした。バックアップを作成してください。";return false;}}
function load(){let raw=null;try{raw=localStorage.getItem(SAVE);return raw?E.validate(JSON.parse(raw)):E.initial();}
 catch(e){recovery=true;unreadable=raw;notice="セーブに不整合があります。原本は上書きせず保護しています。";return E.initial();}}
function action(event){if(recovery){notice="セーブ復旧中は操作できません。";render();return;}
 try{const next=E.apply(state,event);if(!storeState(next))throw Error("保存に失敗しました。");
 state=next;notice=event.op==="next"?"新しい営業日になりました。資産価格と利息を確認してください。":
 event.op==="buy"?"購入が成立しました。":event.op==="sell"?"売却が成立しました。":
 event.op==="borrow"?"架空資金を借り入れました。":"借入を返済しました。";
 render();
 }catch(e){notice=e.message;render();}}
function replaceWithBackup(next){
 const before=localStorage.getItem(SAVE),oldBackup=localStorage.getItem(BACKUP);
 let backupWritten=false;
 try{
  if(before!==null){localStorage.setItem(BACKUP,before);backupWritten=true;}
  // The original active save stays intact until this final write succeeds.
  localStorage.setItem(SAVE,JSON.stringify(next));
 }catch(error){
  if(backupWritten)try{
   if(oldBackup===null)localStorage.removeItem(BACKUP);
   else localStorage.setItem(BACKUP,oldBackup);
  }catch(_rollbackError){}
  throw error;
 }
}
function storeState(next){try{localStorage.setItem(SAVE,JSON.stringify(next));return true;}
 catch(e){notice="保存に失敗したため、この操作は確定しませんでした。";return false;}}
const VIEWS=["overview","portfolio","trade","bank","records"];
function switchView(v,{focus=false}={}){
 if(!VIEWS.includes(v))return false;
 view=v;
 for(const name of VIEWS)$("view-"+name).hidden=v!==name;
 document.querySelectorAll("#sidebarNav [data-view]").forEach(b=>{
  const active=b.dataset.view===v;
  b.classList.toggle("selected",active);
  b.setAttribute("aria-selected",String(active));
  b.tabIndex=active?0:-1;
  if(active&&focus)b.focus();
 });

 const titles={overview:"資産ダッシュボード",portfolio:"ポートフォリオ",trade:"資産の売買",bank:"借入・返済",records:"取引履歴・セーブ"};$("viewTitle").textContent=titles[v];return true;}
function stats(){
 $("day").textContent=state.day+" / "+E.MAX_DAYS+" 営業日";
 $("equity").textContent=money(E.equity(state));$("cash").textContent=money(state.cash);
 $("holdings").textContent=money(E.value(state));$("debt").textContent=money(state.debt);
 const gain=E.equity(state)-E.START;$("gain").textContent=(gain>=0?"+":"")+money(gain)+" （開始から）";
 const tip=state.day>=E.MAX_DAYS?
  "120営業日を完走しました。純資産と取引履歴を振り返り、別の資産配分にも挑戦できます。":
  state.cash<Math.max(1,Math.round(state.debt*.0003))&&state.debt>0?
  "次の日の利息を払う現金が不足しています。保有資産の売却を検討してください。":
  state.shares.every(q=>q===0)?
  "まず「資産の売買」で架空資産の価格と購入費用を比較してみましょう。":
  state.debt>0?
  "借入残高と利息を確認し、売買と返済のバランスを考えましょう。":
  "資産の値動き・保有比率を確認し、次の営業日に進むか売買するか決めましょう。";
 $("message").textContent=notice||tip;
 $("nextDay").disabled=recovery||state.day>=E.MAX_DAYS;
 $("buy").disabled=recovery;$("sell").disabled=recovery;$("borrow").disabled=recovery;$("repay").disabled=recovery;
}
function chart(){
 const trail=state.trail;let lo=Math.min(...trail),hi=Math.max(...trail);if(lo===hi){lo-=100;hi+=100;}
 const span=Math.max(1,hi-lo),n=Math.max(2,trail.length);
 const points=trail.map((v,i)=>[24+i*592/(n-1),192-(v-lo)/span*157]);
 const d=points.map((p,i)=>(i?"L":"M")+p.map(Math.round).join(" ")).join(" ");
 $("equityLine").setAttribute("d",d||"M 24 110");
 $("equityChart").setAttribute("aria-label","開始時"+money(trail[0])+"、最新"+money(trail.at(-1))+"の純資産の推移");
}
function allocation(){
 const values=E.ASSETS.map((a,i)=>({name:a.name,value:state.shares[i]*state.prices[i],color:a.tint})).filter(x=>x.value>0);
 values.unshift({name:"現金",value:state.cash,color:"#536b98"});
 const total=Math.max(1,values.reduce((s,x)=>s+x.value,0));
 let cumulative=0;const stops=[];
 for(const v of values){const next=cumulative+v.value/total*100;stops.push(v.color+" "+cumulative.toFixed(3)+"% "+next.toFixed(3)+"%");cumulative=next;}
 const donut=$("donut");donut.style.background="conic-gradient("+stops.join(",")+")";
 donut.setAttribute("aria-label",values.map(v=>v.name+" "+Math.round(v.value/total*100)+"%").join("、"));
 $("donutEquity").textContent=money(E.equity(state));
 const legend=$("legend");legend.replaceChildren();
 for(const v of values){const label=node("span"),dot=node("i");dot.style.background=v.color;
 label.append(dot,document.createTextNode(v.name+" "+Math.round(v.value/total*100)+"%"));legend.append(label);}
}
function holdings(){
 for(const id of ["holdingsTable","portfolioTable"]){
 const root=$(id);root.replaceChildren();
 E.ASSETS.forEach((a,i)=>{
 const r=node("div",undefined,"asset-row"),title=node("div",undefined,"ticker");
 title.style.setProperty("--asset",a.tint);title.append(node("strong",a.name),node("small",a.subtitle));
 const shares=node("b",state.shares[i]+"口"),value=node("b",money(state.shares[i]*state.prices[i]));
 const quote=node("small","価格 "+money(state.prices[i]),"last");
 r.append(title,shares,value,quote);root.append(r);
 });}}
function prices(){const input=$("assetSelect");const value=input.value||E.ASSETS[0].id;
 input.replaceChildren();E.ASSETS.forEach(a=>{const opt=node("option",a.name);opt.value=a.id;input.append(opt);});input.value=E.ASSETS.some(a=>a.id===value)?value:E.ASSETS[0].id;
 updateQuote();}
function positive(id){const v=Number($(id).value);if(!Number.isSafeInteger(v)||v<=0)throw Error("金額・口数は1以上の整数で入力してください。");return v;}
function updateQuote(){
 try{const i=E.ASSETS.findIndex(a=>a.id===$("assetSelect").value),quantity=positive("quantity");if(i<0||quantity>10000)throw Error("口数を確認してください。");
 const gross=state.prices[i]*quantity,fee=E.fee(gross);
 const canBuy=!recovery&&state.cash>=gross+fee;
 const canSell=!recovery&&state.shares[i]>=quantity;
 $("buy").disabled=!canBuy;$("sell").disabled=!canSell;
 $("quote").textContent=E.ASSETS[i].name+" ｜ 参考価格 "+money(state.prices[i])+
 " × "+quantity+"口 ｜ 手数料 "+money(fee)+" ｜ 購入時 "+money(gross+fee)+
 " / 売却時受取 "+money(gross-fee)+" ｜ 保有 "+state.shares[i]+"口"+
 (canBuy?"":" ｜ 購入不可：手数料込みの現金が不足しています。")+
 (canSell?"":" ｜ 売却不可：指定口数を保有していません。");
 }catch(e){$("quote").textContent=e.message;$("buy").disabled=true;$("sell").disabled=true;}
}
function updateBank(){let v=Number($("bankAmount").value);
 const valid=Number.isSafeInteger(v)&&v>0&&v<=30000;
 $("borrow").disabled=recovery||!valid||state.debt+v>E.LOAN_LIMIT;
 $("repay").disabled=recovery||!valid||v>state.debt||v>state.cash;
 $("bankQuote").textContent="借入残高 "+
 money(state.debt)+" / 上限 "+money(E.LOAN_LIMIT)+" ｜ 現金 "+money(state.cash)+
 " ｜ 翌日の概算利息 "+money(state.debt?Math.max(1,Math.round(state.debt*.0003)):0)+
 (Number.isSafeInteger(v)&&v>0?" ｜ 指定額 "+money(v):"")+
 (!valid?" ｜ 1〜30,000ptの整数で入力してください。":
 $("borrow").disabled&&$("repay").disabled?" ｜ この金額では借入・返済できません。":"");}
function records(){const root=$("history");root.replaceChildren();
 if(!state.events.length)root.append(node("p","まだ取引はありません。","sub"));
 for(const e of state.events.slice(-40).reverse()){
 const text=e.op==="next"?"市場を1日進める":e.op==="buy"?"購入 "+e.asset+" "+e.quantity+"口":e.op==="sell"?"売却 "+e.asset+" "+e.quantity+"口":
 e.op==="borrow"?"借入 "+money(e.amount):"返済 "+money(e.amount);
 root.append(node("div",text,"history-row"));
 }}
function render(){stats();chart();allocation();holdings();prices();updateBank();records();}
function download(name,content){const url=URL.createObjectURL(new Blob([content],{type:"application/json"})),a=node("a");
 a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
async function importFile(file){if(!file)return;try{
 if(file.size>400000)throw Error("セーブの容量が大きすぎます。");
 const data=JSON.parse(await file.text());if(data.schema!==E.VERSION)throw Error("新しい流動資産版のセーブのみ読み込めます。");
 const next=E.validate(data.state);if(!confirm("現在の保存内容をバックアップし、読み込みますか？"))return;
 replaceWithBackup(next);
 state=next;recovery=false;unreadable=null;notice="セーブを復元しました。";render();
 }catch(e){notice=e.message;render();}}
function init(){state=load();if(!recovery)store();render();
 document.querySelectorAll("[data-view]").forEach(b=>b.addEventListener("click",()=>switchView(b.dataset.view)));
 document.querySelectorAll("[data-go]").forEach(b=>b.addEventListener("click",()=>switchView(b.dataset.go)));
 $("sidebarNav").addEventListener("keydown",event=>{
  if(!["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Home","End"].includes(event.key))return;
  event.preventDefault();
  const current=VIEWS.indexOf(view);
  const next=event.key==="Home"?0:event.key==="End"?VIEWS.length-1:
   (current+(event.key==="ArrowLeft"||event.key==="ArrowUp"?-1:1)+VIEWS.length)%VIEWS.length;
  switchView(VIEWS[next],{focus:true});
 });
 switchView(view);

 $("assetSelect").addEventListener("change",updateQuote);$("quantity").addEventListener("input",updateQuote);
 $("bankAmount").addEventListener("input",updateBank);
 $("buy").addEventListener("click",()=>{try{action({op:"buy",asset:$("assetSelect").value,quantity:positive("quantity")});}catch(e){notice=e.message;render();}});
 $("sell").addEventListener("click",()=>{try{action({op:"sell",asset:$("assetSelect").value,quantity:positive("quantity")});}catch(e){notice=e.message;render();}});
 $("borrow").addEventListener("click",()=>{try{action({op:"borrow",amount:positive("bankAmount")});}catch(e){notice=e.message;render();}});
 $("repay").addEventListener("click",()=>{try{action({op:"repay",amount:positive("bankAmount")});}catch(e){notice=e.message;render();}});
 $("nextDay").addEventListener("click",()=>action({op:"next"}));
 $("export").addEventListener("click",()=>download(recovery?"liquid-original-unreadable.json":"liquid-day-"+state.day+".json",
 recovery&&unreadable!==null?unreadable:JSON.stringify({schema:E.VERSION,state},null,2)));
 $("import").addEventListener("click",()=>$("importFile").click());
 $("importFile").addEventListener("change",e=>{const f=e.target.files[0];e.target.value="";void importFile(f);});
 $("reset").addEventListener("click",()=>{if(!confirm("現在のセーブをバックアップして新しい運用を始めますか？"))return;
 try{
 const next=E.initial();replaceWithBackup(next);
 state=next;recovery=false;unreadable=null;notice="新しい運用を始めました。";render();switchView("overview");}
 catch(e){notice="バックアップまたは新規保存に失敗しました。既存セーブを保護します。";render();}});
}
document.addEventListener("DOMContentLoaded",init);
})();