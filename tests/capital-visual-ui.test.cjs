const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs");
const html=fs.readFileSync("index.html","utf8"),app=fs.readFileSync("src/app.js","utf8");
test("capital allocation is accessible, reactive and engine-backed",()=>{
 assert.match(html,/id="allocationBars"/);assert.match(html,/id="allocationLegend"/);
 assert.match(app,/function allocationBoard\(\)/);assert.match(app,/estimate=E\.preview\(state,values\)/);
 assert.match(app,/allocationBoard\(\);/);
 assert.match(app,/const denominator=Math\.max\(1,state\.cash\)/);
 assert.match(app,/bars\.setAttribute\("aria-label"/);
});
