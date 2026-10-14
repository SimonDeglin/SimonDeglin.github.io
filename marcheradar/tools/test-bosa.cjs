'use strict';
const assert=require('node:assert/strict');
const p=require('./bosa-public.cjs');
const raw={
 publicationWorkspaceId:'b3502299-990e-444e-8a06-8a220c86c426',
 title:'Marché de services de bornage et division parcellaire à Liège',
 organisationName:'Commune de Liège',
 cpvCodes:['71355000'],publicationDate:'2026-10-14',
 vaultSubmissionDeadline:'2026-11-02',nutsCodes:['BE332'],
 procedureIdentifier:'15c701d6-b5af-42c7-aebf-8258c6ee0a02'
};
const normalized=p.normalize(raw);
assert.ok(normalized);
assert.equal(normalized.region,'Wallonie');
assert.equal(normalized.source,'BOSA');
assert.equal(normalized.publicationWorkspaceId,raw.publicationWorkspaceId);
assert.ok(normalized.sectors.includes('Foncier'));
assert.equal(p.normalize({...raw,title:'Fourniture de balayeuse',cpvCodes:['34144431']}),null,'Fournitures exclues');
assert.equal(p.normalize({...raw,title:'Prestations de géomètre',organisationName:'Vlaamse Overheid'}),null,'Organisme flamand exclu');
assert.equal(p.normalize({...raw,publicationWorkspaceId:'not-an-id'}),null,'Pas de fausse URL officielle');
const old={id:'ted:100-2026',title:raw.title,source:'TED',buyer:'Commune de Liège',
 procedureIdentifier:raw.procedureIdentifier,url:'https://ted.europa.eu/fr/notice/-/detail/100-2026',
 sectors:['Topo'],publicationNumber:'100-2026'};
const merged=p.merge([old],[normalized]);
assert.equal(merged.length,1,'Un même marché TED et BOSA ne doit pas apparaître deux fois');
assert.equal(merged[0].id,old.id,'Conserver le suivi associé à la fiche TED');
assert.equal(merged[0].officialSources.length,2);
assert.equal(p.merge(merged,[normalized]).length,1,'Idempotence des mises à jour BOSA');
(async()=>{
 const request=[];
 const fake=async(url,options)=>{
  request.push({url,options});
  return {ok:true,status:200,json:async()=>({publications:[raw],totalCount:1})};
 };
 const result=await p.searchPublications('2026-10-01','2026-10-14',fake);
 assert.equal(result.scanned,1);
 assert.equal(request.length,1);
 assert.ok(request[0].url.endsWith('/api/sea/search/publications'));
 assert.equal(JSON.parse(request[0].options.body).page,1);
 await assert.rejects(
  ()=>p.searchPublications('2026-10-01','2026-10-14',async()=>({ok:false,status:400})),
  /BOSA HTTP 400/,'Un refus API n’est jamais considéré comme source connectée'
 );
 console.log('MARCHERADAR_BOSA_TEST_OK');
})().catch(e=>{console.error(e);process.exitCode=1});
