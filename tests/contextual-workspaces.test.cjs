"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs");
const html=fs.readFileSync("index.html","utf8"),styles=fs.readFileSync("liquid-context.css","utf8"),app=fs.readFileSync("src/liquid-app.js","utf8");
test("trading, borrowing and history are task-specific, not storefront graphics",()=>{
 assert.match(html,/liquid-context\.css/);
 for(const name of ["overview","portfolio","trade","bank","records"])
  assert.match(html,new RegExp('id="view-'+name+'"'));
 for(const name of ["portfolio","trade","bank","records"])
  assert.match(styles,new RegExp('#view-'+name+' \\.panel'));
 assert.match(app,/function switchView\(v\)/);
 assert.match(styles,/\.view\[hidden\]\{display:none!important\}/);
 assert.doesNotMatch(styles,/shop-context|ekiden-art-runner|scene-worker|http:\/\/|https:\/\//);
});
