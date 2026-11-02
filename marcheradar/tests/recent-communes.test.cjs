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

test('cartes à lien vide : utiliser le titre voisin et conserver la séance source',()=>{
 const url='https://www.deliberations.be/test/decisions/@@faceted_query?seance='+ 'a'.repeat(32);
 const html='<div class="item-card in_project"><a href="https://www.deliberations.be/test/decisions/26-octobre-2026/auteur-projet" class="filled-link"></a><h3 class="card-title"><span><p>Désignation d’un auteur de projet de voirie</p></span></h3></div>';
 const links=adapter.links(html,url,now,{sessionProof:{date:'2026-10-26'},depth:1});assert.equal(links.length,1);assert.match(links[0].title,/auteur de projet/);assert.equal(links[0].sessionProof.date,'2026-10-26');
});
test('PDF anciens mal nommés : ne pas explorer les dossiers annuels obsolètes',()=>{
 const q=queue.init({});queue.remember(q,'documents',{url:'https://commune.test/conseil/2015/ordre-du-jour25.pdf'},now);assert.equal(queue.pendingDocuments(q,{},now).length,0);
 assert.equal(dates.extract({text:'PROCÈS VERBAL DE LA SÉANCE DU 29 JANVIER 2025'}).session.date,'2025-01-29');
 assert.equal(dates.extract({text:'Séance du : 27 août 2026'}).session.date,'2026-08-27');
});

test('éviter les fausses pistes : plan déjà réalisé, avenants, règlements, travaux et fournitures',()=>{
 const {assess}=require('../tools/municipal-opportunity.cjs');
 for(const title of ["Travaux d'aménagement à l'école - approbation du mode de passation",'Règlement complémentaire de roulage','Avenant au contrat d’études','Matériel pour aménagement du complexe sportif'])assert.equal(assess({title}).eligible,false,title);
 assert.equal(assess({title:'Vente de parcelles communales',text:'Le projet de plan de mesurage réalisé par le géomètre.'}).eligible,false);
 assert.equal(assess({title:"Désignation d'un géomètre pour diverses missions - approbation des conditions"}).eligible,true);
 assert.equal(assess({title:'Désignation d’un auteur de projet chargé du plan de mobilité'}).eligible,true);
});

test('Amay : même référence explicite et acheteur, une décision rejoint le dossier BOSA sans duplication',()=>{
 const merge=require('../tools/merge-municipal.cjs');const existing={id:'bosa:stable',source:'BOSA',buyer:"Commune d'Amay",title:"Marché annuel 2026-2030: Désignation d'un géomètre",internalReference:'PPP06E-1625/6097/2026.1625 3P_001',notes:'Conserver'};
 const notice={id:'local:test',source:'LOCALE',buyer:'Commune de Amay',title:'2026.1625 3P - Marché annuel 2026-2030: Désignation d’un géomètre',sourceDocument:'https://commune.test/decision'};const r=merge.insert([existing],notice);assert.equal(r.items.length,1);assert.equal(r.items[0].id,'bosa:stable');assert.equal(r.items[0].notes,'Conserver');assert.equal(r.items[0].municipalNotices.length,1);assert.equal(merge.insert(r.items,notice).items[0].municipalNotices.length,1);
 assert.equal(merge.insert([{...existing,buyer:'Commune de Test'}],notice).linked,false);
});

test('ne jamais suivre une redirection vers YouTube ou un domaine tiers',async()=>{
 const {fetchPublic}=require('../tools/communal-http.cjs');const calls=[];await assert.rejects(()=>fetchPublic('https://commune.test/conseil',{},async(url,options)=>{calls.push(url);assert.equal(options.redirect,'manual');return new Response(null,{status:302,headers:{location:'https://www.youtube.com/watch?v=test'}})}),/hors collecte/);assert.equal(calls.length,1);
 assert.equal(reader.fileLinks('<a href="https://tiers.test/doc.pdf">PV</a>','https://commune.test/conseil').length,0);
});

test('identifiants de séance de longueur variable : ne pas manquer Namur',()=>{
 const id='248e55ad94f6418e80224dabf170edce';const found=adapter.links('<select name="seance"><option value="'+id+'">13 Octobre 2026 (18:00) — Décision</option></select>','https://www.deliberations.be/namur/decisions',now);assert.equal(found.length,1);assert(found[0].url.includes(id));
});

test('ordre du jour scanné : reconnaître auteur de projet coupé sur deux lignes',()=>{
 const found=reader.passages("MS.A26.12 Schéma de développement communal (SDC) – Désignation d’un auteur\nde projet pour l’élaboration du schéma communal – Approbation des conditions.");assert.equal(found.length,1);assert.match(found[0].excerpt,/auteur de projet/);
});
