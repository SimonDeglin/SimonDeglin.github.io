'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {parsePage,validate,updateMarket}=require('../tools/bosa-deadline.cjs');
const id='7f4255eb-6857-4d85-85e5-4aac8b0fe4e8';
const page='Échéances Date limite de soumission 16/11/2026 10:00 CET Les questions peuvent être soumises jusqu’au 10/11/2026';
const api={id,vault:{submissionDeadline:'2026-11-16T10:00:00'},versions:[{submissionDeadline:'2026-11-16T10:00:00'}]};
const market={id:'bosa:'+id,source:'BOSA',noticeKind:'competition',publicationWorkspaceId:id,deadline:'',title:'Auteur de projet'};
test('preuve affichée et état actif concordants sur la date et heure de Bruxelles',()=>{
 const p=parsePage(page);
 assert.deepEqual({date:p.date,time:p.time,zone:p.zone},{date:'2026-11-16',time:'10:00',zone:'CET'});
 const r=validate(api,id,page);
 assert.equal(r.ok,true);
 assert.equal(r.dateTime,'2026-11-16T10:00:00+01:00');
 const applied=updateMarket(market,r,'2026-10-28T08:00:00Z');
 assert.equal(applied.changed,true);
 assert.equal(applied.market.deadline,r.dateTime);
 assert.equal(applied.market.deadlineSourceKind,'bosa_verified_public');
 assert.equal(applied.market.deadlineSourceUrl,'https://www.publicprocurement.be/publication-workspaces/'+id+'/general');
 assert.equal(applied.market.deadlineTimeZone,'Europe/Brussels');
});
test('rectificatif: prendre le vault courant et pas la première version historique',()=>{
 const changed={...api,versions:[{submissionDeadline:'2026-11-09T10:00:00'},{submissionDeadline:'2026-11-16T10:00:00'}]};
 assert.equal(validate(changed,id,page).ok,true);
 const older={...market,deadline:'2026-11-09T10:00:00+01:00',deadlineSourceKind:'bosa_verified_public',deadlineVerifiedAt:'2026-10-19T10:00:00Z'};
 const newer=updateMarket(older,validate(changed,id,page));
 assert.equal(newer.changed,true);
 assert.equal(newer.market.deadlineHistory.length,1);
 assert.equal(newer.market.deadlineHistory[0].value,older.deadline);
 assert.equal(newer.market.deadline,'2026-11-16T10:00:00+01:00');
});
test('heure CEST d octobre et refus de tout mauvais décalage',()=>{
 const oct='Date limite de soumission 22/10/2026 14:00 CEST';
 const o={...api,vault:{submissionDeadline:'2026-10-22T14:00:00'},versions:[]};
 assert.equal(validate(o,id,oct).dateTime,'2026-10-22T14:00:00+02:00');
 assert.equal(validate(o,id,oct.replace('CEST','CET')).ok,false);
});
test('ne pas confondre date des questions, dates d exécution et échéance de dépôt',()=>{
 assert.equal(parsePage('Les questions peuvent être soumises jusqu’au 10/11/2026'),null);
 assert.equal(validate(api,id,'Date limite de soumission 09/11/2026 10:00 CET').why,'official_page_api_disagreement');
 assert.equal(validate(api,id,'Date limite de soumission 16/11/2026 10:00 CEST').why,'incorrect_brussels_offset');
 assert.equal(validate({...api,id:'un-autre-dossier'},id,page).why,'workspace_mismatch');
 assert.equal(validate({...api,versions:[{submissionDeadline:'2026-11-09T10:00:00'}]},id,page).why,'version_disagreement');
});
test('garder les dates préexistantes contradictoires non sourcées et les avis de résultat',()=>{
 const r=validate(api,id,page);
 const unknown=updateMarket({...market,deadline:'2026-11-01'},r);
 assert.equal(unknown.changed,false);
 assert.equal(unknown.market.deadline,'2026-11-01');
 assert.equal(updateMarket({...market,noticeKind:'award'},r).changed,false);
 const once=updateMarket(market,r,'2026-10-28T08:00:00Z').market;
 const twice=updateMarket(once,r,'2026-10-29T08:00:00Z');
 assert.equal(twice.changed,false);
 assert.strictEqual(twice.market,once);
});
