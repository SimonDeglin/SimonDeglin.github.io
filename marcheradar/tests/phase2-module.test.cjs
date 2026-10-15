/* MarchéRadar — Phase 2 : tests unitaires de fiabilité documentaire.
 * Aucun test ne prétend avoir téléchargé les cahiers des charges réels.
 */
'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const api=require('../detail-phase2.js');
const real=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../data.json'),'utf8'));
function market(overrides){return {id:'test:01',title:'Marché topo',source:'TED',screening:'main',publication:'2026-10-10',deadline:'2026-10-22',description:'Levé topographique',region:'Wallonie',cpv:['71351810'],...overrides}}
test('les 64 fiches sont intactes et la structure de la Phase 2 est disponible',()=>{
 assert(real.items.length>=64,'Au minimum 64 marchés historiques doivent être conservés');
 assert.equal(real.items.filter(m=>m.source==='TED').length,14);
 assert.equal(real.items.filter(m=>m.source==='BOSA').length,16);
 assert.equal(real.items.filter(m=>m.source==='LOCALE').length,34);
 assert.equal(typeof api.render,'function');
});
test('aucune visite obligatoire ne peut être inférée du seul avis ou du texte',()=>{
 const raw=market({constraints:['Visite obligatoire annoncée le 06/10/2026 — à confirmer']});
 const v=api.visitState(raw);
 assert.equal(v.kind,'review');
 assert.match(api.render(raw).html,/Mention de visite à vérifier/);
 assert.doesNotMatch(api.render(raw).html,/Visite obligatoire \(source documentée\)/);
 assert.equal(api.visitState(market()).kind,'unknown');
});
test('visite structurée: présence obligatoire des preuves avant déclaration officielle',()=>{
 const m=market({visit:{status:'required',verified:true,date:'2026-10-20',time:'09:00',place:'Rue des Tests',
  sourceUrl:'https://www.publicprocurement.be/publication-workspaces/123/general',page:15,
  evidence:'La visite des lieux est obligatoire avant remise de l’offre.'}});
 assert.equal(api.visitState(m).kind,'required');
 assert.match(api.render(m).html,/Visite obligatoire \(source documentée\)/);
 assert.match(api.render(m).html,/page 15/);
 delete m.visit.evidence;
 assert.equal(api.visitState(m).kind,'review');
});
test('documents et sources sont uniquement des liens existants, différenciés',()=>{
 const m=market({
  url:'https://ted.europa.eu/fr/notice/-/detail/702319-2026',
  officialSources:[{source:'BOSA',url:'https://www.publicprocurement.be/publication-workspaces/xyz/general'}],
  documents:[{type:'csc',url:'https://www.publicprocurement.be/files/notice-csc.pdf',title:'CSC renseigné'},
    {type:'annexe',url:'javascript:alert(1)',title:'Attaque'}]
 });
 const items=api.sources(m),html=api.render(m).html;
 assert.equal(items.length,3);
 assert.equal(items.filter(x=>x.kind==='document').length,1);
 assert.match(html,/CSC renseigné/);
 assert.doesNotMatch(html,/javascript:/);
 assert.match(html,/Portail officiel — annexes à consulter sur place/);
 const missing=api.render(market()).html;
 assert.match(missing,/Aucun fichier de marché indexé/);
 assert.doesNotMatch(missing,/href=""/);
});
test('sécurité: contenu non fiable échappé, protocoles dangereux refusés',()=>{
 const m=market({title:'<img src=x onerror=alert(1)>',buyer:'<script>alert(2)</script>',description:'<b>Injection</b>',
 documents:[{url:'data:text/html,<script>alert(3)</script>',title:'n/a'},
 {url:'https://example.com/x" onclick="alert(1)',title:'test'}]});
 const rendered=api.render(m).html;
 assert.ok(!rendered.includes('<img'));
 assert.ok(!rendered.includes('<script'));
 assert.ok(!rendered.includes('onerror=alert(1)>'));
 assert.equal(api.linkUrl('javascript:alert(1)'), '');
 assert.equal(api.linkUrl('data:text/html,evil'),'');
 assert.equal(api.linkUrl('https://u:p@example.com/file'),'');
 assert.match(rendered,/&lt;img/);
});
test('échéances dans le fuseau de Bruxelles, sans inventer d’heure',()=>{
 const now=new Date('2026-10-15T10:00:00Z');
 assert.equal(api.status(market({deadline:'2026-10-16'}),now).kind,'open');
 assert.equal(api.status(market({deadline:'2026-10-14'}),now).kind,'closed');
 assert.equal(api.status(market({deadline:'2026-10-15'}),now).kind,'open');
 assert.equal(api.status(market({deadline:''}),now).kind,'unknown');
 assert.equal(api.status(market({source:'LOCALE',deadline:''}),now).kind,'prospect');
 assert.equal(api.status(market({source:'LOCALE',deadline:'',screening:'excluded'}),now).kind,'unknown');
 assert.equal(api.status(market({noticeKind:'award',deadline:''}),now).kind,'result');
 assert.equal(api.status(market({deadline:'2026-10-15T09:30:00Z'}),now).kind,'closed');
 assert.equal(api.status(market({deadline:'2026-10-15T13:30:00Z'}),now).kind,'open');
 assert.equal(api.status(market({deadline:'2026-10-15T15:30'}),now).kind,'unknown');
 const r=api.render(market({deadline:'2026-10-30',deadlineTime:'09:30'})).html;
 assert.match(r,/heure signalée 09:30 \(à confirmer\)/);
 assert.match(r,/L’heure limite n’est pas présente dans les données/);
});
test('BOSA/TED et sources locales réelles: distinction des types de liens',()=>{
 const bosa=real.items.find(m=>m.source==='BOSA'&&m.noticeKind==='award');
 const ted=real.items.find(m=>m.source==='TED');
 const local=real.items.find(m=>m.source==='LOCALE'&&m.sourceDocument);
 assert.ok(bosa&&ted&&local);
 assert.equal(api.render(bosa).status.kind,'result');
 assert.match(api.render(bosa).html,/Avis de résultat/);
 assert.equal(api.primarySource(bosa).kind,'notice');
 assert.equal(api.primarySource(ted).kind,'notice');
 assert.equal(api.primarySource(local).kind,'council');
 assert.match(api.render(local).html,/Il ne s’agit pas nécessairement d’un appel d’offres ouvert/);
});
