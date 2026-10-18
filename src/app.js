/* Finance game UI — off-line and fail-closed save. */
(function(){"use strict";
const E=globalThis.FictionalFinance,$=id=>document.getElementById(id),KEY="fictional-finance:save:v1";
let state,recovery=false,unreadable=null,report=null,notice="";
const money=n=>Math.round(n).toLocaleString("ja-JP")+"ポイント";
const el=(tag,t,cls)=>{const x=document.createElement(tag);if(t!==undefined)x.textContent=t;if(cls)x.className=cls;return x;};
function load(){let raw=null;try{raw=localStorage.getItem(KEY);return raw?E.validate(JSON.parse(raw)):E.initial();}
catch(e){recovery=true;unreadable=raw;notice="保存データの読み込みに失敗しました。元のデータを保護しています。";return E.initial();}}
function save(){if(recovery)return false;try{localStorage.setItem(KEY,JSON.stringify(state));return true;}catch(e){notice="自動保存に失敗しました。ファイルへの書き出しを利用してください。";return false;}}
function allocations(){return Object.fromEntries(E.PROJECTS.map(p=>{const s=$(p.id+"Amount").value.trim();if(!/^\d+$/.test(s))throw Error("配分額を0以上の整数で入力してください。");return [p.id,Number(s)];}));}
function inputs(){const root=$("projects");root.replaceChildren();
 for(const p of E.PROJECTS){
 const card=el("div",undefined,"project"),label=el("label","配分する金額（架空ポイント）");
 card.append(el("h3",p.name),el("p",p.description));
 card.append(el("div","上振れ +"+p.up+"% / 下振れ "+p.down+"%（ゲーム上の設定）","risk"));
 const inp=el("input");inp.id=p.id+"Amount";inp.type="number";inp.min="0";inp.step="1000";
 inp.value="0";inp.setAttribute("aria-label",p.name+"に配分する額");inp.addEventListener("input",preflight);
 label.append(inp);card.append(label);root.append(card);
 }
}
function stats(){
 $("turn").textContent=state.complete?"24 / 24":state.turn+" / "+E.MAX_TURNS;
 $("cash").textContent=money(state.cash);$("drawdown").textContent=(state.maxDrawdownBps/100).toFixed(2)+"%";
}
function preflight(){
 const root=$("preview");root.className="preview";root.replaceChildren();
 if(recovery){root.classList.add("error");root.append(el("strong","元のセーブを保持しています。"),el("p","詳細から元データを書き出すか、正常なセーブを読み込んでください。"));$("advance").disabled=true;return;}
 if(state.complete){root.append(el("p","24四半期の経営を完走しました。記録の書き出しや再挑戦ができます。"));$("advance").disabled=true;return;}
 try{
 const p=E.preview(state,allocations());
 root.append(el("p","投じる資金："+money(p.invested)+" ｜ 手数料："+money(p.fees)+" ｜ 残す現金："+money(p.buffer)));
 root.append(el("p","全案件が下振れした場合："+money(p.worstCase)+" ｜ 全案件が上振れした場合：+"+money(p.bestCase)));
 root.append(el("p","現金比率："+p.bufferPercent+"%。これは可能な結果の範囲であり、利益の保証ではありません。"));
 $("advance").disabled=false;
 }catch(e){root.classList.add("error");root.append(el("p",e.message));$("advance").disabled=true;}
}
function results(){
 const root=$("result");root.replaceChildren();
 if(!report){root.append(el("p","資金配分を選び、最初の四半期を進めましょう。"));return;}
 const grid=el("div",undefined,"metric-grid");
 for(const [name,value] of [["景気",report.phase],["今回の損益",money(report.profit)],["期末資金",money(report.cash)]]){const card=el("div",undefined,"metric");card.append(el("small",name),el("strong",value));grid.append(card);}
 root.append(grid,el("p",report.message));
 for(const d of report.details){if(d.amount)root.append(el("p",d.name+" ｜ 配分 "+money(d.amount)+" ｜ "+d.returnPercent+"% ｜ 結果 "+money(d.profit)));}
}
function history(){
 const root=$("history");root.replaceChildren();
 for(const h of state.history.slice(-12).reverse())root.append(el("div",h.turn+"四半期 ｜ 損益 "+money(h.profit)+" ｜ 現金 "+money(h.cash)+" ｜ 景気 "+h.phase,"record"));
}
function render(){stats();inputs();results();history();preflight();}
function run(){
 if(recovery||state.complete)return;
 try{const result=E.advance(state,allocations());state=result.state;report=result.report;save();render();$("result").scrollIntoView({behavior:"smooth",block:"nearest"});}
 catch(e){notice=e.message;preflight();$("preview").prepend(el("p",notice));}
}
function download(filename,data){const url=URL.createObjectURL(new Blob([data],{type:"application/json"})),a=el("a");a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
async function importSave(file){
 if(!file)return;
 try{if(file.size>500000)throw Error("ファイルの容量が上限を超えています。");const v=JSON.parse(await file.text());
 if(v.schema!==E.VERSION)throw Error("未対応のセーブバージョンです。");const next=E.validate(v.state);
 if(!confirm("現在のセーブを置き換えますか？"))return;state=next;recovery=false;unreadable=null;report=null;save();render();
 }catch(e){alert("セーブ読込エラー："+e.message);}
}
function init(){
 state=load();if(!recovery)save();render();
 $("advance").addEventListener("click",run);
 $("export").addEventListener("click",()=>{if(recovery&&unreadable===null){alert("元データを読み取れません。");return;}
 download(recovery?"finance-unreadable-original.json":"finance-quarter-"+state.turn+".json",recovery?unreadable:JSON.stringify({schema:E.VERSION,state},null,2));});
 $("import").addEventListener("click",()=>$("saveFile").click());
 $("saveFile").addEventListener("change",e=>{const f=e.target.files[0];e.target.value="";void importSave(f);});
 $("reset").addEventListener("click",()=>{if(!confirm(recovery?"元データを上書きして新規開始します。先に退避しましたか？":"今までの進行を消して新しく始めますか？"))return;
 recovery=false;unreadable=null;state=E.initial();report=null;save();render();});
}
document.addEventListener("DOMContentLoaded",init);
})();