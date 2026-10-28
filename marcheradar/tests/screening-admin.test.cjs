'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const profile=require('../tools/kdrix-profile.cjs');
const collector=require('../tools/collect-ted.cjs');
const market=(title,description)=>({id:'stable',title,description,region:'Wallonie',source:'BOSA',buyer:'Commune A',cpv:[]});
test('une formule administrative seule ne qualifie ni un titre ni une description en VRD',()=>{
 for(const m of [
  market('MERCEDES GLA','Le présent cahier spécial des charges porte sur un contrat de leasing.'),
  market('Mission de reprise du CRM','Le cahier spécial des charges décrit les prestations.'),
  market('Marché stock catalogue de vêtements de travail','Le cahier spécial des charges définit les conditions.'),
  market('Cahier spécial des charges — accès Internet','Abonnement et accès Internet'),
  market('Cahier spécial des charges',''),
  market('Contrôle des installations électriques','Le CAHIER SPÉCIAL DES CHARGES est annexé.')
 ]){
  assert.deepEqual(profile.screen(m),{reason:'formule_administrative_sans_signal_metier',classification:null});
 }
});
test('les signaux métier distincts restent valables en présence de la formule administrative',()=>{
 for(const [title,description,sector] of [
  ['Mission de géomètre','Cahier spécial des charges pour divisions parcellaires.','Topo'],
  ['Cahier spécial des charges : levés topographiques','Mesurage et plans.','Topo'],
  ['Mission d’auteur de projet de voirie','Cahier spécial des charges.','VRD'],
  ['Études préalables à la nouvelle voirie','Cahier spécial des charges.','VRD'],
  ['Certification PEB','Le cahier spécial des charges prévoit des certificats de performance énergétique.','PEB'],
  ['GIS','Cahier spécial des charges.','Carto']
 ])assert(profile.screen(market(title,description)).classification?.sectors.includes(sector),title);
 const local={...market('Projet de réaménagement de la place communale','Le conseil approuve le projet. Cahier spécial des charges.'),source:'LOCALE'};
 assert.equal(profile.screen(local).classification?.screening,'review');
});
test('la requalification conserve le dossier, son identité et les preuves sans toucher au suivi utilisateur',()=>{
 const m={...market('MERCEDES GLA','Contrat de leasing : cahier spécial des charges.'),
  screening:'review',sector:'VRD',notes:'Suivi existant',documentAnalyses:[{sha256:'preuve'}],noticeNumbers:['2026-1']};
 const input=JSON.stringify(m),result=collector.cleanPrevious([m]).items;
 assert.equal(JSON.stringify(m),input);
 assert.equal(result.length,1);assert.equal(result[0].id,m.id);
 assert.equal(result[0].screening,'excluded');
 assert.equal(result[0].screeningReason,'formule_administrative_sans_signal_metier');
 const {screening,screeningReason,...rest}=result[0];
 const {screening:oldScreening,...before}=m;
 assert.deepEqual(rest,before);
});
