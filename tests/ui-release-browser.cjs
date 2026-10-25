"use strict";
const {chromium}=require("playwright");
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),url=require("node:url");
const out=path.resolve("ui-release-review");fs.mkdirSync(out,{recursive:true});
const source=url.pathToFileURL(path.resolve("index.html")).href;
(async()=>{
 const browser=await chromium.launch({headless:true}),pageErrors=[],network=[];
 const attach=p=>{p.on("pageerror",e=>pageErrors.push(e.message));p.on("request",r=>{if(/^https?:/.test(r.url()))network.push(r.url());});p.on("dialog",d=>d.accept());};
 try{
  const context=await browser.newContext({viewport:{width:1280,height:720}}),p=await context.newPage();
  attach(p);await p.goto(source,{waitUntil:"load"});
  const shot=name=>p.screenshot({path:path.join(out,name),fullPage:true});
  const tab=id=>p.locator('#sidebarNav [data-view="'+id+'"]');
  assert.equal(await tab("overview").getAttribute("aria-selected"),"true");
  assert.equal(await p.locator('.view:not([hidden])').count(),1);
  assert.match(await p.locator("#equity").innerText(),/pt/);
  await shot("01-1280-dashboard.png");
  await tab("overview").focus();await p.keyboard.press("ArrowRight");
  assert.equal(await tab("portfolio").getAttribute("aria-selected"),"true");
  assert.equal(await p.locator("#view-portfolio").isVisible(),true);
  await tab("trade").click();
  assert.equal(await p.locator("#view-trade").isVisible(),true);
  assert.equal(await p.locator("#view-overview").isVisible(),false);
  assert.equal(await p.locator('#sidebarNav [aria-selected="true"]').count(),1);
  await shot("02-1280-trade.png");
  await p.locator("#quantity").fill("1");await p.locator("#buy").click();
  assert.match(await p.locator("#message").innerText(),/購入/);
  const afterBuy=await p.locator("#cash").innerText();
  await tab("bank").click();
  assert.equal(await p.locator("#view-bank").isVisible(),true);
  await p.locator("#bankAmount").fill("1000");await p.locator("#borrow").click();
  assert.match(await p.locator("#debt").innerText(),/pt/);
  await shot("03-1280-bank.png");
  await tab("records").click();
  assert.equal(await p.locator("#view-records").isVisible(),true);
  assert.match(await p.locator("#history").innerText(),/購入|借入/);
  await p.reload();
  assert.match(await p.locator("#history").innerText(),/購入|借入/);
  assert.equal(await p.locator('#sidebarNav [aria-selected="true"]').count(),1);
  await tab("overview").click();
  await p.locator("#nextDay").click();
  assert.match(await p.locator("#day").innerText(),/2 \/ 120/);
  await shot("04-1280-day2.png");
  const small=await browser.newContext({viewport:{width:1024,height:768}}),q=await small.newPage();
  attach(q);await q.goto(source,{waitUntil:"load"});
  const ext=await q.evaluate(()=>({width:document.documentElement.scrollWidth,viewport:window.innerWidth}));
  assert.ok(ext.width<=ext.viewport+2,"1024 horizontal overflow "+JSON.stringify(ext));
  assert.equal(await q.locator("#sidebarNav [role=tab]").count(),5);
  await q.screenshot({path:path.join(out,"05-1024-dashboard.png"),fullPage:true});
  assert.deepEqual(pageErrors,[]);assert.deepEqual(network,[]);
  const rec={result:"PASS",tabs:5,keyboardTabs:true,onlyOnePanelAtOnce:true,tradeAndBank:true,saveReload:true,advanceDay:true,
   width1024NoOverflow:true,shots:5,afterBuy,pageErrors,remoteRequests:network,
   scope:"Chromium file:// UI, not Store MSIX install runtime"};
  fs.writeFileSync(path.join(out,"UI_RELEASE_QA.json"),JSON.stringify(rec,null,2)+"\n");
  console.log("FINANCE_UI_QA_PASS "+JSON.stringify(rec));
 }finally{await browser.close();}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
