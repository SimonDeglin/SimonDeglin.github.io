'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const reader=require('../tools/communes-documents.cjs'),q=require('../tools/municipal-queue.cjs');
const root='https://commune.test/conseil';
test('retenir les PDF au-delà du douzième et toutes les sous-pages candidates',()=>{
 const pdfs=Array.from({length:30},(_,i)=>'<a href="'+root+'/pv-'+i+'.pdf">PV</a>').join('');
 assert.equal(reader.fileLinks(pdfs,root).length,30);
 const pages=Array.from({length:8},(_,i)=>'<a href="'+root+'/2026/'+i+'">Séance</a>').join('');assert.equal(reader.childPages(pages,root).length,8);
});
test('parcours persistant : trente PDF atteints en trois lots sans recréer les dossiers ni oublier le 13e',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mr-queue-')),inventoryPath=path.join(dir,'communes.json'),dataPath=path.join(dir,'data.json');
 fs.writeFileSync(inventoryPath,JSON.stringify({communes:[{ins:'62001',name:'Test',deliberationSources:[{url:root,status:'page_accessible'}]}]}));fs.writeFileSync(dataPath,JSON.stringify({items:[{id:'historique',title:'Conserver'}]}));
 const visits=[],html=Array.from({length:30},(_,i)=>'<a href="'+root+'/pv-'+String(i).padStart(2,'0')+'.pdf">PV</a>').join('');
 try{
  for(let day=1;day<=3;day++){
   const report=await reader.run({inventoryPath,dataPath,quiet:true,now:'2026-11-0'+day+'T08:00:00Z',extract:b=>'Le conseil approuve le marché de services de géomètre pour '+b.toString(),fetchFn:async url=>{visits.push(url);return new Response(url===root?html:Buffer.from('%PDF-1.4 '+url))}});
   assert(report.documents<=12);
  }
  const c=JSON.parse(fs.readFileSync(inventoryPath)).communes[0];assert.equal(c.documentProgress.documentsKnown,30);assert.equal(c.documentProgress.documentsPending,0);
  assert.equal(c.documentsRead,30);assert.equal(new Set(visits.filter(u=>u.endsWith('.pdf'))).size,30);
  const items=JSON.parse(fs.readFileSync(dataPath)).items;assert(items.some(m=>m.id==='historique'));assert.equal(new Set(items.map(m=>m.id)).size,items.length);
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
test('les pages au-delà de la deuxième sont conservées et parcourues aux passes suivantes',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mr-pagequeue-')),inventoryPath=path.join(dir,'communes.json'),dataPath=path.join(dir,'data.json');
 fs.writeFileSync(inventoryPath,JSON.stringify({communes:[{ins:'62001',name:'Test',deliberationSources:[{url:root,status:'page_accessible'}]}]}));fs.writeFileSync(dataPath,JSON.stringify({items:[]}));const seen=new Set();
 try{
  for(let day=1;day<=3;day++)await reader.run({inventoryPath,dataPath,quiet:true,now:'2026-11-0'+day+'T08:00:00Z',extract:()=>'',fetchFn:async url=>{seen.add(url);return new Response(url===root?Array.from({length:6},(_,i)=>'<a href="'+root+'/2026/'+i+'">Conseil</a>').join(''):'Pas de PDF')}});
  assert.equal(seen.size,7);const c=JSON.parse(fs.readFileSync(inventoryPath)).communes[0];assert.equal(c.documentProgress.pagesPending,0);assert.equal(c.documentProgress.pagesKnown,7);
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
test('une limite de profondeur est déclarée et les erreurs gardent un délai de reprise',()=>{
 const queue=q.init({});assert.equal(q.remember(queue,'pages',{url:root+'/2026',depth:4},'2026-10-29'),false);assert.equal(q.progress(queue,{}).limited,true);
 q.remember(queue,'pages',{url:root,depth:0,nextAttemptAt:'2026-10-30T08:00:00Z'},'2026-10-29');
 assert.equal(q.pendingPages(queue,new Set(),'2026-10-29T08:00:00Z').length,0);
 assert.equal(q.pendingPages(queue,new Set(),'2026-10-31T08:00:00Z').length,1);
});
