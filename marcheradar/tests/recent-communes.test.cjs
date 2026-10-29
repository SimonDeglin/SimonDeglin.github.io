'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const dates=require('../document-dates.js'),queue=require('../tools/municipal-queue.cjs'),adapter=require('../tools/communal-html.cjs'),reader=require('../tools/communes-documents.cjs'),batch=require('../tools/communal-batch.cjs');
const now='2026-10-29T12:00:00Z';
const local=date=>({source:'LOCALE',sourceDocumentDates:{session:{date,kind:'session',confidence:'explicit',source:'pdf_text',excerpt:'Séance datée'}}});
test('trois mois civils : frontière incluse, fin de mois bornée et aucune fausse fraîcheur sans date',()=>{
 assert.equal(dates.cutoff(now),'2026-07-29');assert.equal(dates.cutoff('2026-05-31T12:00:00Z'),'2026-02-28');assert.equal(dates.freshness(local('2026-07-29'),now).active,true);assert.equal(dates.freshness(local('2026-07-28'),now).active,false);assert.equal(dates.freshness({source:'LOCALE',publication:'2026-10-29'},now).reason,'date_unknown');assert.equal(dates.freshness({source:'TED'},now).active,true);
});
test('archives en tête : la file lit le PDF récent en premier et évite les vieux documents datés',()=>{
 const q=queue.init({});for(const date of ['2022-01-01','2026-08-31','2026-10-01'])queue.remember(q,'documents',{url:'https://commune.test/pv-'+date+'.pdf',title:'PV du '+date},now);
 const pending=queue.pendingDocuments(q,{},now);assert.equal(pending.length,2);assert.match(pending[0][1].url,/2026-10-01/);assert(!pending.some(([,p])=>p.url.includes('2022')));
 assert(!reader.childPages('<a href="https://commune.test/conseil/sendtomanager_form">Conseil</a>','https://commune.test/conseil').length);
});
test('Délibérations.be : séances récentes explicites et pagination de la même séance',()=>{
 const root='https://www.deliberations.be/test/decisions',id='a'.repeat(32),old='b'.repeat(32);
 const links=adapter.links('<select name="seance"><option value="'+id+'">26 Octobre 2026 (20:00)</option><option value="'+old+'">22 Juin 2026</option></select>',root,now);assert.equal(links.length,1);assert.equal(links[0].sessionProof.date,'2026-10-26');
 const url=links[0].url,html='<a href="'+root+'/26-octobre-2026/bureau-etudes">Désignation du bureau d’études de voirie</a><a href="'+root+'/@@faceted_query?seance='+id+'&amp;b_start:int=20">20 éléments suivants</a><a href="'+root+'/@@faceted_query?b_start:int=200">suivants</a>';
 const found=adapter.links(html,url,now,links[0]);assert.equal(found.length,2);assert(found.every(p=>p.sessionProof.date==='2026-10-26'));assert(!found.some(p=>p.url.includes('=200')));
});
test('décision HTML : preuve de date, objet réel, identité stable et aucun PDF inventé',()=>{
 const url='https://www.deliberations.be/test/decisions/26-octobre-2026/mission',context={sessionProof:{date:'2026-10-26',kind:'session',source:'html_text',confidence:'explicit',excerpt:'Date de la séance : 26 octobre 2026'}};
 const html='<nav>Bureau études global</nav><h1>Désignation d’un géomètre</h1><div id="content-core"><p>Le Conseil décide de lancer un marché de services de géomètre pour le bornage et la division parcellaire.</p><p>Le Conseil approuve le cahier spécial des charges de ce marché de services.</p></div>';
 const a=reader.processHTML([],{ins:'62001',name:'Test'},html,url,context,now);assert.equal(a.created,1);assert.equal(a.items[0].sourceDocumentFormat,'html');assert.equal(a.items[0].sourceDocumentDates.session.date,'2026-10-26');assert.equal(a.items[0].sourceDocumentVersion.format,'html');
 const b=reader.processHTML(a.items,{ins:'62001',name:'Test'},html+' ',url,context,now);assert.equal(b.items.length,1);assert.equal(b.items[0].id,a.items[0].id);assert.equal(b.created,0);
 assert.equal(reader.processHTML([],{ins:'62001',name:'Test'},html,url,{sessionProof:{...context.sessionProof,date:'2026-04-01'}},now).created,0);
});
test('lot parallèle : fusionner les communes sans perte de dossiers ou d’état BOSA',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mr-batch-test-')),inventoryPath=path.join(dir,'communes.json'),dataPath=path.join(dir,'data.json');
 fs.writeFileSync(inventoryPath,JSON.stringify({communes:[{ins:'62001',name:'A',officialSite:'https://a.test'},{ins:'62002',name:'B',officialSite:'https://b.test'}]}));fs.writeFileSync(dataPath,JSON.stringify({items:[{id:'ancien',notes:'Conserver'}],sources:{BOSA:{last_success:'2026-10-29T09:00:00Z'}}}));
 try{
  await batch.run({inventoryPath,dataPath,quiet:true,now,concurrency:2,discover:async()=>{},read:async o=>{const d=JSON.parse(fs.readFileSync(o.dataPath));d.items.push({id:'new:'+o.ins,municipalityINS:o.ins});fs.writeFileSync(o.dataPath,JSON.stringify(d));const c=JSON.parse(fs.readFileSync(o.inventoryPath));c.communes[0].lastDocumentCheck=now;fs.writeFileSync(o.inventoryPath,JSON.stringify(c));return {checked:1,errors:0}}});
  const d=JSON.parse(fs.readFileSync(dataPath)),c=JSON.parse(fs.readFileSync(inventoryPath));assert.equal(d.items.length,3);assert.equal(d.items[0].notes,'Conserver');assert.equal(d.sources.BOSA.last_success,'2026-10-29T09:00:00Z');assert(c.communes.every(c=>c.lastDocumentCheck===now));
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
