'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const bosa=require('../tools/bosa-public.cjs'),ted=require('../tools/collect-ted.cjs');
const view=require('../cockpit-v4.js'),profile=require('../tools/kdrix-profile.cjs');
const {extractPassages}=require('../tools/csc-evidence.cjs');
const item=(id,more={})=>({id,title:'Mission de topographie',buyer:'Commune A',source:'BOSA',internalReference:'2026-01',sector:'Topo',sectors:['Topo'],score:80,publication:'2026-10-01',...more});
test('BOSA : une référence interne de deux acheteurs ne fusionne jamais leurs décisions',()=>{
 const old=item('old'),other=item('new',{buyer:'Commune B'});
 assert.equal(bosa.merge([old],[other]).length,2);
 assert.equal(bosa.merge([old],[{...other,buyer:''}]).length,2);
 assert.equal(bosa.merge([old],[item('revision')])[0].id,'old');
});
test('BOSA : procédures explicites distinctes et référence ambiguë restent séparées',()=>{
 assert.equal(bosa.merge([item('a',{procedureIdentifier:'p1'})],[item('b',{procedureIdentifier:'p2'})]).length,2);
 const old=[item('a'),item('b')];
 assert.equal(bosa.merge(old,[item('c')]).length,3);
});
test('TED/BOSA : un identifiant connu prime sur les autres rapprochements ; collecte idempotente',()=>{
 const old=[item('a',{procedureIdentifier:'p'}),item('b',{procedureIdentifier:'p'})];
 for(const merge of [bosa.merge,ted.combine]){
  const once=merge(old,[item('a',{procedureIdentifier:'p',publication:'2026-10-28'})]);
  assert.equal(once.length,2);
  assert.equal(once.find(m=>m.id==='a').publication,'2026-10-28');
  assert.deepEqual(merge(once,[item('a',{procedureIdentifier:'p',publication:'2026-10-28'})]).map(x=>x.id).sort(),['a','b']);
 }
});
test('rectificatifs successifs : conserver ID, pièces et analyses du dossier suivi',()=>{
 const original=item('stable',{procedureIdentifier:'p',documentAnalyses:[{sha256:'proof'}],documentInventory:[{documentId:'d'}]});
 let merged=[original];
 for(let n=1;n<=3;n++)merged=bosa.merge(merged,[item('new-'+n,{procedureIdentifier:'p',publication:'2026-10-2'+n})]);
 assert.equal(merged.length,1);assert.equal(merged[0].id,'stable');
 assert.deepEqual(merged[0].documentAnalyses,original.documentAnalyses);
});
test('prestations wallonnes explicites conservées même si l’acheteur a son siège en Flandre',()=>{
 assert(profile.screen(item('a',{region:'Wallonie',buyer:'Vlaamse Overheid'})).classification);
 assert.equal(profile.screen(item('a',{region:'Flandre',buyer:'Vlaamse Overheid'})).classification,null);
});
test('analyse : références, contraintes et livrables disposent chacun d’un extrait, sans validation inventée',()=>{
 const text='Les références similaires sont exigées. Le système de coordonnées est Lambert 2008. Les livrables comprennent un nuage de points. Le critère d’attribution est le prix. '.repeat(5);
 const e=extractPassages(text);
 for(const kind of ['references','constraints','deliverables','award'])assert(e.some(x=>x.kind===kind),kind);
 assert(e.every(x=>x.reviewStatus==='to_verify'));
 const m=item('a',{documentInventory:[{documentId:'d',versionId:'v'}],documentAnalyses:[{documentId:'d',versionId:'v',fileName:'CSC.pdf',evidence:e}]});
 const html=view.analysisChecklist(m);
 assert.match(html,/CSC.pdf/);assert.match(html,/Références exigées/);assert.match(html,/Non documenté/);
 assert.doesNotMatch(view.analysisChecklist({...m,documentInventory:[]}),/Lambert 2008/);
});

test('base réelle : requalification et recollectes conservent tous les identifiants historiques',()=>{
 const items=require('../data.json').items;
 const ids=items.map(m=>m.id).sort();
 assert.equal(new Set(ids).size,items.length);
 assert.deepEqual(ted.cleanPrevious(items).items.map(m=>m.id).sort(),ids);
 assert.deepEqual(bosa.merge(items,items).map(m=>m.id).sort(),ids);
 assert.deepEqual(ted.combine(items,items).map(m=>m.id).sort(),ids);
});
