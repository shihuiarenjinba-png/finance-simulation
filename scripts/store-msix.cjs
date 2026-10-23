"use strict";
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const {spawnSync}=require("node:child_process");
const record=require("../store/partner-center-identity.json");
const root=path.resolve(__dirname,".."),builderVersion="27.0.0-alpha.10";
const logos={"StoreLogo.png":[50,50],"Square44x44Logo.png":[44,44],"Square150x150Logo.png":[150,150],"Wide310x150Logo.png":[310,150]};
function pngDimensions(file){const b=fs.readFileSync(file);if(b.length<33||b.subarray(0,8).toString("hex")!=="89504e470d0a1a0a"||b.toString("ascii",12,16)!=="IHDR")return null;return [b.readUInt32BE(16),b.readUInt32BE(20)];}
function versionErrors(v){if(typeof v!=="string"||!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(v))return ["STORE_PACKAGE_VERSION は4要素の十進数形式が必要です"];const a=v.split(".").map(Number),e=[];if(a.some(n=>!Number.isSafeInteger(n)||n>65535))e.push("Version各要素は0～65535の範囲で指定してください");if(a[0]===0)e.push("Store Package VersionのMajorは0以外にしてください");if(a[3]!==0)e.push("Store Package VersionのRevision（第4要素）は0にしてください");return e;}
function gate(env,platform=process.platform,installed= null){
 const e=[],candidate=env.STORE_BUILD_MODE==="CANDIDATE";
 if(platform!=="win32")e.push("MSIX候補はWindowsランナーで生成してください");
 for(const [key,expected] of [["STORE_ID",record.storeId],["STORE_IDENTITY_NAME",record.identityName],["STORE_PUBLISHER",record.publisher],["STORE_PUBLISHER_DISPLAY_NAME",record.publisherDisplayName]]){if(!env[key])e.push(key+" が未設定です");else if(env[key]!==expected)e.push(key+" が正本Identity JSONと不一致です");}
 if(record.storeSubmission!=="HOLD")e.push("storeSubmission gateを再確認してください");
 if(env.STORE_IDENTITY_CONFIRMED!=="YES"&&!(candidate&&env.STORE_IDENTITY_CONFIRMED==="OWNER_APPROVED"))e.push("Identityの確認値が必要です（候補のみOWNER_APPROVEDを許可）");
 if(!candidate&&env.STORE_BRAND_APPROVED!=="YES")e.push("正式ビルドにはSTORE_BRAND_APPROVED=YESが必要です");
 if(!candidate&&env.STORE_PACKAGE_VERSION_APPROVED!=="YES")e.push("STORE_PACKAGE_VERSION_APPROVED=YES（所有者承認済みStore Version）が正式ビルドに必要です");
 e.push(...versionErrors(env.STORE_PACKAGE_VERSION));
 let b=installed;try{if(b===null)b=JSON.parse(fs.readFileSync(path.join(root,"node_modules/electron-builder/package.json"),"utf8")).version;}catch{}
 if(b!==builderVersion)e.push("electron-builder "+builderVersion+" が必要です。共有依存は変更せず隔離ビルド環境を使用してください");
 for(const f of ["index.html","desktop/main.cjs","store/partner-center-identity.json"])if(!fs.existsSync(path.join(root,f)))e.push("必須ファイルがありません: "+f);
 for(const [name,size] of Object.entries(logos)){const f=path.join(root,"build/appx",name);if(!fs.existsSync(f)){e.push("Store用ロゴ候補がありません: "+name);continue;}try{const d=pngDimensions(f);if(!d||d[0]!==size[0]||d[1]!==size[1])e.push("Store用ロゴ寸法が不一致: "+name);}catch{e.push("Store用ロゴを読めません: "+name);}}
 return e;
}
function makeConfig(env){const suffix=record.identityName.split(".").pop().replace(/[^A-Za-z0-9]/g,"").toLowerCase();return {
 appId:"com.okinawadesktoptools."+suffix,productName:record.productTitle,asar:true,
 files:["index.html","*.css","*.js","src/**/*","desktop/main.cjs","package.json"],
 directories:{output:"dist-msix-store-candidate",buildResources:"build"},
 toolsets:{winCodeSign:"1.1.0"},win:{target:[{target:"msix",arch:["x64"]}]},
 msix:{applicationId:suffix,identityName:record.identityName,publisher:record.publisher,publisherDisplayName:record.publisherDisplayName,displayName:record.productTitle,createMsixupload:true,setBuildNumber:false,capabilities:["runFullTrust"]},
 appxManifestCreated:"./scripts/store-msix-manifest-hook.cjs"
};}
function run(){const e=gate(process.env);if(e.length){process.stderr.write("STORE_MSIX_HOLD\n"+e.map(x=>"- "+x).join("\n")+"\n");process.exitCode=2;return;}
 const dir=path.join(root,"dist-msix-store-candidate");if(fs.existsSync(dir)&&fs.readdirSync(dir).length){process.stderr.write("候補出力先に既存ファイルがあります。上書きせず停止します。\n");process.exitCode=2;return;}
 const configPath=path.join(root,"electron-builder.store.candidate.generated.json");if(fs.existsSync(configPath)){process.stderr.write("既存の生成設定を保護するため停止します。\n");process.exitCode=2;return;}
 fs.writeFileSync(configPath,JSON.stringify(makeConfig(process.env),null,2)+"\n",{flag:"wx"});
 const cli=path.join(root,"node_modules/electron-builder/cli.js");
 const result=spawnSync(process.execPath,[cli,"--win","msix","--x64","--config",configPath,"--publish","never"],{cwd:root,stdio:"inherit",shell:false});
 if(result.error||result.status!==0){process.stderr.write("MSIX候補の生成に失敗しました。既存成果物は上書きしていません。\n");process.exitCode=result.status||1;return;}
 const v=spawnSync("powershell.exe",["-NoProfile","-ExecutionPolicy","Bypass","-File",path.join(root,"scripts/verify-store-msix.ps1")],{cwd:root,stdio:"inherit",shell:false,env:process.env});
 if(v.error||v.status!==0){process.stderr.write("MSIX内Manifest照合HOLD\n");process.exitCode=v.status||2;return;}
 const files=fs.readdirSync(dir).filter(x=>/\.(msix|msixupload)$/i.test(x)).map(name=>{const b=fs.readFileSync(path.join(dir,name));return {name,bytes:b.length,sha256:crypto.createHash("sha256").update(b).digest("hex")};});
 const msix=files.filter(x=>x.name.toLowerCase().endsWith(".msix")),uploads=files.filter(x=>x.name.toLowerCase().endsWith(".msixupload"));
 const audit={generatedAt:new Date().toISOString(),kind:process.env.STORE_BUILD_MODE==="CANDIDATE"?"INTERNAL_CANDIDATE_NOT_CERTIFIED_NOT_SUBMITTED":"BUILD_NOT_CERTIFIED",repository:process.env.GITHUB_REPOSITORY||record.repository,sourceBranch:process.env.GITHUB_REF_NAME||null,sourceCommit:process.env.GITHUB_SHA||null,workflowRunId:process.env.GITHUB_RUN_ID||null,storeId:record.storeId,identityName:record.identityName,publisher:record.publisher,publisherDisplayName:record.publisherDisplayName,packageSid:record.packageSid,packageVersion:process.env.STORE_PACKAGE_VERSION,brandApproval:process.env.STORE_BRAND_APPROVED==="YES"?"YES":"NOT_GRANTED_CANDIDATE_ONLY",packageVersionApproval:process.env.STORE_PACKAGE_VERSION_APPROVED==="YES"?"YES":"NOT_GRANTED_CANDIDATE_ONLY",files:files,remainingGates:["live Partner Center identity/name confirmation","brand review","approved Store version","Windows install/run/save/restore","WACK/Store validation","manual submission approval"]};
 fs.writeFileSync(path.join(dir,"MSIX_CANDIDATE_HANDOFF.json"),JSON.stringify(audit,null,2)+"\n");
 if(!msix.length||!uploads.length){process.stderr.write("MSIXとMSIXUPLOAD双方が必要です\n");process.exitCode=2;return;}
 process.stdout.write("MSIX候補とMSIXUPLOADを生成しManifest照合しました。未認証・未提出です。\n");
}
if(require.main===module)run();
module.exports={gate,makeConfig,versionErrors,logos,builderVersion,record};
