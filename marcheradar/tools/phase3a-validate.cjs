/* Verify Phase 3A never deletes or rewrites unrelated market metadata.
 * Usage: node marcheradar/tools/phase3a-validate.cjs ORIGINAL_JSON ENRICHED_JSON PILOT_REPORT
 */
'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');
const [beforePath,afterPath,reportPath]=process.argv.slice(2);
if(!beforePath||!afterPath||!reportPath)throw Error('Usage: phase3a-validate ORIGINAL ENRICHED REPORT');
const before=JSON.parse(fs.readFileSync(beforePath,'utf8'));
const after=JSON.parse(fs.readFileSync(afterPath,'utf8'));
const report=JSON.parse(fs.readFileSync(reportPath,'utf8'));
const count=before.items?.length;
assert(Number.isInteger(count)&&count>0,'Base originale vide');
assert.equal(after.items?.length,count,'Le nombre de marchés a changé');
assert.deepEqual(after.items.map(x=>x.id),before.items.map(x=>x.id),'Identifiants/ordre des dossiers altérés');
const allowed=new Set(['documents','officialSources','deadline','deadlineEvidence','deadlineHistory','deadlineReview','documentAudit']);
let upgradedDates=0,addedDocuments=0,newLinks=0;
for(let i=0;i<count;i++){
 const old=before.items[i],latest=after.items[i];
 const left={...old},right={...latest};
 for(const key of allowed){delete left[key];delete right[key]}
 assert.deepEqual(right,left,'Métadonnées du marché altérées : '+old.id);
 const bDocs=Array.isArray(old.documents)?old.documents:[],aDocs=Array.isArray(latest.documents)?latest.documents:[];
 assert(aDocs.length>=bDocs.length,'Des documents ont été supprimés : '+old.id);
 const docIds=aDocs.map(x=>x.id||[x.source,x.title,x.version,x.publicationDate].join('|'));
 assert.equal(new Set(docIds).size,docIds.length,'Documents en doublon : '+old.id);
 for(const doc of aDocs){
  if(doc.accessibility==='listed_public'){
   assert.equal(doc.source,'BOSA');
   assert.equal(doc.url||'','', 'Faux lien direct pour '+old.id);
   assert(/^https:\/\/www\.publicprocurement\.be\/publication-workspaces\/[a-f0-9-]{36}\/documents$/i.test(doc.accessPageUrl||''),'URL de catalogue non officiel');
   assert(doc.title&&doc.verified===true,'Document non vérifiable : '+old.id);
  }
 }
 if(old.deadlineEvidence?.verified&&old.deadline!==latest.deadline){
  assert.equal(latest.deadlineEvidence?.verified,true,'Une date vérifiée a été effacée : '+old.id);
  assert((latest.deadlineHistory||[]).some(h=>h.value===old.deadline),'Changement de date sans historique : '+old.id);
 }
 if(latest.deadline!==old.deadline){
  assert(latest.deadline&&latest.deadlineEvidence?.verified===true,'Date modifiée sans justification : '+old.id);
  assert(typeof latest.deadlineEvidence?.sourceUrl==='string','Preuve de source absente : '+old.id);
  upgradedDates++;
 }
 addedDocuments+=aDocs.length-bDocs.length;
 const priorLinks=new Set((old.officialSources||[]).map(s=>s.url));
 newLinks+=(latest.officialSources||[]).filter(s=>!priorLinks.has(s.url)).length;
}
assert.equal(report.summary.sampleCount,report.records.length,'Bilan sans correspondance');
assert.equal(report.summary.newDocuments,addedDocuments,'Documents incomplets dans le rapport');
assert.equal(report.summary.newDates,upgradedDates,'Nombre de dates différent');
const result={marketsPreserved:count,datesUpdated:upgradedDates,documentsAdded:addedDocuments,officialSourcesAdded:newLinks,accessibleReports:report.summary.accessible};
console.log('PHASE3A_INTEGRITY_OK',JSON.stringify(result));
