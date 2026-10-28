'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const api=require('../followup-backup.js');
const key='kdrix.marcheRadar.v1';
function state(more={}){return {statuses:{},notes:{},favorites:{},hiddenSectors:{},...more}}
function storage(value){const data=new Map(value===undefined?[]:[[key,JSON.stringify(value)]]);return {getItem:k=>data.has(k)?data.get(k):null,setItem:(k,v)=>data.set(k,String(v)),data}}
test('sauvegarde restaurable : préserver Hors sujet, favoris, notes et métiers y compris dossiers absents de la collecte',()=>{
 const original=state({statuses:{historique:'irrelevant',restaure:'inbox'},notes:{historique:'Note <script> privée & précise'},favorites:{historique:true,restaure:false},hiddenSectors:{PEB:true,Topo:false}});
 const backup=api.parse(api.serialize(original,'2026-10-28T10:00:00Z'));
 assert.deepEqual(backup.state,original);
 assert.deepEqual(api.merge(state(),backup.state,'keep').state,original);
 assert.equal(api.summary(backup.state).markets,2);
});
test('restauration par défaut : ne pas écraser notes ou décisions présentes, ajouter les absentes',()=>{
 const local=state({statuses:{a:'irrelevant'},notes:{a:'Note récente'},favorites:{a:false},otherPreference:'conservée'});
 const incoming=state({statuses:{a:'answer',b:'maybe'},notes:{a:'Ancienne note'},favorites:{a:true}});
 const r=api.merge(local,incoming,'keep');
 assert.equal(r.state.statuses.a,'irrelevant');assert.equal(r.state.notes.a,'Note récente');assert.equal(r.state.favorites.a,false);
 assert.equal(r.state.statuses.b,'maybe');assert.equal(r.state.otherPreference,'conservée');
 assert.deepEqual(r.report,{added:1,conflicts:3,identical:0,replaced:0});
 assert.equal(local.statuses.b,undefined);
});
test('choix explicite des valeurs importées : réintégration, note effacée et favori désactivé sont des décisions',()=>{
 const local=state({statuses:{a:'irrelevant',b:'won'},notes:{a:'À effacer',b:'À garder'},favorites:{a:true}});
 const incoming=state({statuses:{a:'inbox'},notes:{a:''},favorites:{a:false}});
 const r=api.merge(local,incoming,'incoming');
 assert.equal(r.state.statuses.a,'inbox');assert.equal(r.state.notes.a,'');assert.equal(r.state.favorites.a,false);
 assert.equal(r.state.statuses.b,'won');assert.equal(r.state.notes.b,'À garder');assert.equal(r.report.replaced,3);
});
test('anciens libellés migrés sans changer les identifiants',()=>{
 assert.deepEqual(api.normalizeState(state({statuses:{a:'Hors sujet',b:'Écarté',c:'Offre en préparation'}})).statuses,{a:'irrelevant',b:'discarded',c:'answer'});
});
test('refuser fichiers étrangers, versions inconnues, types invalides et pollution de prototype',()=>{
 for(const raw of ['not json','{}',JSON.stringify({...api.create(state()),version:2}),JSON.stringify(api.create(state())).replace('"notes":{}','"notes":[]'),JSON.stringify(api.create(state())).replace('"favorites":{}','"favorites":{"x":"true"}'),JSON.stringify(api.create(state())).replace('"statuses":{}','"statuses":{"__proto__":"irrelevant"}')])assert.throws(()=>api.parse(raw));
 assert.throws(()=>api.parse(' '.repeat(api.MAX_BYTES+1)),/5 Mo/);
 assert.throws(()=>api.normalizeState(state({statuses:{x:'unknown'}})),/Classement inconnu/);
 assert.equal({}.polluted,undefined);
});
test('application atomique et sauvegarde de l’état antérieur à chaque import',()=>{
 const old=state({notes:{a:'Ancienne note'}}),store=storage(old);
 const r=api.apply(store,key,old,state({statuses:{a:'answer'}}),'keep');
 assert.deepEqual(api.parse(store.getItem(key+'.beforeImport')).state,old);
 assert.deepEqual(JSON.parse(store.getItem(key)),r.state);
 assert.deepEqual(old, state({notes:{a:'Ancienne note'}}));
});
test('quota : si le snapshot ou l’écriture finale échoue, ne pas remplacer le suivi',()=>{
 for(const failing of [key+'.beforeImport',key]){
  const old=state({statuses:{a:'irrelevant'}}),store=storage(old),set=store.setItem;
  store.setItem=(k,v)=>{if(k===failing)throw Error('QuotaExceededError');set(k,v)};
  assert.throws(()=>api.apply(store,key,old,state({statuses:{a:'answer'}}),'incoming'),/Quota/);
  assert.deepEqual(JSON.parse(store.getItem(key)),old);assert.equal(old.statuses.a,'irrelevant');
 }
});
test('refuser un import si un autre onglet a modifié le suivi depuis son ouverture',()=>{
 const viewed=state({notes:{a:'Vue ancienne'}}),newer=state({notes:{a:'Nouvelle note'}}),store=storage(newer);
 assert.throws(()=>api.apply(store,key,viewed,state({statuses:{a:'answer'}}),'keep'),/autre onglet/);
 assert.deepEqual(JSON.parse(store.getItem(key)),newer);assert.equal(store.getItem(key+'.beforeImport'),null);
});
