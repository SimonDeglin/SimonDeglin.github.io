'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const reader=require('../tools/communes-documents.cjs'),adapter=require('../tools/communal-html.cjs'),op=require('../tools/municipal-opportunity.cjs'),q=require('../tools/municipal-queue.cjs');
const now='2026-11-02T12:00:00Z',commune={ins:'62001',name:'Test',officialSite:'https://commune.test'},url='https://www.deliberations.be/test/decisions/19-octobre-2026/point-17';
const body='Le Conseil décide de consulter un prestataire externe pour effectuer le relevé topographique et le bornage des parcelles communales.';
function html(title,text=body){return '<h1>'+title+'</h1><span class="meeting-title">19 Octobre 2026</span><div id="content-core"><p>'+text+'</p></div>'}
test('intitulé neutre : le besoin du corps du texte détermine la détection et son titre sourcé',()=>{
 for(const title of ['Point 17','Document 123','Dossier n° 2026/42 — Approbation']){
  const r=reader.processHTML([],commune,html(title),url,{},now);assert.equal(r.created,1,title);const m=r.items[0];assert.equal(m.sourceDocumentTitle,title);assert.match(m.title,/consulter.*relevé topographique/);assert.equal(m.municipalAssessment.basis,'document_body');assert(m.missionEvidence.excerpt.includes('bornage'));assert.equal(m.sourceDocumentDates.session.date,'2026-10-19');
 }
});
test('aucun filtre métier sur les titres des décisions avant téléchargement',()=>{
 const root='https://www.deliberations.be/test/decisions/',query=root+'@@faceted_query?seance=a';
 const links=adapter.links(['Point 17','Document 123','Marché public de travaux','Règlement intérieur'].map((t,i)=>'<div class="item-card"><a href="'+root+'19-octobre-2026/point-'+i+'"></a><h3 class="card-title">'+t+'</h3></div>').join(''),query,now,{sessionProof:{date:'2026-10-19'}});
 assert.equal(links.length,4);assert(links.every(x=>x.sessionProof.date==='2026-10-19'));
});
test('document HTML au titre neutre suivi depuis le contenu du conseil, menu et tiers écartés',()=>{
 const source='https://commune.test/conseil',pages=reader.childPages('<nav><a href="/annuaire">Annuaire</a></nav><main><a href="/publications/doc123">Document 123</a><a href="https://tiers.test/doc">Document externe</a><a href="/">Accueil</a></main>',source);assert.deepEqual(pages,['https://commune.test/publications/doc123']);
 const r=reader.processHTML([],commune,'<h1>Document 123</h1><main><p>Séance du 19 octobre 2026</p><p>'+body+'</p></main>','https://commune.test/publications/doc123',{documentCandidate:true},now);assert.equal(r.created,1);
});
test('un mot métier ne suffit pas : ancienne prestation, citation légale, négation et achat sans mission',()=>{
 for(const text of ["Vu la loi concernant les marchés publics de services de géomètre. Le Conseil approuve le règlement intérieur.","Le plan a déjà été établi par un géomètre. Le Conseil approuve l’achat de mobilier.","Le Conseil décide de ne pas consulter un géomètre pour le bornage.","Le Conseil approuve le plan de mesurage établi par le géomètre en 2020.","Le Conseil décide de ne pas lancer un marché public de services de géomètre.","L’entrepreneur devra désigner un géomètre pour réaliser les implantations du chantier."]){assert.equal(reader.processHTML([],commune,html('Point 17',text),url,{},now).created,0,text);}
});
test('la lecture continue après les six premiers points : une mission tardive du PDF est retenue',()=>{
 const old=Array.from({length:12},(_,i)=>`${i+1}. Approbation du plan de mesurage déjà réalisé\nLe Conseil approuve le plan établi par le géomètre en 2020.`).join('\n');
 const text='Séance du 19 octobre 2026\n'+old+'\n17. Point divers\n'+body;
 const r=reader.processDocument([],commune,{url:'https://commune.test/document123.pdf',title:'Document 123'},{bytes:Buffer.from('%PDF-fixture')},now,()=>text);assert.equal(r.created,1);assert.match(r.items[0].title,/consulter/);assert.equal(r.items[0].missionEvidence.page,1);assert.equal(r.items[0].sourceDocumentTitle,'Document 123');
});
test('un document connu garde son identité et son classement après amélioration de la lecture',()=>{
 const first=reader.processHTML([],commune,html('Point 17'),url,{},now).items[0],prior={...first,screening:'excluded',notes:'Garder mon classement'};
 const result=reader.processHTML([prior],commune,html('Point 17',body+' Un complément administratif.'),url,{},now);assert.equal(result.created,0);assert.equal(result.items.length,1);assert.equal(result.items[0].id,prior.id);assert.equal(result.items[0].screening,'excluded');assert.equal(result.items[0].notes,prior.notes);
});
test('les documents opaques non lus ne sont pas affamés par les anciens liens aux titres explicites',()=>{
 const queue=q.init({});q.remember(queue,'pages',{url:'https://www.deliberations.be/test/decisions/19-octobre-2026/etude',sessionProof:{date:'2026-10-19'},lastSuccess:now,pipelineVersion:'current'},now);q.remember(queue,'pages',{url:'https://commune.test/publications/document123',documentCandidate:true},now);
 assert.match(q.pendingPages(queue,new Set(),now,{version:'current'})[0][1].url,/document123/);
 q.remember(queue,'documents',{url:'https://commune.test/pv-2026-10-19.pdf'},now);q.remember(queue,'documents',{url:'https://commune.test/doc123.pdf'},now);const old=q.key('https://commune.test/pv-2026-10-19.pdf');assert.match(q.pendingDocuments(queue,{[old]:{lastSuccess:now,sha256:'ok',extractorVersion:'current'}},now,{version:'current'})[0][1].url,/doc123/);
});
test('parcours complet : un lien « Point 17 » mène à une mission publiée sur preuve du contenu',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mr-content-flow-')),inventoryPath=path.join(dir,'communes.json'),dataPath=path.join(dir,'data.json'),root='https://commune.test/conseil',portal='https://www.deliberations.be/test/decisions',uid='a'.repeat(32),query=portal+'/@@faceted_query?seance='+uid+'&b_start=0',seen=[];
 fs.writeFileSync(inventoryPath,JSON.stringify({communes:[{...commune,deliberationSources:[{url:root,status:'page_accessible'}]}]}));fs.writeFileSync(dataPath,JSON.stringify({items:[{id:'history'}]}));
 const pages=new Map([[root,'<a href="'+portal+'">Délibérations du conseil</a>'],[portal,'<select name="seance"><option value="'+uid+'">19 Octobre 2026</option></select>'],[query,'<div class="item-card"><a href="'+url+'"></a><h3 class="card-title">Point 17</h3></div>'],[url,html('Point 17')]]);
 try{
  const report=await reader.run({inventoryPath,dataPath,ins:commune.ins,now,quiet:true,extract:()=>'',maxPages:8,fetchFn:async u=>{seen.push(u);assert(pages.has(u),'Requête inattendue '+u);return new Response(pages.get(u))}});
  assert(seen.includes(url));assert.equal(report.errors,0);assert.equal(report.opportunities,1);const d=JSON.parse(fs.readFileSync(dataPath));assert.equal(d.items.length,2);assert.equal(d.items[0].id,'history');assert.match(d.items[1].title,/relevé topographique/);assert.equal(d.items[1].missionEvidence.sourceUrl,url);
  const c=JSON.parse(fs.readFileSync(inventoryPath)).communes[0];assert.equal(c.htmlDocumentChecks[reader.documentId(url)].analysis.basis,'document_content');
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
