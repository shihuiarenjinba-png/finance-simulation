"use strict";
// Real Windows Edge source-game acceptance; isolated temp profile, no external packages.
const fs=require("node:fs"),path=require("node:path"),os=require("node:os"),
 cp=require("node:child_process"),{pathToFileURL}=require("node:url");
const nap=ms=>new Promise(r=>setTimeout(r,ms));
async function main(){
 if(process.platform!=="win32")throw Error("Windows required");
 const root=path.resolve(process.argv[2]||process.cwd());
 const output=path.resolve(process.argv[3]||path.join(root,"qa-gameplay"));
 fs.mkdirSync(output,{recursive:true});
 const edge=[process.env.EDGE_PATH,
  process.env["PROGRAMFILES(X86)"]&&path.join(process.env["PROGRAMFILES(X86)"],"Microsoft/Edge/Application/msedge.exe"),
  process.env.PROGRAMFILES&&path.join(process.env.PROGRAMFILES,"Microsoft/Edge/Application/msedge.exe"),
  process.env.LOCALAPPDATA&&path.join(process.env.LOCALAPPDATA,"Microsoft/Edge/Application/msedge.exe")
 ].find(v=>v&&fs.existsSync(v));
 if(!edge)throw Error("Microsoft Edge not found");
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),"finance-gameplay-"));
 const child=cp.spawn(edge,["--headless=new","--no-first-run","--disable-extensions",
  "--disable-background-networking","--remote-debugging-port=0","--user-data-dir="+profile,
  "--allow-file-access-from-files","about:blank"],{windowsHide:true,stdio:"ignore"});
 let ws,serial=0;const pending=new Map(),steps=[],errors=[],photos=[];
 try{
  let port=0;
  for(let i=0;i<110;i++){
   const p=path.join(profile,"DevToolsActivePort");
   if(fs.existsSync(p))port=Number(fs.readFileSync(p,"utf8").split(/\r?\n/)[0]);
   if(port)break;
   if(child.exitCode!==null)throw Error("Edge exited before debugging");
   await nap(100);
  }
  if(!port)throw Error("DevTools port not found");
  let target=null;
  for(let i=0;i<50;i++){
   try{const list=await (await fetch("http://127.0.0.1:"+port+"/json/list")).json();
    target=list.find(v=>v.type==="page"&&v.webSocketDebuggerUrl);if(target)break;
   }catch(_e){}await nap(100);
  }
  if(!target)throw Error("Edge page not found");
  ws=new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{ws.addEventListener("open",resolve,{once:true});ws.addEventListener("error",reject,{once:true});});
  ws.addEventListener("message",e=>{
   let m;try{m=JSON.parse(String(e.data));}catch(_e){return;}
   if(m.method==="Runtime.exceptionThrown"){errors.push({kind:"page-exception",message:m.params?.exceptionDetails?.text||"runtime"});return;}
   const slot=pending.get(m.id);if(!slot)return;pending.delete(m.id);
   m.error?slot.reject(Error(m.error.message)):slot.resolve(m.result);
  });
  const send=(method,params={})=>new Promise((resolve,reject)=>{
   const id=++serial;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));
  });
  const evaluate=async fn=>{
   const r=await send("Runtime.evaluate",{expression:"("+fn.toString()+")()",returnByValue:true,awaitPromise:true});
   if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);
   return r.result?.value;
  };
  const waitReady=async()=>{
   for(let i=0;i<100;i++){
    try{if(await evaluate(()=>document.readyState==="complete"&&
      !!window.LiquidPortfolio&&/pt/.test(document.getElementById("equity").textContent)))return;}catch(_e){}
    await nap(100);
   }
   throw Error("UI init timed out");
  };
  const step=async(name,fn)=>{
   const result=await evaluate(fn);
   if(!result||result.ok!==true)throw Error(name+": "+JSON.stringify(result));
   steps.push({name,...result});console.log("PASS "+name+" "+JSON.stringify(result));
  };
  const screenshot=async label=>{
   const result=await send("Page.captureScreenshot",{format:"png",captureBeyondViewport:false});
   const file=label+".png";fs.writeFileSync(path.join(output,file),Buffer.from(result.data,"base64"));photos.push(file);
  };
  await send("Page.enable");await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride",{width:1280,height:720,deviceScaleFactor:1,mobile:false});
  await send("Page.navigate",{url:pathToFileURL(path.join(root,"index.html")).href});await waitReady();
  await step("new game has correct initial funds",()=>{
   const s=JSON.parse(localStorage.getItem("liquid-portfolio:save:v2"));
   return {ok:s.day===1&&s.cash===100000&&s.debt===0&&s.shares.every(q=>q===0),day:s.day,cash:s.cash};
  });
  await step("trade tab shows real controls",()=>{
   document.querySelector('[data-view="trade"]').click();
   return {ok:!document.getElementById("view-trade").hidden&&document.getElementById("view-overview").hidden&&
    document.querySelector('[data-view="trade"]').classList.contains("selected")};
  });
  await step("buy via UI reduces cash and records an asset",()=>{
   const before=JSON.parse(localStorage.getItem("liquid-portfolio:save:v2"));
   document.getElementById("buy").click();
   const after=JSON.parse(localStorage.getItem("liquid-portfolio:save:v2"));
   return {ok:after.shares[0]===1&&after.cash<before.cash&&after.events.length===before.events.length+1,
    shares:after.shares[0],cash:after.cash};
  });
  await screenshot("01-buy-confirmed");
  await step("borrow via UI changes equal debt and cash",()=>{
   document.querySelector('[data-view="bank"]').click();
   const before=JSON.parse(localStorage.getItem("liquid-portfolio:save:v2"));
   document.getElementById("borrow").click();
   const after=JSON.parse(localStorage.getItem("liquid-portfolio:save:v2"));
   return {ok:after.debt===5000&&after.cash===before.cash+5000, debt:after.debt,cash:after.cash};
  });
  await screenshot("02-debt-confirmed");
  await send("Page.reload",{ignoreCache:true});await nap(350);await waitReady();
  await step("reload restores previously bought holdings and debt",()=>{
   const s=JSON.parse(localStorage.getItem("liquid-portfolio:save:v2"));
   return {ok:s.shares[0]===1&&s.debt===5000&&/5,000/.test(document.getElementById("debt").textContent)&&
    /1口/.test(document.getElementById("holdingsTable").textContent),shares:s.shares[0],debt:s.debt};
  });
  await step("sell via UI clears the held asset",()=>{
   document.querySelector('[data-view="trade"]').click();
   const before=JSON.parse(localStorage.getItem("liquid-portfolio:save:v2"));
   document.getElementById("sell").click();
   const after=JSON.parse(localStorage.getItem("liquid-portfolio:save:v2"));
   return {ok:after.shares[0]===0&&after.cash>before.cash,shares:after.shares[0]};
  });
  await step("repay via UI returns debt to zero",()=>{
   document.querySelector('[data-view="bank"]').click();document.getElementById("repay").click();
   const s=JSON.parse(localStorage.getItem("liquid-portfolio:save:v2"));
   return {ok:s.debt===0&&/0 pt/.test(document.getElementById("debt").textContent),debt:s.debt};
  });
  await step("advance moves exactly one day",()=>{
   const before=JSON.parse(localStorage.getItem("liquid-portfolio:save:v2"));
   document.getElementById("nextDay").click();
   const after=JSON.parse(localStorage.getItem("liquid-portfolio:save:v2"));
   return {ok:after.day===before.day+1&&after.trail.length===2,day:after.day};
  });
  await screenshot("03-day2-portfolio");
  await step("reset preserves saved game in first backup",()=>{
   window.confirm=()=>true;
   const old=localStorage.getItem("liquid-portfolio:save:v2");
   document.querySelector('[data-view="records"]').click();
   document.getElementById("reset").click();
   const s=JSON.parse(localStorage.getItem("liquid-portfolio:save:v2"));
   return {ok:s.day===1&&s.events.length===0&&localStorage.getItem("liquid-portfolio:backup:v2")===old&&
    !document.getElementById("exportBackup").disabled&&document.getElementById("backupSlot").children.length===1};
  });
  await step("second reset preserves two distinct backups",()=>{
   document.querySelector('[data-view="trade"]').click();document.getElementById("quantity").value="3";
   document.getElementById("buy").click();
   const previous=localStorage.getItem("liquid-portfolio:save:v2");
   const first=localStorage.getItem("liquid-portfolio:backup:v2");
   document.querySelector('[data-view="records"]').click();document.getElementById("reset").click();
   return {ok:localStorage.getItem("liquid-portfolio:backup:v2:2")===previous&&previous!==first&&
    document.getElementById("backupSlot").children.length===2,backupCount:2};
  });
  await screenshot("04-two-backups");
  await evaluate(()=>localStorage.setItem("liquid-portfolio:save:v2",'{"broken":'));
  await send("Page.reload",{ignoreCache:true});await nap(350);await waitReady();
  await step("corrupt save remains unchanged and cannot be traded",()=>{
   const raw=localStorage.getItem("liquid-portfolio:save:v2");
   document.querySelector('[data-view="trade"]').click();document.getElementById("buy").click();
   return {ok:raw==='{"broken":'&&localStorage.getItem("liquid-portfolio:save:v2")===raw&&
    /セーブ|復旧/.test(document.getElementById("message").textContent),protected:true};
  });
  await screenshot("05-corrupt-save-protected");
 }catch(error){errors.push({kind:"test-failure",message:String(error)});console.error(error);process.exitCode=1;}
 finally{
  try{ws?.close();}catch(_e){}try{child.kill();}catch(_e){}await nap(250);
  try{fs.rmSync(profile,{recursive:true,force:true,maxRetries:2,retryDelay:250});}catch(_e){}
  fs.writeFileSync(path.join(output,"finance_gameplay_manifest.json"),JSON.stringify({
   type:"Actual Edge source-game actions and save; not MSIX certification",steps,photos,errors
  },null,2));
  console.log("Result "+steps.length+" game checks, "+photos.length+" screenshots, "+errors.length+" errors");
  if(errors.length)process.exitCode=1;
 }
}
main().catch(err=>{console.error(err);process.exitCode=1;});
