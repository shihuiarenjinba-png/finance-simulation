"use strict";
const fs=require("node:fs");
const record=require("../store/partner-center-identity.json");
const {versionErrors}=require("./store-msix.cjs");
function decode(v){return String(v).replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16))).replace(/&#([0-9]+);/g,(_,n)=>String.fromCodePoint(parseInt(n,10))).replace(/&amp;/g,"&");}
function attr(tag,n){const r=new RegExp('\\b'+n+'\\s*=\\s*([\\x22\\x27])(.*?)\\1','g'),m=Array.from(tag.matchAll(r));if(m.length!==1)throw new Error("Manifest Identity."+n+" attribute must occur exactly once");return decode(m[0][2]);}
function rewrite(text,version,identity=record){
 const errors=versionErrors(version);if(errors.length)throw new Error(errors.join("; "));
 const tags=text.match(/<Identity\b[^>]*>/g)||[];if(tags.length!==1)throw new Error("Manifest must contain exactly one Identity element");
 const tag=tags[0];if(attr(tag,"Name")!==identity.identityName)throw new Error("Identity.Name differs from canonical JSON");
 if(attr(tag,"Publisher")!==identity.publisher)throw new Error("Identity.Publisher differs from canonical JSON");
 const pd=Array.from(text.matchAll(/<PublisherDisplayName\b[^>]*>([\s\S]*?)<\/PublisherDisplayName>/g));
 if(pd.length!==1||decode(pd[0][1].trim())!==identity.publisherDisplayName)throw new Error("PublisherDisplayName differs from canonical JSON");
 const display=Array.from(text.matchAll(/<DisplayName\b[^>]*>([\s\S]*?)<\/DisplayName>/g));
 if(display.length<2||display.some(m=>decode(m[1].trim())!==identity.productTitle))throw new Error("Both package DisplayName fields must match the recorded product title");
 return text.replace(tag,tag.replace(/\bVersion\s*=\s*(["'])(.*?)\1/,(m,q)=>"Version="+q+version+q));
}
module.exports={rewrite};
module.exports.default=async function(file){if(typeof file!=="string"||!file.trim())throw new Error("appxManifestCreated hook requires a Manifest path");fs.writeFileSync(file,rewrite(fs.readFileSync(file,"utf8"),process.env.STORE_PACKAGE_VERSION,record),"utf8");};
