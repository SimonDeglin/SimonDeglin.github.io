'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const api=require('../cockpit-v4.js');
const fixture=[
 {id:'c1',source:'TED',noticeType:'cn-standard',screening:'main',deadline:'2026-11-02'},
 {id:'c2',source:'BOSA',noticeKind:'competition',screening:'main',deadline:''},
 {id:'r1',source:'BOSA',noticeKind:'award',deadline:''},
 {id:'l1',source:'LOCALE',screening:'review',deadline:''},
 {id:'l2',source:'LOCALE',screening:'excluded',deadline:''},
 {id:'u1',source:'BOSA',deadline:''}
];
test('une procédure de concurrence n’est pas un résultat, une piste locale n’est pas un appel d’offres',()=>{
 assert.deepEqual(fixture.map(api.kind),['competition','competition','result','prospect','prospect','unknown']);
 assert.equal(api.typeLabel('result'),'Attribution');
 assert.equal(api.matchesType(fixture[0],'result'),false);
 assert.equal(api.matchesType(fixture[2],'competition'),false);
 assert.equal(api.matchesType(fixture[2],'all'),true);
});
test('les compteurs par type ont une définition unique et ne mélangent pas les sources',()=>{
 assert.deepEqual(api.typeCounts(fixture),{all:6,competition:2,result:1,prospect:2,unknown:1});
 const html=api.renderTypeFilters(api.typeCounts(fixture),'competition');
 assert.match(html,/data-publication="competition" aria-pressed="true"/);
 assert.match(html,/Appels d[’']offres/);
 assert.match(html,/v4-type-count">2<\/span>/);
});
test('l’interface ne déclare pas un marché ouvert si l’échéance officielle est inconnue',()=>{
 const preview=api.preview({...fixture[1],title:'Levés',buyer:'Commune'},'Listing complet','unknown');
 assert.match(preview,/Date limite de remise non vérifiée/);
 assert.doesNotMatch(preview,/Remise ouverte officiellement/);
 assert.match(api.preview({...fixture[2],title:'Attribution'},'Listing complet','unknown'),/aucune soumission à préparer sur cet avis/);
 assert.match(api.preview({...fixture[3],title:'Conseil communal'},'Listing complet','open'),/aucune procédure ouverte confirmée/);
});
test('les métriques restent explicites et ne présentent pas les avis de résultat comme offres à remettre',()=>{
 const statuses={c1:'answer'},stage=id=>statuses[id]||'inbox';
 const due=m=>m.deadline?'open':'unknown',days=deadline=>deadline?6:null;
 const m=api.metrics(fixture,stage,due,days);
 assert.equal(m.unclassified,1);
 assert.equal(m.nearDeadline,1);
 assert.equal(m.unknownDeadline,1);
 assert.equal(m.awards,1);
 assert.equal(m.localProspects,1);
 const html=api.renderCockpit(m);
 assert.match(html,/data-cockpit="competition"/);
 assert.match(html,/data-cockpit="result"/);
 assert.match(html,/Dates à vérifier/);
});
test('protéger le HTML contre l’injection et ne jamais créer de lien vide',()=>{
 const preview=api.preview({id:'x" onclick="evil()',title:'<img src=x onerror=alert(1)>',source:'BOSA',buyer:'<script>alert(1)</script>'},'Listing complet','unknown');
 assert(preview.includes('&lt;img src=x'));
 assert(!preview.includes('<script>'));
 assert(!preview.includes('<img'));
 assert(!preview.includes('data-id="x" onclick="evil()'));
});
test('base réelle : distinguer les avis de concurrence, résultats et veille communale',()=>{
 const data=require('../data.json');
 assert(data.items.length>=64,'Les marchés déjà présents ne doivent pas disparaître');
 const grouped=api.typeCounts(data.items);
 assert(grouped.competition>0);
 assert(grouped.result>0);
 assert(grouped.prospect>0);
 assert.equal(grouped.all,data.items.length);
});

test('les hors sujet ne gonflent pas les compteurs commerciaux du cockpit',()=>{
 const stage=id=>id==='r1'||id==='l1'?'irrelevant':'inbox';
 const metrics=api.metrics(fixture,stage,m=>m.deadline?'open':'unknown',deadline=>deadline?3:null);
 assert.equal(metrics.total,4);
 assert.equal(metrics.awards,0);
 assert.equal(metrics.localProspects,0);
 assert.equal(metrics.unclassified,2);
});
test('lecture rapide riche, note métier échappée et décision réversible',()=>{
 const market={...fixture[0],title:'Levé topographique Hannut',buyer:'Commune de Hannut',description:'Levés détaillés, dix profils en travers et plan altimétrique pour travaux de voirie.',sectors:['Topo','VRD']};
 const preview=api.preview(market,'À définir','open',{notes:'À confirmer <img src=x onerror=alert(1)>'});
 assert.match(preview,/Objet de la mission/);
 assert.match(preview,/dix profils en travers/);
 assert.match(preview,/Commune de Hannut/);
 assert.match(preview,/Topo · VRD/);
 assert.match(preview,/quickOpenTender/);
 assert.match(preview,/quickDismissTender/);
 assert.match(preview,/Écarter : Hors sujet/);
 assert(preview.includes('&lt;img src=x'));
 assert(!preview.includes('<img src=x'));
 const archived=api.preview(market,'Hors sujet','open',{horsSujet:true});
 assert.match(archived,/Réintégrer au listing/);
});
test('le résumé documentaire reste une extraction automatique non certifiée',()=>{
 const market={...fixture[0],documentInventory:[{documentId:'doc',versionId:'version'}],
  documentAnalyses:[{documentId:'doc',versionId:'version',fileName:'CCH.pdf',evidence:[{kind:'visit',page:8,excerpt:'La visite est recommandée, pas forcément obligatoire.'}]}]};
 const html=api.preview(market,'Listing complet','unknown');
 assert.match(html,/Passages repérés automatiquement — à vérifier/);
 assert.match(html,/CCH.pdf · p. 8/);
 assert.match(html,/La visite est recommandée/);
 assert.doesNotMatch(api.preview({...market,documentInventory:[]},'Listing complet','unknown'),/La visite est recommandée/);
});

test('date BOSA sourcée visible avec heure CET et lien officiel',()=>{
 const m={...fixture[1],id:'bosa:7f4255eb-6857-4d85-85e5-4aac8b0fe4e8',
  deadline:'2026-11-16T10:00:00+01:00',deadlineTime:'10:00',
  deadlineSourceKind:'bosa_verified_public',
  deadlineSourceUrl:'https://www.publicprocurement.be/publication-workspaces/7f4255eb-6857-4d85-85e5-4aac8b0fe4e8/general'};
 const html=api.preview(m,'Listing complet','open');
 assert.match(html,/16\/11\/2026 à 10:00 CET/);
 assert.match(html,/Échéance vérifiée dans e-Procurement/);
 assert.match(html,/Contrôler l’heure et les éventuels rectificatifs/);
 assert.doesNotMatch(api.preview({...m,deadlineSourceUrl:'javascript:alert(1)'},'Listing complet','open'),/Échéance vérifiée dans e-Procurement/);
});
