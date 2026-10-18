"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),E=require("../src/engine.js");
test("same seed and choices always yield identical outcomes",()=>{
 const s=E.initial(401),plan={stable:12000,growth:10000,bold:6000};
 assert.deepEqual(E.advance(s,plan),E.advance(E.initial(401),plan));
});
test("allocation and transaction fees cannot exceed cash",()=>{
 const s=E.initial(),all={stable:100000,growth:0,bold:0};
 assert.throws(()=>E.preview(s,all),/超え/);
 assert.throws(()=>E.advance(s,{stable:-1}),/整数/);
 assert.throws(()=>E.advance(s,{unknown:999}),/不明/);
});
test("each quarter cash and profit respect the fee and realized gains ledger",()=>{
 const s=E.initial(1),plan={stable:10000,growth:20000,bold:30000},out=E.advance(s,plan);
 const gross=out.report.details.reduce((sum,d)=>sum+d.profit,0);
 assert.equal(out.report.profit,gross-out.report.fees);
 assert.equal(out.state.cash,s.cash+out.report.profit);
 assert.equal(out.report.invested,60000);
 assert.equal(out.report.fees,300);
 assert.deepEqual(E.validate(out.state),out.state);
});
test("the game always preserves 24-quarter play with enough reserved liquidity",()=>{
 for(const seed of [1,2,3,88,20261018]){
  let state=E.initial(seed);
  for(let i=0;i<24;i++){
   const amount=Math.floor(state.cash*.18);
   const a=E.advance(state,{stable:amount,growth:amount,bold:amount});
   assert.ok(a.state.cash>=0);
   assert.ok(a.state.maxDrawdownBps>=state.maxDrawdownBps);
   assert.equal(a.state.history.length,i+1);
   state=a.state;
  }
  assert.equal(state.complete,true);
  assert.throws(()=>E.advance(state,{}),/完走/);
 }
});
test("holding all cash avoids changes and teaches opportunity cost",()=>{
 let state=E.initial(45);
 for(let i=0;i<24;i++)state=E.advance(state,{stable:0,growth:0,bold:0}).state;
 assert.equal(state.cash,E.INITIAL_CASH);
 assert.equal(state.maxDrawdownBps,0);
});
test("tampered results and drawdowns cannot be imported",()=>{
 const s=E.advance(E.initial(42),{stable:15000,growth:9000,bold:2000}).state;
 const broken=structuredClone(s);broken.history[0].profit+=1000;
 assert.throws(()=>E.validate(broken),/帳簿/);
 const fakeCash=structuredClone(s);fakeCash.cash+=50000;
 assert.throws(()=>E.validate(fakeCash),/資金/);
 const altered=structuredClone(s);altered.maxDrawdownBps=9000;
 assert.throws(()=>E.validate(altered),/資金/);
});
test("downside and upside preview remain mathematical bounds, not guaranteed returns",()=>{
 for(const seed of [1,2,123,20261018]){
  const s=E.initial(seed),plan={stable:10000,growth:20000,bold:10000};
  const p=E.preview(s,plan),out=E.advance(s,plan).report;
  assert.ok(p.worstCase<=out.profit);
  assert.ok(p.bestCase>=out.profit);
  assert.ok(p.buffer>=0);
 }
});
test("no live data, brokerage APIs, or crypto/personal financial information in engine",()=>{
 const fs=require("node:fs"),path=require("node:path");
 const src=fs.readFileSync(path.join(__dirname,"../src/engine.js"),"utf8");
 assert.doesNotMatch(src,/fetch\s*\(|XMLHttpRequest|https?:\/\//);
});
