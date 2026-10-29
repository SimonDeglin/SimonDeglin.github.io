'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const bosa=require('../tools/bosa-browser.cjs');
test('échec BOSA enregistré sans effacer le dernier succès ni les marchés et analyses',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mr-bosa-health-')),dataPath=path.join(dir,'data.json');
 const original={generated_at:'2026-10-28',items:[{id:'stable',title:'Mission de géomètre',documentAnalyses:[{sha256:'proof'}]}],sources:{TED:{state:'conserver'},BOSA:{last_success:'2026-10-28T21:00:00Z',complete:true,pages:106}}};
 fs.writeFileSync(dataPath,JSON.stringify(original));
 try{
  await assert.rejects(()=>bosa.run({dataPath,quiet:true,collect:async()=>{throw Error('HTTP 503')}}),/503/);
  const after=JSON.parse(fs.readFileSync(dataPath));assert.deepEqual(after.items,original.items);assert.deepEqual(after.sources.TED,original.sources.TED);
  assert.equal(after.sources.BOSA.last_success,original.sources.BOSA.last_success);assert.equal(after.sources.BOSA.status,'unavailable');
  assert.match(after.sources.BOSA.last_error,/503/);assert(Number.isFinite(Date.parse(after.sources.BOSA.last_attempt)));
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
test('succès BOSA suivant : effacer l’erreur, dater le passage et conserver l’identité du dossier',()=>{
 const raw={publicationWorkspaceId:'b3502299-990e-444e-8a06-8a220c86c426',title:'Prestations de géomètre',organisationName:'Commune de Liège',cpvCodes:['71355000'],nutsCodes:['BE332']};
 const data={items:[],sources:{BOSA:{last_error:'HTTP 503',status:'unavailable'}}};
 const result={publications:[raw],complete:true,progress:[{received:1}],cutoff:'2026-10-15',pageCount:1,oldest:'2026-10-28'};
 bosa.importPublic(data,result);assert.equal(data.sources.BOSA.last_error,null);assert.equal(data.sources.BOSA.complete,true);
 assert.equal(data.sources.BOSA.last_attempt,data.sources.BOSA.last_success);assert.equal(data.items.length,1);
 const id=data.items[0].id;bosa.importPublic(data,result);assert.equal(data.items.length,1);assert.equal(data.items[0].id,id);
});
