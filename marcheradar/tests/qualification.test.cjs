'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),profile=require('../tools/kdrix-profile.cjs');
const q=require('../qualification.js'),{requalify}=require('../tools/requalify.cjs');
const item=(title,more={})=>({title,description:title,region:'Wallonie',buyer:'Commune de test',source:'BOSA',cpv:[],...more});
test('auteur de projet architectural : rester consultable sans fausse qualification VRD prioritaire',()=>{
 const m=item('Mission complète d’auteur de projet pour la restauration d’une église');
 const c=profile.screen(m).classification;assert.equal(c.screening,'review');assert.equal(c.sector,'Qualif');assert(!c.sectors.includes('VRD'));assert(c.score<75);assert.equal(c.qualification.route,'partner');
 const topo=profile.screen(item(m.title,{description:'Une mission complète avec relevés topographiques des façades et plans.'})).classification;
 assert(topo.sectors.includes('Topo'));assert(!topo.sectors.includes('VRD'));assert.equal(topo.screening,'review');
});
test('travaux avec topo accessoire : ne pas confondre marché de travaux et commande de géomètre',()=>{
 for(const cpv of [[],['45233120']]){
  const c=profile.screen(item('Travaux de réfection de voirie avec relevés topographiques',{cpv})).classification;
  assert(c.sectors.includes('Topo'));assert.equal(c.screening,'review');assert.equal(c.qualification.kind,'works');assert.equal(c.qualification.route,'ancillary');assert(c.score<=60);
 }
 const c=profile.screen(item('Étude et réalisation d’une voirie avec relevés topographiques',{cpv:['45000000']})).classification;
 assert.equal(c.qualification.kind,'mixed');assert.equal(c.screening,'review');
});
test('les missions métier explicites et les petits travaux hydrométriques gardent leurs règles',()=>{
 for(const [title,sector] of [['Prestations de géomètre pour divisions parcellaires','Foncier'],['Levés topographiques et bathymétriques des cours d’eau','Hydro'],['Inventaire géoréférencé et cartographie SIG','Carto'],['Réalisation de certificats PEB','PEB'],['Mission d’auteur de projet pour aménagement de voirie','VRD']]){
  const c=profile.screen(item(title)).classification;assert(c.sectors.includes(sector),title);assert.equal(c.screening,'main',title);assert.equal(c.qualification.capacityStatus,'not_assessed');
 }
 const c=profile.screen(item('Travaux d’aménagement des accès aux stations limnimétriques',{cpv:['45000000']})).classification;
 assert(c.sectors.includes('PetitsTravaux'));assert.equal(c.qualification.route,'small_works');assert.equal(c.screening,'main');
});
test('prospection et motifs d’exclusion restent distincts de l’admissibilité ; échappement du texte',()=>{
 const c=profile.screen(item('Le conseil approuve la désignation d’un géomètre',{source:'LOCALE'})).classification;
 assert.equal(c.screening,'review');assert.equal(c.qualification.kind,'prospect');
 const html=q.render({qualification:{kind:'services',route:'service',explanation:'<img onerror=evil()>'}});assert(!html.includes('<img'));assert(html.includes('&lt;img'));
 assert.match(q.render({screening:'excluded',screeningReason:'travaux_execution'}),/sans prestation KDRIX/);
});
test('requalifier les données réelles ne change que les champs de classement et préserve toutes les pièces et échéances',()=>{
 const data=require('../data.json'),before=JSON.stringify(data),result=requalify(data).data;
 assert.equal(JSON.stringify(data),before);assert.deepEqual(result.items.map(m=>m.id),data.items.map(m=>m.id));
 const allowed=new Set(['sector','sectors','score','screening','screeningReason','matchReason','qualification']);
 const without=m=>Object.fromEntries(Object.entries(m).filter(([k])=>!allowed.has(k)));
 assert.deepEqual(result.items.map(without),data.items.map(without));
 const {items:a,...old}=data,{items:b,...next}=result;assert.deepEqual(next,old);
 assert.deepEqual(requalify(result).data,result,'Requalification idempotente');
});

test('les mots partiels et implantations scolaires ou commerciales ne deviennent pas des métiers géomètres',()=>{
 assert.equal(profile.screen(item('Concession pour l’exploitation du site de Falemprise')).classification,null,'Falemprise ne signifie pas emprise');
 assert.equal(profile.screen(item('Mission complète de déménagement')).classification,null,'Déménagement ne signifie pas aménagement');
 const study=profile.screen(item('Accord-cadre de services pour les implantations commerciales dans les schémas de développement communal')).classification;
 assert.equal(study.screening,'review');assert.equal(study.sector,'Qualif');assert(!study.sectors.includes('Implant'));
 const architecture=profile.screen(item('Mission d’auteur de projet pour les écoles communales',{description:'Le projet concerne deux implantations scolaires.'})).classification;
 assert(!architecture.sectors.includes('Implant'));
 assert(profile.screen(item('Levé aérophotogrammétrique par photogrammétrie')).classification);
 assert(profile.screen(item('Mission de précadastration')).classification?.sectors.includes('Foncier'));
});
