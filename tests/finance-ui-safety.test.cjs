"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs");
const E=require("../src/liquid-portfolio.js"),src=fs.readFileSync("src/liquid-app.js","utf8");
function extract(start,end){const a=src.indexOf("function "+start+"("),b=src.indexOf("function "+end+"(",a);assert.ok(a>0&&b>a);return src.slice(a,b);}
test("failed import/reset commit preserves active ledger and pre-existing backup",()=>{
 const SAVE="liquid-portfolio:save:v2",BACKUP="liquid-portfolio:backup:v2";
 const old=JSON.stringify(E.initial(81)),backup="OLDER_RECOVERY";
 const disk=new Map([[SAVE,old],[BACKUP,backup]]);
 let reject=true;
 const localStorage={
  getItem:key=>disk.get(key)??null,
  setItem(key,val){if(reject&&key===SAVE)throw Error("test disk refusal");disk.set(key,val);},
  removeItem:key=>disk.delete(key)
 };
 const fn=new Function("localStorage","SAVE","BACKUP",extract("replaceWithBackup","storeState")+"return replaceWithBackup;")(localStorage,SAVE,BACKUP);
 assert.throws(()=>fn(E.initial(95)),/test disk refusal/);
 assert.equal(disk.get(SAVE),old);
 assert.equal(disk.get(BACKUP),backup);
 reject=false;fn(E.initial(95));
 assert.equal(disk.get(BACKUP),old);
 assert.equal(JSON.parse(disk.get(SAVE)).seed,95);
});
test("buy and sell buttons explain cash and holdings constraints before trading",()=>{
 const values={assetSelect:{value:"growth"},quantity:{value:"1"},buy:{disabled:false},sell:{disabled:false},quote:{textContent:""}};
 const $=id=>values[id];
 const mk=new Function("E","state","$","money","recovery",
  extract("positive","updateQuote")+extract("updateQuote","updateBank")+"return updateQuote;");
 let state=E.initial(),update=mk(E,state,$,n=>n+"pt",false);
 update();assert.equal(values.buy.disabled,false);assert.equal(values.sell.disabled,true);
 assert.match(values.quote.textContent,/売却不可/);
 values.quantity.value="10000";update();
 assert.equal(values.buy.disabled,true);assert.equal(values.sell.disabled,true);
 assert.match(values.quote.textContent,/購入不可/);
 values.quantity.value="1";
 state=E.apply(E.initial(),{op:"buy",asset:"growth",quantity:1});
 update=mk(E,state,$,n=>n+"pt",false);update();assert.equal(values.sell.disabled,false);
});
test("loan buttons prevent exceeding limits or repaying non-existent debt",()=>{
 const v={bankAmount:{value:"5000"},bankQuote:{textContent:""},borrow:{disabled:false},repay:{disabled:false}};
 const mk=new Function("E","state","$","money","recovery",
  extract("updateBank","records")+"return updateBank;");
 const u=mk(E,E.initial(),id=>v[id],n=>n+"pt",false);
 u();assert.equal(v.borrow.disabled,false);assert.equal(v.repay.disabled,true);
 v.bankAmount.value="50000";u();assert.equal(v.borrow.disabled,true);
 assert.match(v.bankQuote.textContent,/1〜30,000pt/);
});
