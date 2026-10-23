"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm"),E=require("../src/liquid-portfolio.js");
const script=fs.readFileSync("src/liquid-app.js","utf8");
function boot(initialRaw){
 const html=fs.readFileSync("index.html","utf8"),ids=[...html.matchAll(/id="([^"]+)"/g)].map(m=>m[1]);
 const nodes={},listeners={},storage=new Map();
 if(initialRaw!==undefined)storage.set("liquid-portfolio:save:v2",initialRaw);
 class Element{
  constructor(tag="div"){this.tag=tag;this.children=[];this.value="";this.listeners={};this.dataset={};this.hidden=false;
   this.style={background:"",setProperty(){}};
   this.classList={toggle(){}};
  }
  set textContent(v){this._text=String(v);this.children=[];}
  get textContent(){return (this._text||"")+this.children.map(c=>c.textContent||"").join("");}
  append(...args){this.children.push(...args);}replaceChildren(...args){this.children=args;this._text="";}
  addEventListener(type,callback){this.listeners[type]=callback;}
  setAttribute(name,value){this[name]=value;}
  click(){this.listeners.click?.({target:this});}
  remove(){}
 }
 ids.forEach(id=>nodes[id]=new Element(id));nodes.quantity.value="1";nodes.bankAmount.value="5000";
 const links=[...html.matchAll(/data-view="([^"]+)"/g)].map(m=>{const el=new Element("button");el.dataset.view=m[1];return el;});
 const go=[...html.matchAll(/data-go="([^"]+)"/g)].map(m=>{const el=new Element("button");el.dataset.go=m[1];return el;});
 const doc={getElementById:id=>nodes[id],createElement:t=>new Element(t),createTextNode:s=>({textContent:String(s)}),
  querySelectorAll:s=>s==="[data-view]"?links:s==="[data-go]"?go:[],
  body:{append(){}},addEventListener:(t,fn)=>listeners[t]=fn};
 const context={window:{LiquidPortfolio:E},document:doc,
 localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)},
 URL:{createObjectURL:()=>"blob:fake",revokeObjectURL(){}},Blob:class{constructor(x){this.parts=x}},
 confirm:()=>true,alert:()=>{},setTimeout:()=>{}};
 vm.runInNewContext(script,context);
 listeners.DOMContentLoaded();
 return {nodes,storage,click:id=>nodes[id].click(),read:()=>JSON.parse(storage.get("liquid-portfolio:save:v2"))};
}
test("new dashboard starts and trades without needing an external website",()=>{
 const h=boot();assert.equal(h.read().cash,100000);assert.match(h.nodes.equity.textContent,/100,000/);
 h.click("buy");assert.equal(h.read().shares[0],1);
 h.click("sell");assert.equal(h.read().shares[0],0);
 h.click("borrow");assert.equal(h.read().debt,5000);
 h.click("repay");assert.equal(h.read().debt,0);
 h.click("nextDay");assert.equal(h.read().day,2);
 assert.match(h.nodes.equityChart["aria-label"],/純資産の推移/);
});
test("reset preserves distinct saves in separate backup slots without overwriting the first one",()=>{
 const h=boot(),key="liquid-portfolio:save:v2",prefix="liquid-portfolio:backup:v2";
 h.click("buy");const first=h.storage.get(key);
 h.click("reset");
 assert.equal(h.storage.get(prefix),first);
 assert.equal(h.read().shares[0],0);
 h.click("borrow");const second=h.storage.get(key);
 h.click("reset");
 assert.equal(h.storage.get(prefix),first);
 assert.equal(h.storage.get(prefix+":2"),second);
 assert.notEqual(first,second);
 assert.equal(h.nodes.backupSlot.children.length,2);
 assert.equal(h.nodes.exportBackup.disabled,false);
 h.nodes.backupSlot.value=prefix;
 assert.doesNotThrow(()=>h.click("exportBackup"));
});
test("no saved backups are falsely offered on a new game",()=>{
 const h=boot();
 assert.equal(h.nodes.exportBackup.disabled,true);
 assert.equal(h.nodes.backupSlot.children.length,0);
});
test("corrupt save is not overwritten on game boot",()=>{
 const bad='{"broken":';
 const h=boot(bad);assert.equal(h.storage.get("liquid-portfolio:save:v2"),bad);
 h.click("buy");assert.equal(h.storage.get("liquid-portfolio:save:v2"),bad);
});
