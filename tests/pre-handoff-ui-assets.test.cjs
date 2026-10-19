"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const root=path.resolve(__dirname,"..");
const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
const required=["liquid.css","liquid-context.css","src/liquid-portfolio.js","src/liquid-app.js"];
function localAssets(){
 const paths=[];
 const tags=html.match(/<(?:script|link)\b[^>]*>/gi)||[];
 for(const tag of tags){
   if(!/^<script/i.test(tag)&&!/(?:rel=["']stylesheet["']|href=["'][^"']+\.css["'])/i.test(tag))continue;
   const m=tag.match(/(?:src|href)=["']([^"']+)["']/i);
   if(m)paths.push(m[1]);
 }
 return paths;
}
test("all executable and stylesheet references are local and included",()=>{
 const paths=localAssets();
 assert.ok(paths.length>=4,"index.html requires a real executable and CSS surface");
 for(const ref of paths){
   assert.ok(!/^(?:https?:)?\/\//i.test(ref),"Remote CDN/paid-hosting asset not allowed: "+ref);
   assert.ok(!ref.includes(".."),"Path traversal not allowed: "+ref);
   const p=path.join(root,ref.split(/[?#]/)[0]);
   assert.ok(fs.existsSync(p),"UI entrypoint references a missing file: "+ref);
   assert.ok(fs.statSync(p).size>0,"Empty UI asset: "+ref);
   if(p.endsWith(".js"))assert.doesNotThrow(()=>new vm.Script(fs.readFileSync(p,"utf8"),{filename:p}),"JavaScript syntax problem: "+ref);
 }
 for(const wanted of required){
   assert.ok(paths.some(ref=>ref.replace(/^\.\//,"")===wanted),"Required screen/controller missing from entrypoint: "+wanted);
 }
});
test("no online fonts or style imports in the bundled UI",()=>{
 const styles=localAssets().filter(p=>p.endsWith(".css"));
 for(const rel of styles){
   const css=fs.readFileSync(path.join(root,rel),"utf8");
   assert.doesNotMatch(css,/@import\s+(?:url\()?\s*["']?https?:/i,"External CSS import: "+rel);
   assert.doesNotMatch(css,/url\(\s*["']?https?:/i,"External graphic/font URL: "+rel);
 }
});
test("the exact repo provides a Node test command and is not a Store certification claim",()=>{
 const pkg=JSON.parse(fs.readFileSync(path.join(root,"package.json"),"utf8"));
 assert.match(pkg.scripts?.test||"",/node --test/);
 assert.equal(pkg.private,true);
});
