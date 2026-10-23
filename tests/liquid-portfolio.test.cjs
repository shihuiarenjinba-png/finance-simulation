"use strict";const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),E=require("../src/liquid-portfolio.js");
test("liquid buy and sell settle instantly with realistic fees",()=>{
 let s=E.initial(7),before=E.equity(s);
 s=E.apply(s,{op:"buy",asset:"index",quantity:10});
 assert.equal(s.shares[1],10);assert.equal(s.cash,E.START-1250-E.fee(1250));
 assert.equal(E.equity(s),before-E.fee(1250));
 s=E.apply(s,{op:"sell",asset:"index",quantity:4});
 assert.equal(s.shares[1],6);assert.equal(s.cash,E.START-1250-E.fee(1250)+500-E.fee(500));
 assert.deepEqual(E.validate(JSON.parse(JSON.stringify(s))),s);
});
test("cannot oversell, overborrow or create cash without matching liability",()=>{
 let s=E.initial(123);
 assert.throws(()=>E.apply(s,{op:"sell",asset:"global",quantity:1}),/保有/);
 assert.throws(()=>E.apply(s,{op:"buy",asset:"growth",quantity:1000}),/現金/);
 assert.throws(()=>E.apply(s,{op:"borrow",amount:30001}),/上限|整数/);
 s=E.apply(s,{op:"borrow",amount:10000});
 assert.equal(s.cash,110000);assert.equal(s.debt,10000);assert.equal(E.equity(s),100000);
 s=E.apply(s,{op:"repay",amount:3000});
 assert.equal(s.debt,7000);assert.equal(E.equity(s),100000);
 assert.throws(()=>E.apply(s,{op:"repay",amount:8000}),/残高/);
});
test("daily prices are deterministic, interest paid, all 120 trading days playable",()=>{
 let a=E.apply(E.initial(88),{op:"borrow",amount:5000}),b=E.apply(E.initial(88),{op:"borrow",amount:5000});
 a=E.apply(a,{op:"buy",asset:"growth",quantity:40});b=E.apply(b,{op:"buy",asset:"growth",quantity:40});
 while(a.day<120){a=E.apply(a,{op:"next"});b=E.apply(b,{op:"next"});}
 assert.deepEqual(a,b);assert.equal(a.trail.length,120);assert.ok(a.paidInterest>0);
 assert.throws(()=>E.apply(a,{op:"next"}),/完走/);
});
test("corrupted derived accounting never overwrites base and v1 state rejected",()=>{
 const a=E.apply(E.initial(71),{op:"buy",asset:"reserve",quantity:7});
 assert.throws(()=>E.validate({...a,cash:a.cash+1}),/一致/);
 assert.throws(()=>E.validate({...a,shares:[123,0,0,0]}),/一致/);
 assert.throws(()=>E.validate({version:1,events:[]}),/セーブ形式/);
});
test("default game is an actual trade UI, legacy game and saves are retained",()=>{
 const html=fs.readFileSync("index.html","utf8"),code=fs.readFileSync("src/liquid-app.js","utf8");
 for(const id of ["equityChart","holdingsTable","buy","sell","borrow","repay","nextDay","export","import"])assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(html,/legacy\.html/);assert.match(fs.readFileSync("legacy.html","utf8"),/src\/engine\.js/);
 assert.match(code,/liquid-portfolio:save:v2/);assert.match(code,/function preserveBackup\(raw\)/);assert.match(code,/localStorage\.setItem\(key,raw\)/);
 assert.match(html,/connect-src 'none'/);
});