'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const batch=require('../tools/communal-batch.cjs'),reader=require('../tools/communes-documents.cjs'),queue=require('../tools/municipal-queue.cjs'),adapter=require('../tools/communal-html.cjs'),health=require('../source-health.js');
const now='2026-11-02T12:00:00Z';
test('une commune sans source ne bloque plus la rotation ; tentative distincte de succès documentaire',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mr-rotation-')),inventoryPath=path.join(dir,'communes.json'),dataPath=path.join(dir,'data.json');
 fs.writeFileSync(inventoryPath,JSON.stringify({communes:[{ins:'62001',name:'Sans source',officialSite:'https://a.test'},{ins:'92001',name:'Suivante',officialSite:'https://b.test'}]}));fs.writeFileSync(dataPath,JSON.stringify({items:[{id:'keep'}]}));const seen=[];
 try{
  for(const date of [now,'2026-11-02T16:00:00Z'])await batch.run({inventoryPath,dataPath,limit:1,concurrency:1,quiet:true,now:date,discover:async o=>{seen.push(o.ins)},read:async()=>({checked:0,htmlRead:0,errors:0})});
  assert.deepEqual(seen,['62001','92001']);const inv=JSON.parse(fs.readFileSync(inventoryPath));assert(inv.communes.every(c=>c.lastMunicipalAttempt));assert(inv.communes.every(c=>!c.lastDocumentSuccess));assert.equal(JSON.parse(fs.readFileSync(dataPath)).sources.COMMUNES_DOCUMENTS.last_success,undefined);
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
test('pages sœurs documentaires suivies, menu général et domaines tiers ignorés',()=>{
 const found=reader.childPages('<a href="/publications/seance-2026">Ordre du jour du conseil communal</a><a href="/">Conseil</a><a href="https://tiers.test/pv">Procès-verbal</a>','https://commune.test/conseil');assert.deepEqual(found,['https://commune.test/publications/seance-2026']);
});
test('les fiches métier précèdent la pagination des séances sous un budget borné',()=>{
 const q=queue.init({}),base='https://www.deliberations.be/test/decisions/';for(const url of [base+'@@faceted_query?seance=a&b_start=20',base+'19-octobre-2026/etude'])queue.remember(q,'pages',{url,sessionProof:{date:'2026-10-19'}},now);
 assert.match(queue.pendingPages(q,new Set(),now)[0][1].url,/\/etude$/);
 assert.equal(adapter.links('<div class="item-card"><a href="'+base+'19-octobre-2026/travaux"></a><h3 class="card-title">Marché public de travaux de voirie - approbation des conditions</h3></div>',base+'@@faceted_query?seance=a',now).length,0);
});
test('la file active ne comprend pas les archives datées et ne masque pas les dates inconnues',()=>{
 const q=queue.init({});for(const date of ['2022-01-01','2026-10-19','inconnue'])queue.remember(q,'documents',{url:'https://commune.test/pv-'+date+'.pdf'},now);const p=queue.progress(q,{},now);assert.equal(p.documentsPending,2);assert.equal(p.documentsOutOfScope,1);assert.equal(p.documentsKnown,3);
 assert.equal(health.coverage({deliberationSources:[],documentProgress:p}).key,'missing_sources');
});
test('comptes rendus HTML WordPress/Drupal : objet métier dans le corps, date et source réelles',()=>{
 const url='https://commune.test/compte-rendu-19-octobre-2026';
 for(const content of ['<main>BODY</main>','<div class="entry-content">BODY</div>','<div class="field field--name-body">BODY</div>']){
  const html='<h1>Conseil communal du 19 octobre 2026</h1>'+content.replace('BODY','<nav>Marché de services de géomètre ancien</nav><p>13. Désignation d’un géomètre pour le bornage de parcelles - Approbation des conditions.</p>');
  const r=reader.processHTML([],{ins:'62001',name:'Test'},html,url,{},now);assert.equal(r.created,1);assert.equal(r.items[0].sourceDocumentDates.session.date,'2026-10-19');assert.equal(r.items[0].title.includes('bornage'),true);assert.equal(r.items[0].evidence.includes('ancien'),false);
 }
 const html='<meta property="article:published_time" content="2026-10-20T08:00:00Z"><h1>Compte rendu du conseil communal</h1><main><p>Désignation d’un géomètre pour le bornage - Approbation des conditions.</p></main>';
 assert.equal(adapter.read(html,url,{}).dates.document.date,'2026-10-20');
 assert.equal(reader.processHTML([],{ins:'62001',name:'Test'},html.replace('2026-10-20','2022-10-20'),url.replace('19-octobre-2026','sans-date'),{},now).created,0);
});
test('sitemap WordPress : pages institutionnelles avant les vieux billets et doublons de racine',async()=>{
 const d=require('../tools/communes-discovery.cjs'),root='https://commune.test',seen=[];
 const result=await d.sitemapCandidates(root,async url=>{seen.push(url);return {content:url.endsWith('robots.txt')?'Sitemap: '+root+'/wp-sitemap.xml':url.includes('posts-page')?'<loc>'+root+'/conseil-communal/</loc>':'<loc>'+root+'/wp-sitemap-posts-post-1.xml</loc><loc>'+root+'/wp-sitemap-posts-page-1.xml</loc>'}});
 assert(seen.includes(root+'/wp-sitemap-posts-page-1.xml'));assert(result.some(x=>x.url===root+'/conseil-communal/'));
});
test('aucune nouvelle fiche active sans date : conserver le signal PDF à vérifier',()=>{
 const r=reader.processDocument([],{ins:'62001',name:'Test'},{url:'https://commune.test/unknown.pdf',title:'PV'},{bytes:Buffer.from('%PDF-test')},now,()=>"Le Conseil décide de lancer un marché de services de géomètre pour le bornage de parcelles.");
 assert.equal(r.created,0);assert.equal(r.items.length,0);assert(Object.values(r.commune.unclassifiedSignals).flat().some(s=>s.reason==='date_unknown'));
});
test('ne pas confondre mission à prospecter, mission in house et simple approbation de plan',()=>{
 const op=require('../tools/municipal-opportunity.cjs'),types=require('../tools/web-publication-type.cjs'),profile=require('../tools/kdrix-profile.cjs');
 assert.equal(op.assess({title:'Approbation d’un plan de bornage de parcelles privées et publiques'}).eligible,false);
 assert.equal(types.classify('Convention relative aux missions confiées à un opérateur','Les missions confiées à IDELUX concernent une étude hydraulique.').kind,'award');
 assert.equal(profile.screen({title:'Étude de mobilité complémentaire à l’actualisation du Plan de mobilité - Approbation des conditions',source:'LOCALE',region:'Wallonie'}).classification.screening,'review');
 const url='https://www.deliberations.be/test/decisions/19-octobre-2026/etude',html='<h1>Étude archéologique - Marché public de services - Approbation des conditions</h1><div id="content-core"><p>Le Conseil approuve le marché public de services pour une étude archéologique.</p></div>';
 const r=reader.processHTML([],{ins:'62001',name:'Test'},html,url,{sessionProof:{date:'2026-10-19',confidence:'explicit',kind:'session'}},now);assert.equal(r.created,0);assert.equal(r.unclassified.length,1);
});
test('ordre du jour à numéros sans ponctuation : isoler les objets et dédupliquer avec la séance réelle',()=>{
 const dates=require('../document-dates.js'),merge=require('../tools/merge-municipal.cjs');
 const text="Arlon, le 7 octobre 2026\nOrdre du jour du Conseil du 15 octobre 2026\n10 Marché de Travaux : Remplacement du chauffage - Approbation des conditions\n11 Marché de Services : Désignation d'un auteur de projet pour l'entretien extraordinaire\nde trottoirs en 2027 (2028) - Approbation des conditions et du mode de passation\n12 Egouttage - Approbation des décomptes finaux\n13 Marché de Services : Désignation d'un auteur de projet pour l'entretien extraordinaire de voiries - Approbation des conditions";
 const d=dates.extract({text});assert.equal(d.session.date,'2026-10-15');assert.equal(d.document.date,'2026-10-07');const p=reader.passages(text).find(p=>/11 /.test(p.sectionHeading||''));assert(p);assert(!p.excerpt.includes('10 Marché'));assert(!p.excerpt.includes('12 Egouttage'));
 const title=p.sectionHeading.replace(/^11 /,''),m={id:'html',source:'LOCALE',buyer:'Commune de Arlon',title,sourceDocumentDates:d};assert.equal(merge.insert([m],{...m,id:'pdf',title:p.sectionHeading,sourceDocument:'https://commune.test/oj.pdf'}).linked,true);
 assert(!reader.passages('7 Marché de services : Étude hydraulique - Approbation du marché in house\nC.P.A.S. de Test\n8 Démission du président')[0].sectionHeading.includes('C.P.A.S.'));
 const types=require('../tools/web-publication-type.cjs');assert.equal(types.classify('Projet de délibération - Marché de services in house','Les missions confiées à IDELUX concernent une étude.').kind,'other');
});
test('budget expiré : garder la file sans requête ni faux succès',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mr-budget-')),inventoryPath=path.join(dir,'communes.json'),dataPath=path.join(dir,'data.json');fs.writeFileSync(inventoryPath,JSON.stringify({communes:[{ins:'62001',name:'Test',officialSite:'https://commune.test',deliberationSources:[{url:'https://commune.test/conseil',status:'page_accessible'}]}]}));fs.writeFileSync(dataPath,JSON.stringify({items:[{id:'keep'}]}));
 try{const r=await reader.run({inventoryPath,dataPath,deadlineAt:1,quiet:true,now,fetchFn:async()=>{throw Error('Ne doit pas être appelé')}});assert.equal(r.checked,0);const c=JSON.parse(fs.readFileSync(inventoryPath)).communes[0];assert.equal(c.lastDocumentSuccess,undefined);assert.equal(c.documentProgress.pagesPending,1);}finally{fs.rmSync(dir,{recursive:true,force:true})}
});
