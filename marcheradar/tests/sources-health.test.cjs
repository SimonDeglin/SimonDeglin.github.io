'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const api=require('../source-health.js');
test('BOSA : une tentative échouée prime sur un ancien succès et sur complete=true',()=>{
 const now=Date.parse('2026-10-29T10:00:00Z');
 const old={last_success:'2026-10-28T21:09:57Z',last_attempt:'2026-10-29T08:00:00Z',status:'unavailable',complete:true,last_error:'HTTP 503'};
 const h=api.health(old,now);assert.equal(h.failed,true);assert.equal(h.ok,false);assert.equal(h.attempt,old.last_attempt);assert.equal(h.success,old.last_success);
 assert.match(h.label,/échec/);
 assert.equal(api.health({last_success:old.last_success,status:'partial',complete:false},now).ok,false);
 assert.equal(api.health({last_success:old.last_success,complete:true},now).ok,true);
 assert.equal(api.health({last_success:'2026-10-20T08:00:00Z',complete:true},now).stale,true);
 assert.equal(api.health({},now).success,null);
});
test('heure belge explicite, hiver et été ; absence ou date invalide ne crée pas de succès',()=>{
 assert.match(api.date('2026-10-28T21:09:57Z'),/22:09/);
 assert.match(api.date('2026-07-28T21:09:57Z'),/23:09/);
 assert.equal(api.date('invalide'),'Non enregistré');assert.equal(api.date(null),'Non enregistré');
});
test('province issue du code INS et compteurs dérivés des communes plutôt que de compteurs périmés',()=>{
 const list=[{ins:'25001',lastSiteCheck:'2026-10-28',deliberationSources:[{status:'page_accessible'}]},
 {ins:'52001'},{ins:'62001',documentsRead:3,lastSiteCheck:'2026-10-28'},
 {ins:'82001',documentChecks:{a:{sha256:'a',lastSuccess:'2026-10-28',lastError:'HTTP 503'}}},
 {ins:'92001',sourceStatus:'site_indisponible',lastSiteCheck:'2026-10-28'}];
 assert.deepEqual(list.map(api.provinceOf),['brabant_wallon','hainaut','liege','luxembourg','namur']);
 assert.deepEqual(api.counts(list),{total:5,sites:3,pages:1,read:2,documents:4,errors:2});
 assert.equal(api.communeState(list[0]).key,'pages');assert.equal(api.communeState(list[1]).key,'pending');
 assert.equal(api.communeState(list[3]).key,'error');
 assert.equal(api.docs({documentsRead:2,documentChecks:{a:{sha256:'a',lastSuccess:'2026-10-28'}}}),2,'Ne pas compter deux fois un PDF historique');
});
