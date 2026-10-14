/* Collecteur public BOSA (Bulletin belge des adjudications)
 * Recherche utilisée par le site officiel : POST /api/sea/search/publications
 * Paramètres découverts dans les ressources publiques du portail, octobre 2026.
 * Ne pas utiliser d'authentification privée ni contourner les refus d'accès.
 * Un HTTP 400/401/403 => aucune donnée importée, aucun statut "connecté".
 */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const profile=require('./kdrix-profile.cjs');
const DATA=path.resolve(__dirname,'../data.json');
const ENDPOINT='https://www.publicprocurement.be/api/sea/search/publications';
const MAX_PAGE=25;
const LIMIT=80;
function localized(value){
 if(value==null)return '';
 if(typeof value==='string'||typeof value==='number')return String(value).trim();
 if(Array.isArray(value)){
  const french=value.find(x=>x&&typeof x==='object'&&/^(fr|fra)$/i.test(x.language||x.lang||''));
  if(french){const text=localized(french.text||french.value);if(text)return text}
  const english=value.find(x=>x&&typeof x==='object'&&/^(en|eng)$/i.test(x.language||x.lang||''));
  const candidate=french||english||value[0];
  return localized(candidate);
 }
 if(typeof value==='object'){
  for(const lang of ['fr','FR','fra','FRA','french','en','EN','nl','NL']){
   if(value[lang]){const text=localized(value[lang]);if(text)return text}
  }
  for(const key of ['text','value','name','officialName','denomination','title','description']){
   if(value[key]){const text=localized(value[key]);if(text)return text}
  }
 }
 return '';
}
function stringField(obj,keys){
 for(const key of keys){
  const value=key.split('.').reduce((v,part)=>v?.[part],obj);
  const text=localized(value);
  if(text)return text;
 }
 return '';
}
function compactDate(v){
 return String(v||'').match(/\b20\d{2}-\d{2}-\d{2}\b/)?.[0]||'';
}
function codeList(raw){
 const inputs=[raw.cpvMainCode,raw.cpvAdditionalCodes,raw.cpvCodes,raw.mainCpvCode,
   raw.cpvCode,raw.mainClassificationCode].flat(Infinity).filter(Boolean);
 return [...new Set(inputs.flatMap(x=>{
  const text=typeof x==='string'?x:typeof x==='object'?(x.code||x.value||''):String(x);
  return String(text).match(/\b\d{8}\b/g)||[];
 }))];
}
function regionFromNuts(raw){
 const codes=[raw.nutsCodes,raw.nutsCode,raw.placeOfPerformanceNutsCode,raw.executionNutsCodes].flat(Infinity).filter(Boolean).map(String);
 if(codes.some(x=>/^BE3/.test(x)))return 'Wallonie';
 if(codes.some(x=>/^BE1/.test(x)))return 'Bruxelles';
 if(codes.length&&codes.every(x=>/^BE2/.test(x)))return 'Flandre';
 return 'Belgique';
}
function noticeKind(code){
 const c=String(code||'').toUpperCase();
 if(c==='E4'||/^([2][5-9]|3[0-7])$/.test(c))return 'award';
 if(c==='E3'||/^1[0-9]$|^2[0-4]$/.test(c))return 'competition';
 if(c==='E2'||/^[1-9]$/.test(c))return 'planning';
 return 'unknown';
}
function normalize(raw){
 if(!raw||typeof raw!=='object')return null;
 const publicationWorkspaceId=stringField(raw,['publicationWorkspaceId','workspaceId','publicationWorkspaceUuid']);
 const noticeId=stringField(raw,['noticeId','id','publicationId','publicationUuid']);
 const stable=publicationWorkspaceId||noticeId;
 if(!/^[a-f0-9]{8}-[a-f0-9-]{27,36}$/i.test(stable))return null;
 const dossier=raw.dossier||{},organisation=raw.organisation||{};
 const title=stringField(raw,['dossier.titles','title','noticeTitle','publicationTitle','subject','lots.0.titles']).slice(0,1500);
 const description=stringField(raw,['dossier.descriptions','description','noticeDescription','shortDescription','lots.0.descriptions']).slice(0,3000);
 const buyer=stringField(raw,['organisation.organisationNames','organisationName','organizationName','buyerName','contractingAuthorityName','authorityName']);
 const cpv=codeList(raw);
 if(!title||!buyer)return null;
 const languages=Array.isArray(raw.publicationLanguages)?raw.publicationLanguages.map(x=>String(x).toUpperCase()):[];
 // Écarter les publications exclusivement néerlandophones, pas les avis
 // bilingues NL/FR accessibles à KDRIX.
 if(languages.length&&languages.every(lang=>lang==='NL'))return null;
 const region=regionFromNuts(raw);
 const classification=profile.screen({title,description,buyer,region,cpv});
 if(!classification.classification)return null;
 const procedureIdentifier=stringField(raw,['procedureId','procedureIdentifier','procurementProcedureId']);
 const internalReference=stringField(raw,['referenceNumber','dossier.referenceNumber','internalReference','procurementReference']);
 const pubDate=compactDate(raw.publicationDate)||compactDate(raw.dispatchDate);
 const deadline=compactDate(raw.vaultSubmissionDeadline)||compactDate(raw.tenderSubmissionDeadline)||compactDate(dossier.submissionDeadline);
 const noticeIdActual=noticeId||String(raw.noticeIds?.[0]||'');
 const noticeSubType=String(raw.noticeSubType||'');
 const bdaRef=String(raw.publicationReferenceNumbersBDA?.[0]||'');
 const tedRef=String(raw.publicationReferenceNumbersTED?.[0]||'');
 return {
  id:'bosa:'+stable,publicationWorkspaceId,noticeId:noticeIdActual,
  procedureIdentifier,internalReference,title,buyer,region,languages,
  sector:classification.classification.sector,sectors:classification.classification.sectors,
  score:classification.classification.score,screening:classification.classification.screening,
  publication:pubDate,deadline,cpv,description:description||title,
  source:'BOSA',source_status:'bosa_public_browser',
  noticeSubType,noticeKind:noticeKind(noticeSubType),
  bdaReference:bdaRef,tedReference:tedRef,
  url:'https://www.publicprocurement.be/publication-workspaces/'+(publicationWorkspaceId||stable)+'/general'
 };
}
async function searchPublications(from,to,fetchFn=fetch){
 const all=[],countByPage=[];
 for(let page=1;page<=MAX_PAGE;page++){
  const control=new AbortController(),timer=setTimeout(()=>control.abort(),35000);
  let res;
  try{
   const body={
    terms:null,procurementProcedureTypes:null,
    dispatchDateFrom:null,dispatchDateTo:null,
    publicationDateFrom:from,publicationDateTo:to,
    publicationLanguages:null,specialPurchasingTechniques:null,
    tenderSubmissionDeadlineFrom:null,tenderSubmissionDeadlineTo:null,
    cpvCodes:null,nutsCodes:null,natures:null,
    noticeSubtypes:[],organisationIds:null,authorityIds:null,
    includeOrganisationChildren:null,withActiveSubmissionDeadline:null,
    accreditations:null,reservedTenders:null,
    page,pageSize:LIMIT,order:null
   };
   res=await fetchFn(ENDPOINT,{method:'POST',headers:{
    'Content-Type':'application/json','Accept':'application/json','Accept-Language':'fr-BE'
   },body:JSON.stringify(body),signal:control.signal});
  }finally{clearTimeout(timer)}
  if(!res.ok)throw Error('BOSA HTTP '+res.status+' : accès à la recherche publique non validé');
  const json=await res.json();
  if(!Array.isArray(json?.publications))throw Error('Format inattendu de la réponse BOSA');
  countByPage.push(json.publications.length);
  all.push(...json.publications);
  const count=Number(json.totalCount||0);
  if(json.publications.length<LIMIT||count&&all.length>=count)break;
  if(page===MAX_PAGE)throw Error('Pagination BOSA incomplète, refus de signaler la source comme exhaustive');
  await new Promise(r=>setTimeout(r,300));
 }
 return {publications:all,scanned:all.length,pages:countByPage};
}
function merge(existing,newItems){
 const byId=new Map((existing||[]).filter(x=>x&&x.id).map(x=>[x.id,{...x}]));
 const byProcedure=new Map(),byRef=new Map(),byUniqueRef=new Map(),refCollisions=new Set();
 const normalizeRef=x=>String(x||'').trim().toUpperCase().replace(/\s+/g,'');
 function index(item){
  if(item.procedureIdentifier)byProcedure.set(item.procedureIdentifier,item.id);
  const ref=normalizeRef(item.internalReference);
  if(ref){
   if(byUniqueRef.has(ref)&&byUniqueRef.get(ref)!==item.id)refCollisions.add(ref);
   else byUniqueRef.set(ref,item.id);
   if(item.buyer)byRef.set(ref+'|'+item.buyer.toLocaleLowerCase('fr-BE'),item.id);
  }
 }
 for(const item of byId.values())index(item);
 for(const record of newItems){
  const ref=normalizeRef(record.internalReference);
  const existingId=
    (record.procedureIdentifier&&byProcedure.get(record.procedureIdentifier))||
    (ref&&record.buyer&&byRef.get(ref+'|'+record.buyer.toLocaleLowerCase('fr-BE')))||
    (ref&&!refCollisions.has(ref)&&byUniqueRef.get(ref))||
    record.id;
  const before=byId.get(existingId);
  if(!before){
   const fresh={...record};
   if(record.noticeKind==='award')fresh.bosaResults=[{
    reference:record.bdaReference||record.internalReference||'',url:record.url,
    publicationDate:record.publication||'',kind:'award'
   }];
   byId.set(fresh.id,fresh);
   index(fresh);
   continue;
  }
  const sources=[...(before.officialSources||[])];
  for(const source of [{source:before.source,url:before.url,publicationNumber:before.publicationNumber},
     {source:record.source,url:record.url,bdaReference:record.bdaReference,noticeKind:record.noticeKind}]){
   if(source.url&&!sources.some(x=>x.url===source.url))sources.push(source);
  }
  const result={
   ...before,id:existingId,
   sector:before.sector||record.sector,
   sectors:[...new Set([...(before.sectors||[]),...(record.sectors||[])])],
   score:Math.max(before.score||0,record.score||0),
   procedureIdentifier:before.procedureIdentifier||record.procedureIdentifier||'',
   publicationWorkspaceId:record.publicationWorkspaceId||before.publicationWorkspaceId,
   officialSources:sources
  };
  if(record.publication>(before.publication||'')){
   result.publication=record.publication;
   if(record.deadline)result.deadline=record.deadline;
  }else if(!result.deadline&&record.deadline)result.deadline=record.deadline;
  if(record.noticeKind==='award'){
   const notices=Array.isArray(before.bosaResults)?before.bosaResults.slice():[];
   if(!notices.some(x=>x.url===record.url)){
    notices.push({reference:record.bdaReference||record.internalReference||'',
      url:record.url,publicationDate:record.publication||'',kind:'award'});
   }
   result.bosaResults=notices;
  }
  byId.set(existingId,result);
  index(result);
 }
 return [...byId.values()];
}
async function run(){
 let data;try{data=JSON.parse(fs.readFileSync(DATA,'utf8'))}catch(e){throw Error('Fichier TED initial absent : '+e.message)}
 const since=new Date(Date.now()-14*86400000).toISOString().slice(0,10);
 const until=new Date().toISOString().slice(0,10);
 const response=await searchPublications(since,until);
 const items=response.publications.map(normalize).filter(Boolean);
 const merged=merge(data.items||[],items);
 if(merged.length===0)throw Error('BOSA ne peut pas effacer le dernier inventaire');
 data.items=merged;
 data.coverage={...(data.coverage||{}),BOSA:'Recherche publique connectée ; champs et exhaustivité en validation'};
 data.sources={...(data.sources||{}),BOSA:{status:'accessible',last_success:new Date().toISOString(),scanned:response.scanned,retained:items.length,period_from:since,period_to:until}};
 data.metrics={...(data.metrics||{}),bosa_scanned:response.scanned,bosa_imported:items.length,records:merged.length};
 fs.writeFileSync(DATA,JSON.stringify(data,null,2)+'\n');
 console.log('BOSA_PUBLIC_SEARCH_OK',JSON.stringify({scanned:response.scanned,retained:items.length,records:merged.length}));
}
module.exports={normalize,regionFromNuts,searchPublications,merge,run};
if(require.main===module){run().catch(e=>{console.warn('BOSA_SOURCE_NOT_CONNECTED',e.message);process.exitCode=0})}
