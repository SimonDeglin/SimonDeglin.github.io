'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const reader=require('../tools/communes-documents.cjs'),dates=require('../document-dates.js'),policy=require('../tools/communal-source-policy.cjs'),merge=require('../tools/merge-municipal.cjs');
const fixture=n=>fs.readFileSync(path.join(__dirname,'fixtures',n),'utf8');
const title='PST 2025-2030 (Action 11) - Rénovation du cimetière des Tapeines - Étude - Marché public de services - Fixation des conditions et choix du mode de passation.';
const url='https://www.deliberations.be/flemalle/decisions/19-octobre-2026-19-30/pst-2025-2030-action-11-renovation-du-cimetiere-des-tapeines-etude-marche-public-de-services-fixation-des-conditions-et-choix-du-mode-de-passation';
const now='2026-11-02T12:00:00Z';
test('Flémalle : PST concret autorisé, programme général exclu',()=>{
 assert.equal(policy.excluded({title,url}),null);assert.equal(policy.excluded({title:'PST 2025-2030',url:'https://commune.test/pst-2025-2030.pdf'}),null);assert.equal(policy.excluded({url:'https://commune.test/conseil/archives-2024'}),null);
});
test('invitation : séance réelle, titre sur deux lignes, nomination des agents rejetée',()=>{
 const txt=fixture('flemalle-20261019-oj.txt');assert.equal(dates.extract({text:txt}).session.date,'2026-10-19');assert.equal(dates.extract({text:txt}).document.date,'2026-10-14');
 const p=reader.passages(txt);assert(p.some(p=>/Tapeines/.test(p.sectionHeading)&&/de services/.test(p.sectionHeading)));assert(!p.some(p=>/36\./.test(p.sectionHeading||'')));
});
test('décision réelle : étude funéraire à qualifier, projet et procédure conservés',()=>{
 const r=reader.processHTML([],{ins:'62120',name:'Flémalle'},fixture('flemalle-tapeines.html'),url,{},now);assert.equal(r.created,1);const m=r.items[0];assert.equal(m.screening,'review');assert.equal(m.sourceDocumentDates.session.date,'2026-10-19');assert.equal(m.municipalProcedure.stage,'project');assert.match(m.municipalProcedure.label,/sans publication préalable/);assert.equal(m.noticeKind,'prospection');
 const html='<h1>'+title+'</h1><div id="content-core"><p>Projet de décision. Marché public de services : étude de rénovation du cimetière. Vu les règles relatives à la procédure négociée sans publication préalable.</p></div>';
 assert.equal(require('../tools/communal-html.cjs').read(html,url,{}).procedure,null);
});
test('même objet, commune et séance : PDF et HTML joints sans doubler le dossier',()=>{
 const a={id:'html',source:'LOCALE',buyer:'Commune de Flémalle',title,sourceDocument:url,sourceDocumentDates:{session:{date:'2026-10-19'}}};
 const b={...a,id:'pdf',title:'13. '+title,sourceDocument:'https://www.flemalle.be/oj.pdf'};
 const r=merge.insert([a],b);assert.equal(r.linked,true);assert.equal(r.items.length,1);assert.equal(r.items[0].municipalNotices.length,1);
 assert.equal(merge.insert([a],{...b,buyer:'Commune de Hannut'}).linked,false);assert.equal(merge.insert([a],{...b,sourceDocumentDates:{session:{date:'2026-09-21'}}}).linked,false);
});
test('collecte de bout en bout : page communale → séance → décision, PDF lié une seule fois',async()=>{
 const os=require('node:os'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'radar-flemalle-'));
 const root='https://www.flemalle.be/conseil',portal='https://www.deliberations.be/flemalle/decisions',pdf=root+'/oj-19-octobre-2026.pdf',uid='a'.repeat(32),query=portal+'/@@faceted_query?seance='+uid+'&b_start=0';
 const pages=new Map([[root,'<a href="'+portal+'">Projets de délibérations</a><a href="'+pdf+'">Ordre du jour</a>'],[portal,'<select name="seance"><option value="'+uid+'">19 Octobre 2026 (19:30)</option></select>'],[query,'<div class="item-card"><a href="'+url+'"></a><h3 class="card-title">'+title+'</h3></div>'],[url,fixture('flemalle-tapeines.html')],[pdf,'%PDF-test']]);
 const dataPath=path.join(dir,'data.json'),inventoryPath=path.join(dir,'communes.json');
 fs.writeFileSync(dataPath,JSON.stringify({items:[]}));fs.writeFileSync(inventoryPath,JSON.stringify({communes:[{ins:'62120',name:'Flémalle',officialSite:root,deliberationSources:[{url:root,status:'page_accessible'}]}]}));
 try{
  const r=await reader.run({ins:'62120',dataPath,inventoryPath,quiet:true,now,maxPages:8,maxDocuments:2,extract:()=>fixture('flemalle-20261019-oj.txt'),fetchFn:async u=>{assert(pages.has(u),'URL inattendue '+u);return new Response(pages.get(u))}});
  assert.equal(r.opportunities,1);assert.equal(r.errors,0);const items=JSON.parse(fs.readFileSync(dataPath)).items;assert.equal(items.length,1);assert.equal(items[0].municipalNotices.length,1);assert.equal(items[0].municipalNotices[0].sourceDocumentDates.document.date,'2026-10-14');assert.match(require('../detail-phase2.js').sources(items[0]).find(x=>x.url===pdf).meta,/14\/10\/2026/);
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
test('variantes réelles : étude de tronçons de route et honoraires d’auteur de projet',()=>{
 for(const name of ['grandroute','ramet']){
  const url='https://www.deliberations.be/flemalle/decisions/21-septembre-2026/'+name;
  const r=reader.processHTML([],{ins:'62120',name:'Flémalle'},fixture('flemalle-'+name+'.html'),url,{},now);assert.equal(r.created,1,name);assert.equal(r.items[0].screening,'review');
 }
 const assess=require('../tools/municipal-opportunity.cjs').assess;
 assert.equal(assess({title:'Réfection de tronçons de route - Marché public de travaux - Fixation des conditions'}).eligible,false);
 assert.equal(assess({title:'Honoraires supplémentaires - Marché public de services d’études'}).eligible,false);
});
