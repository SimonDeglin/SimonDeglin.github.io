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
assert.ok(p.normalize({...raw,title:'Prestations de géomètre',organisationName:'Vlaamse Overheid'}),'Lieu d’exécution wallon explicite prioritaire sur le siège de l’acheteur');
assert.equal(p.normalize({...raw,nutsCodes:['BE211'],title:'Prestations de géomètre',organisationName:'Vlaamse Overheid'}),null,'Exécution flamande exclue');
assert.equal(p.normalize({...raw,publicationWorkspaceId:'not-an-id'}),null,'Pas de fausse URL officielle');
const old={id:'ted:100-2026',title:raw.title,source:'TED',buyer:'Commune de Liège',
 procedureIdentifier:raw.procedureIdentifier,url:'https://ted.europa.eu/fr/notice/-/detail/100-2026',
 sectors:['Topo'],publicationNumber:'100-2026'};
const merged=p.merge([old],[normalized]);
assert.equal(merged.length,1,'Un même marché TED et BOSA ne doit pas apparaître deux fois');
assert.equal(merged[0].id,old.id,'Conserver le suivi associé à la fiche TED');
assert.equal(merged[0].officialSources.length,2);
assert.equal(p.merge(merged,[normalized]).length,1,'Idempotence des mises à jour BOSA');

/* Vérifications sur le format réel du moteur BOSA découvert en octobre 2026. */
const nested={
 publicationWorkspaceId:'f941985d-0c3a-45e1-a1e1-8a43afcbac20',
 procedureId:'00000000-0000-4000-8000-000000000001',
 dossier:{titles:[{language:'NL',text:'Topografische opmeting'},{language:'FR',text:'Relevé topographique'}],
   descriptions:[{language:'FR',text:'Prestation de relevé topographique et profils en travers'}],
   referenceNumber:'TEST-TOPO-26'},
 organisation:{organisationNames:[{language:'NL',text:'Stad Luik'},{language:'FR',text:'Commune de Liège'}]},
 cpvMainCode:{code:'71351810-5'},nutsCodes:['BE332'],publicationDate:'2026-10-14',noticeSubType:'E3'
};
const nestedParsed=p.normalize(nested);
assert.ok(nestedParsed,'BOSA doit reconnaître le contenu imbriqué réellement retourné');
assert.equal(nestedParsed.title,'Relevé topographique');
assert.equal(nestedParsed.buyer,'Commune de Liège');
assert.ok(nestedParsed.cpv.includes('71351810'));
assert.equal(nestedParsed.procedureIdentifier,nested.procedureId);
assert.equal(nestedParsed.noticeKind,'competition');
const secondPublication={...nested,
 publicationWorkspaceId:'f941985d-0c3a-45e1-a1e1-8a43afcbac21',
 noticeSubType:'E4',publicationDate:'2026-10-16'};
const firstRef=p.merge([],[nestedParsed]);
const mergedNotice=p.merge(firstRef,[p.normalize(secondPublication)]);
assert.equal(mergedNotice.length,1,'Même procédure, plusieurs avis : un dossier unique');
assert.equal(mergedNotice[0].bosaResults?.length,1,'Avis d’attribution public associé au dossier initial');
assert.equal(mergedNotice[0].id,nestedParsed.id,'Identifiant et statut stable');

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
