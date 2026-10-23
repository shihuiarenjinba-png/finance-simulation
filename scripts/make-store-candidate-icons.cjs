"use strict";
// Internal Store icon candidates only. Never overwrites an existing product asset.
const fs=require("node:fs"),path=require("node:path"),zlib=require("node:zlib");
const record=require("../store/partner-center-identity.json");
const outDir=path.resolve(__dirname,"..","build","appx");
const specs={"StoreLogo.png":[50,50],"Square44x44Logo.png":[44,44],"Square150x150Logo.png":[150,150],"Wide310x150Logo.png":[310,150]};
const table=Array.from({length:256},(_,n)=>{let c=n;for(let i=0;i<8;i++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
function crc32(b){let c=0xffffffff;for(const v of b)c=table[(c^v)&255]^(c>>>8);return (c^0xffffffff)>>>0;}
function chunk(type,data){const t=Buffer.from(type),l=Buffer.alloc(4),c=Buffer.alloc(4);l.writeUInt32BE(data.length);c.writeUInt32BE(crc32(Buffer.concat([t,data])));return Buffer.concat([l,t,data,c]);}
function distLine(x,y,x1,y1,x2,y2){const dx=x2-x1,dy=y2-y1,d=dx*dx+dy*dy,t=d?Math.max(0,Math.min(1,((x-x1)*dx+(y-y1)*dy)/d)):0;return Math.hypot(x-x1-t*dx,y-y1-t*dy);}
function paint(w,h){const b=Buffer.alloc(h*(w*4+1)),wide=w>h,cx=wide?.31:.5;
 for(let y=0;y<h;y++){const row=y*(w*4+1);b[row]=0;for(let x=0;x<w;x++){const nx=(x/w-cx)/(Math.min(w,h)/w)+.5,ny=(y/h-.5)/(Math.min(w,h)/h)+.5;let col=[20,27,30,255];
 const outer=Math.hypot(nx-.5,ny-.5);if(outer<.44)col=[51,91,83,255];if(outer<.36)col=[20,27,30,255];
 const box=nx>.29&&nx<.71&&ny>.2&&ny<.8;
 if(box&&(Math.abs(nx-.34)<.035||Math.abs(nx-.66)<.035||Math.abs(ny-.24)<.035||Math.abs(ny-.76)<.035))col=[206,173,114,255];
 if(box&&((nx>.42&&nx<.58&&ny>.35&&ny<.44)||(nx>.40&&nx<.60&&ny>.53&&ny<.62)))col=[244,242,226,255];
 if(distLine(nx,ny,.28,.83,.75,.83)<.018)col=[206,173,114,255];
 if(wide&&x/w>.63&&x/w<.95&&(Math.abs(y/h-.38)<.018||Math.abs(y/h-.62)<.018))col=[206,173,114,255];
 const p=row+1+x*4;b[p]=col[0];b[p+1]=col[1];b[p+2]=col[2];b[p+3]=col[3];}}
 const header=Buffer.alloc(13);header.writeUInt32BE(w,0);header.writeUInt32BE(h,4);header[8]=8;header[9]=6;
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk("IHDR",header),chunk("IDAT",zlib.deflateSync(b,{level:9})),chunk("IEND",Buffer.alloc(0))]);}
function run(){fs.mkdirSync(outDir,{recursive:true});for(const [name,[w,h]] of Object.entries(specs)){const file=path.join(outDir,name);if(fs.existsSync(file)){process.stdout.write("KEEP existing candidate/brand asset: "+name+"\n");continue;}const png=paint(w,h);fs.writeFileSync(file,png,{flag:"wx"});process.stdout.write("CANDIDATE "+name+" "+w+"x"+h+" "+png.length+" bytes\n");}process.stdout.write("Internal artwork candidates for "+record.productTitle+" only; no commercial brand approval is implied.\n");}
if(require.main===module)run();
module.exports={specs,paint,crc32,run};
