"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm"),E=require("../src/engine.js");
const code=fs.readFileSync(path.join(__dirname,"../src/app.js"),"utf8");
function boot(initialRaw){
 const ids=["turn","cash","drawdown","projects","preview","advance","result","history","export","import","reset","saveFile"];
 const map=new Map(),elements={},listeners={};
 if(initialRaw!==undefined)map.set("fictional-finance:save:v1",initialRaw);
 class El{
  constructor(tag="div"){this.tag=tag;this.children=[];this.callbacks={};this._text="";this.value="";this.disabled=false;this.className="";this.files=[];
   this.classList={add:c=>{this.className+=" "+c;}};}
  set id(value){this._id=value;elements[value]=this;}
  get id(){return this._id;}
  set textContent(x){this._text=String(x);this.children=[];}
  get textContent(){return this._text+this.children.map(x=>x.textContent||"").join("");}
  append(...x){this.children.push(...x);}prepend(...x){this.children.unshift(...x);}
  replaceChildren(...x){this._text="";this.children=x;}remove(){}scrollIntoView(){}
  setAttribute(){}addEventListener(n,fn){this.callbacks[n]=fn;}
  click(){if(this.callbacks.click&&!this.disabled)this.callbacks.click({target:this});}
 }
 for(const id of ids)elements[id]=new El(id);
 const doc={getElementById:id=>elements[id]??null,createElement:tag=>new El(tag),
  addEventListener:(n,f)=>{listeners[n]=f},body:{append(){}}};
 const storage={getItem:key=>map.get(key)??null,setItem:(key,x)=>map.set(key,x)};
 let download=null;
 const ctx={FictionalFinance:E,document:doc,localStorage:storage,URL:{createObjectURL(blob){download=blob.parts.join("");return "blob:demo";},revokeObjectURL(){}},
  Blob:class{constructor(p){this.parts=p;}},setTimeout:()=>{},confirm:()=>true,alert:()=>{}};
 vm.runInNewContext(code,ctx);
 listeners.DOMContentLoaded();
 return {elements,map,download:()=>download,setAmounts(vals){
  for(const [i,p] of E.PROJECTS.entries())elements.projects.children[i].children.at(-1).children[0].value=String(vals[p.id]??0);
 },click:id=>elements[id].click()};
}
test("the game starts with three fictional choices, a risk preview and full cash",()=>{
 const h=boot();
 assert.equal(h.elements.projects.children.length,3);
 assert.match(h.elements.preview.textContent,/下振れ|手数料/);
 assert.equal(h.elements.cash.textContent,"100,000ポイント");
});
test("quarter advances from UI and updates the protected cash save",()=>{
 const h=boot(),before=JSON.parse(h.map.get("fictional-finance:save:v1"));
 h.setAmounts({stable:10000,growth:8000,bold:3000});
 h.click("advance");
 const next=JSON.parse(h.map.get("fictional-finance:save:v1"));
 assert.equal(before.turn,1);assert.equal(next.turn,2);
 assert.equal(next.history.length,1);
 assert.match(h.elements.result.textContent,/今回の損益/);
});
test("corrupt saves are not silently overwritten, and original raw data can be exported",()=>{
 const raw='{"bad":';const h=boot(raw);
 assert.equal(h.map.get("fictional-finance:save:v1"),raw);
 assert.equal(h.elements.advance.disabled,true);
 h.click("export");
 assert.equal(h.download(),raw);
 h.click("reset");
 assert.equal(JSON.parse(h.map.get("fictional-finance:save:v1")).turn,1);
});
test("risk comparison changes only when player advances, never during input",()=>{
 const h=boot(),key="fictional-finance:save:v1",before=h.map.get(key);
 h.setAmounts({stable:60000,growth:60000,bold:60000});
 // The preview itself is pure and does not touch storage.
 assert.throws(()=>E.preview(JSON.parse(before),{stable:60000,growth:60000,bold:60000}),/超え/);
 assert.equal(h.map.get(key),before);
});
