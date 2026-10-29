'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {selection}=require('../tools/communes-scope.cjs'),discovery=require('../tools/communes-discovery.cjs'),reader=require('../tools/communes-documents.cjs');
const records=[{ins:'62001',name:'Test Liège',officialSite:'https://liege.test/'},{ins:'92001',name:'Test Namur',officialSite:'https://namur.test/'}];
test('filtrer les deux collecteurs par province et commune, refuser les périmètres invalides',()=>{
 assert.deepEqual(selection(records,{province:'liege',ins:''}),[records[0]]);
 assert.deepEqual(selection(records,{province:'all',ins:'92001'}),[records[1]]);
 assert.throws(()=>selection(records,{province:'liege',ins:'92001'}),/absente/);
 assert.throws(()=>selection(records,{province:'inconnue'}),/inconnue/);
 assert.throws(()=>selection(records,{ins:'$(evil)'}),/cinq chiffres/);
});
test('découverte : ne visiter que la commune choisie et conserver l’autre et les dossiers',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mr-scope-')),inventoryPath=path.join(dir,'communes.json'),dataPath=path.join(dir,'data.json');
 const original={items:[{id:'stable',title:'Existant'}],sources:{BOSA:{last_success:'2026-10-28'}}};
 fs.writeFileSync(inventoryPath,JSON.stringify({communes:records}));fs.writeFileSync(dataPath,JSON.stringify(original));const visited=[];
 try{
  await discovery.run({inventoryPath,dataPath,province:'namur',ins:'92001',quiet:true,getHtml:async url=>{visited.push(url);return {url,content:'<a href="/marches-publics">Marchés publics</a><a href="/conseil/pv.pdf">PV conseil communal</a>'}}});
  assert(visited.length>0);assert(visited.every(u=>u.startsWith('https://namur.test/')));
  const saved=JSON.parse(fs.readFileSync(inventoryPath));assert.deepEqual(saved.communes[0],records[0]);
  assert(saved.communes[1].deliberationSources.some(s=>s.status==='document_pdf_a_analyser'));
  assert.deepEqual(JSON.parse(fs.readFileSync(dataPath)).items,original.items);
  assert.deepEqual(JSON.parse(fs.readFileSync(dataPath)).sources.BOSA,original.sources.BOSA);
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
test('PDF direct et sous-page datée : lecture ciblée sans parcourir une autre commune',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mr-direct-')),inventoryPath=path.join(dir,'communes.json'),dataPath=path.join(dir,'data.json');
 const list=records.map(c=>({...c,deliberationSources:[{url:c.officialSite+'conseil/pv.pdf',status:'document_pdf_a_analyser'},{url:c.officialSite+'conseil',status:'page_accessible'}]}));
 fs.writeFileSync(inventoryPath,JSON.stringify({communes:list}));fs.writeFileSync(dataPath,JSON.stringify({items:[{id:'historique',title:'Existant'}],sources:{}}));const visited=[];
 const quote='Le conseil approuve le marché de services pour une mission de géomètre et des relevés topographiques.';
 try{
  const report=await reader.run({inventoryPath,dataPath,province:'namur',ins:'92001',quiet:true,now:'2026-10-29T08:00:00Z',extract:()=>quote,
   fetchFn:async url=>{visited.push(url);return new Response(url.endsWith('.pdf')?Buffer.from('%PDF-1.4 test'):url.endsWith('/conseil')?'<a href="/conseil/2026">Séance 2026</a>':'<a href="/conseil/autre.pdf">Procès-verbal</a>')}});
  assert.equal(report.communes,1);assert.equal(report.documents,2);assert(visited.every(u=>u.startsWith('https://namur.test/')));
  const saved=JSON.parse(fs.readFileSync(inventoryPath));assert.deepEqual(saved.communes[0],list[0]);assert.equal(saved.communes[1].documentsRead,2);
  assert(JSON.parse(fs.readFileSync(dataPath)).items.some(m=>m.id==='historique'));
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
test('sous-pages bornées : ne pas sortir du site ou remonter au parent ; PDF avec fragment dédupliqué',()=>{
 const html='<a href="/conseil/2026">2026</a><a href="https://evil.test/conseil/2026">2026</a><a href="/">Conseil</a>';
 assert.deepEqual(reader.childPages(html,'https://namur.test/conseil'),['https://namur.test/conseil/2026']);
 assert.equal(reader.fileLinks('<a href="/pv.pdf#page=1">PV</a><a href="/pv.pdf#page=2">PV</a>','https://namur.test/').length,1);
});
