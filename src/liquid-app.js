/* Purely local accessible UI for the liquid portfolio game. */
(function(){"use strict";
const E=window.LiquidPortfolio,$=id=>document.getElementById(id),SAVE="liquid-portfolio:save:v2",BACKUP="liquid-portfolio:backup:v2";
let state,recovery=false,unreadable=null,notice="",view="overview";
const money=v=>Math.round(v).toLocaleString("ja-JP")+" pt";
function node(tag,text,cls){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;}
function store(){if(recovery)return false;try{localStorage.setItem(SAVE,JSON.stringify(state));return true;}catch(e){notice="保存できませんでした。バックアップを作成してください。";return false;}}
function backupKeys(){
 const keys=[];
 for(let i=1;i<=100;i++){const key=i===1?BACKUP:BACKUP+":"+i;
  if(localStorage.getItem(key)===null)break;
  keys.push(key);
 }
 return keys;
}
function preserveBackup(raw){
 if(raw===null)return;
 for(let i=1;i<=100;i++){
  const key=i===1?BACKUP:BACKUP+":"+i,previous=localStorage.getItem(key);
  if(previous===raw)return;
  if(previous===null){localStorage.setItem(key,raw);return;}
 }
 throw Error("保存済みバックアップが上限です。バックアップを書き出してから作業してください。");
}
function backupList(){
 const select=$("backupSlot"),current=select.value,keys=backupKeys();
 select.replaceChildren();
 for(let i=0;i<keys.length;i++){const option=node("option","バックアップ "+(i+1));
  option.value=keys[i];select.append(option);}
 select.value=keys.includes(current)?current:(keys.at(-1)||"");
 $("exportBackup").disabled=keys.length===0;
}
function exportSavedBackup(){
 const key=$("backupSlot").value,raw=key?localStorage.getItem(key):null;
 if(raw===null)throw Error("書き出すバックアップがありません。");
 try{
  const valid=E.validate(JSON.parse(raw));
  download("liquid-saved-backup-"+key.split(":").at(-1)+".json",JSON.stringify({schema:E.VERSION,state:valid},null,2));
  notice="バックアップを書き出しました。";
 }catch(_error){
  download("liquid-unreadable-backup.txt",raw);
  notice="形式を確認できないバックアップを原文のまま書き出しました。";
 }
}
function load(){let raw=null;try{raw=localStorage.getItem(SAVE);return raw?E.validate(JSON.parse(raw)):E.initial();}
 catch(e){recovery=true;unreadable=raw;notice="セーブに不整合があります。原本は上書きせず保護しています。";return E.initial();}}
function action(event){if(recovery){notice="セーブ復旧中は操作できません。";render();return;}
 try{const next=E.apply(state,event);if(!storeState(next))throw Error("保存に失敗しました。");
 state=next;notice=event.op==="next"?"新しい営業日になりました。資産価格と利息を確認してください。":
 event.op==="buy"?"購入が成立しました。":event.op==="sell"?"売却が成立しました。":
 event.op==="borrow"?"架空資金を借り入れました。":"借入を返済しました。";
 render();
 }catch(e){notice=e.message;render();}}
function storeState(next){try{localStorage.setItem(SAVE,JSON.stringify(next));return true;}
 catch(e){notice="保存に失敗したため、この操作は確定しませんでした。";return false;}}
function switchView(v){view=v;for(const name of ["overview","portfolio","trade","bank","records"])$("view-"+name).hidden=v!==name;
 document.querySelectorAll("[data-view]").forEach(b=>b.classList.toggle("selected",b.dataset.view===v));
 const titles={overview:"資産ダッシュボード",portfolio:"ポートフォリオ",trade:"資産の売買",bank:"借入・返済",records:"取引履歴・セーブ"};$("viewTitle").textContent=titles[v];}
function stats(){
 $("day").textContent=state.day+" / "+E.MAX_DAYS+" 営業日";
 $("equity").textContent=money(E.equity(state));$("cash").textContent=money(state.cash);
 $("holdings").textContent=money(E.value(state));$("debt").textContent=money(state.debt);
 const gain=E.equity(state)-E.START;$("gain").textContent=(gain>=0?"+":"")+money(gain)+" （開始から）";
 $("message").textContent=notice||"架空の流動資産を買い、売り、ポートフォリオを調整できます。";
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
 $("quote").textContent=E.ASSETS[i].name+" ｜ 参考価格 "+money(state.prices[i])+
 " × "+quantity+"口 ｜ 手数料 "+money(fee)+" ｜ 購入時 "+money(gross+fee)+
 " / 売却時受取 "+money(gross-fee)+" ｜ 保有 "+state.shares[i]+"口";
 }catch(e){$("quote").textContent=e.message;}
}
function updateBank(){let v=Number($("bankAmount").value);$("bankQuote").textContent="借入残高 "+
 money(state.debt)+" / 上限 "+money(E.LOAN_LIMIT)+" ｜ 現金 "+money(state.cash)+
 " ｜ 翌日の概算利息 "+money(state.debt?Math.max(1,Math.round(state.debt*.0003)):0)+
 (Number.isSafeInteger(v)&&v>0?" ｜ 指定額 "+money(v):"");}
function records(){const root=$("history");root.replaceChildren();
 if(!state.events.length)root.append(node("p","まだ取引はありません。","sub"));
 for(const e of state.events.slice(-40).reverse()){
 const text=e.op==="next"?"市場を1日進める":e.op==="buy"?"購入 "+e.asset+" "+e.quantity+"口":e.op==="sell"?"売却 "+e.asset+" "+e.quantity+"口":
 e.op==="borrow"?"借入 "+money(e.amount):"返済 "+money(e.amount);
 root.append(node("div",text,"history-row"));
 }}
function render(){stats();chart();allocation();holdings();prices();updateBank();records();backupList();}
function download(name,content){const url=URL.createObjectURL(new Blob([content],{type:"application/json"})),a=node("a");
 a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
async function importFile(file){if(!file)return;try{
 if(file.size>400000)throw Error("セーブの容量が大きすぎます。");
 const data=JSON.parse(await file.text());if(data.schema!==E.VERSION)throw Error("新しい流動資産版のセーブのみ読み込めます。");
 const next=E.validate(data.state);if(!confirm("現在の保存内容をバックアップし、読み込みますか？"))return;
 const previous=localStorage.getItem(SAVE);preserveBackup(previous);
 localStorage.setItem(SAVE,JSON.stringify(next));state=next;recovery=false;unreadable=null;notice="セーブを復元しました。";render();
 }catch(e){notice=e.message;render();}}
function init(){state=load();if(!recovery)store();render();
 document.querySelectorAll("[data-view]").forEach(b=>b.addEventListener("click",()=>switchView(b.dataset.view)));
 document.querySelectorAll("[data-go]").forEach(b=>b.addEventListener("click",()=>switchView(b.dataset.go)));
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
 $("exportBackup").addEventListener("click",()=>{try{exportSavedBackup();render();}catch(e){notice=e.message;render();}});
 $("reset").addEventListener("click",()=>{if(!confirm("現在のセーブをバックアップして新しい運用を始めますか？"))return;
 try{const raw=localStorage.getItem(SAVE);preserveBackup(raw);
 const next=E.initial();localStorage.setItem(SAVE,JSON.stringify(next));state=next;recovery=false;unreadable=null;notice="新しい運用を始めました。";render();switchView("overview");}
 catch(e){notice="バックアップまたは新規保存に失敗しました。既存セーブを保護します。";render();}});
}
document.addEventListener("DOMContentLoaded",init);
})();