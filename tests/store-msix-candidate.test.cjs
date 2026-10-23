"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const msix=require("../scripts/store-msix.cjs");
const icons=require("../scripts/make-store-candidate-icons.cjs");
const hook=require("../scripts/store-msix-manifest-hook.cjs");
const record=require("../store/partner-center-identity.json");
test("Store Version validation rejects malformed values and nonzero revision",()=>{
 assert.deepEqual(msix.versionErrors("1.0.0.0"),[]);
 for(const v of ["0.1.0.0","1.0.0","1.0.0.1","01.0.0.0","1.65536.0.0","1.0.0.x"])assert.ok(msix.versionErrors(v).length,v);
});
test("candidate mode uses exactly the canonical product identity but does not claim commercial approval",()=>{
 const env={STORE_BUILD_MODE:"CANDIDATE",STORE_ID:record.storeId,STORE_IDENTITY_NAME:record.identityName,STORE_PUBLISHER:record.publisher,STORE_PUBLISHER_DISPLAY_NAME:record.publisherDisplayName,STORE_IDENTITY_CONFIRMED:"OWNER_APPROVED",STORE_BRAND_APPROVED:"CANDIDATE_ONLY",STORE_PACKAGE_VERSION_APPROVED:"CANDIDATE_ONLY",STORE_PACKAGE_VERSION:"1.0.0.0"};
 assert.deepEqual(msix.gate(env,"win32",msix.builderVersion),[]);
 const formal=msix.gate({...env,STORE_BUILD_MODE:undefined},"win32",msix.builderVersion).join("\n");
 assert.match(formal,/STORE_BRAND_APPROVED/);assert.match(formal,/STORE_PACKAGE_VERSION_APPROVED/);assert.match(formal,/STORE_IDENTITY_CONFIRMED/);
 assert.match(msix.gate({...env,STORE_IDENTITY_NAME:"OkinawaDesktopTools.WRONG"},"win32",msix.builderVersion).join("\n"),/正本Identity JSONと不一致/);
});
test("configuration reads Identity from the canonical JSON and targets x64 MSIX only",()=>{
 const c=msix.makeConfig({STORE_PACKAGE_VERSION:"1.0.0.0"});
 assert.equal(c.msix.identityName,record.identityName);assert.equal(c.msix.publisher,record.publisher);assert.equal(c.msix.publisherDisplayName,record.publisherDisplayName);
 assert.equal(c.msix.displayName,record.productTitle);assert.deepEqual(c.win.target,[{target:"msix",arch:["x64"]}]);
 assert.equal(c.appxManifestCreated,"./scripts/store-msix-manifest-hook.cjs");
});
test("candidate icon generation is deterministic and has Store-required dimensions",()=>{
 for(const [name,[w,h]] of Object.entries(icons.specs)){const b=icons.paint(w,h);assert.equal(b.subarray(0,8).toString("hex"),"89504e470d0a1a0a");assert.equal(b.readUInt32BE(16),w,name);assert.equal(b.readUInt32BE(20),h,name);assert.ok(b.equals(icons.paint(w,h)));}
});
test("Manifest hook rewrites only Version and checks both display-name fields",()=>{
 const source='<?xml version="1.0"?><Package><Identity Name="'+record.identityName+'" Publisher="'+record.publisher+'" Version="0.1.0.0" ProcessorArchitecture="x64"/><Properties><DisplayName>'+record.productTitle+'</DisplayName><PublisherDisplayName>'+record.publisherDisplayName+'</PublisherDisplayName></Properties><Applications><Application><VisualElements DisplayName="'+record.productTitle+'"/></Application></Applications></Package>';
 const updated=hook.rewrite(source,"1.0.0.0");assert.ok(updated.includes('Version="1.0.0.0"'));assert.ok(updated.includes('Name="'+record.identityName+'"'));assert.ok(updated.includes('Publisher="'+record.publisher+'"'));assert.ok(updated.includes(record.publisherDisplayName));
 assert.throws(()=>hook.rewrite(source.replace(record.productTitle,"Wrong title"),"1.0.0.0"),/DisplayName/);
 assert.throws(()=>hook.rewrite(source,"1.0.0.1"),/Revision/);
});
