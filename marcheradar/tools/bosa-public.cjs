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
function compactDate(v){
 if(!v)return '';
 return String(v).match(/20\d{2}-\d{2}-\d{2}/)?.[0]||'';
}
function stringField(obj,names){
 for(const name of names){
  const v=obj?.[name];
  if(typeof v==='string'&&v.trim())return v.trim();
  if(typeof v==='number')return String(v);
  if(Array.isArray(v)){const first=v.find(a=>typeof a==='string'&&a.trim());if(first)return first.trim()}
  if(v&&typeof v==='object'){
   for(const key of ['fr','fra','french','FR','nl','en']){
    if(typeof v[key]==='string'&&v[key].trim())return v[key].trim();
   }
  }
 }
 return '';
}
function codeList(obj){
 const data=[obj.cpvCodes,obj.mainCpvCode,obj.cpvCode,obj.mainClassificationCode].flat(Infinity).filter(Boolean);
 return [...new Set(data.flatMap(x=>String(typeof x==='object'?x.code||x.value||'':x).match(/\b\d{8}\b/g)||[]))];
}
function regionFromNuts(raw){
 const places=[raw.nutsCodes,raw.nutsCode,raw.placeOfPerformanceNutsCode,raw.executionNutsCodes].flat(Infinity).filter(Boolean).map(String);
 if(places.some(s=>/^BE3/.test(s)))return 'Wallonie';
 if(places.some(s=>/^BE1/.test(s)))return 'Bruxelles';
 if(places.length&&places.every(s=>/^BE2/.test(s)))return 'Flandre';
 return 'Belgique';
}
function normalize(raw){
 if(!raw||typeof raw!=='object')return null;
 const publicationWorkspaceId=stringField(raw,['publicationWorkspaceId','workspaceId','publicationWorkspaceUuid']);
 const noticeId=stringField(raw,['noticeId','id','publicationId','publicationUuid']);
 const stable=publicationWorkspaceId||noticeId;
 if(!/^[a-f0-9]{8}-[a-f0-9-]{27,36}$/i.test(stable))return null;
 const title=stringField(raw,['title','noticeTitle','publicationTitle','subject','description']).slice(0,1500);
 const description=stringField(raw,['description','noticeDescription','shortDescription','subject']).slice(0,3000);
 const buyer=stringField(raw,['organisationName','organizationName','buyerName','contractingAuthorityName','authorityName','organisation']);
 const cpv=codeList(raw);
 if(!title||!buyer)return null;
 const region=regionFromNuts(raw);
 const notice={title,description,buyer,region,cpv};
 const screened=profile.screen(notice);
 if(!screened.classification)return null;
 const procedureIdentifier=stringField(raw,['procedureIdentifier','procedureId','procurementProcedureId']);
 const internalReference=stringField(raw,['referenceNumber','internalReference','procurementReference']);
 const pubDate=compactDate(raw.publicationDate)||compactDate(raw.dispatchDate);
 const deadline=compactDate(raw.vaultSubmissionDeadline)||compactDate(raw.tenderSubmissionDeadline);
 return {
  id:'bosa:'+stable,publicationWorkspaceId,noticeId,procedureIdentifier,internalReference,
  title,buyer,region,sector:screened.classification.sector,sectors:screened.classification.sectors,
  score:screened.classification.score,screening:screened.classification.screening,
  publication:pubDate,deadline,cpv,description:description||title,
  source:'BOSA',source_status:'bosa_public_search',
  noticeSubType:raw.noticeSubType||null,
  url:'https://www.publicprocurement.be/publication-workspaces/'+(publicationWorkspaceId||stable)+'/publications'
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
 const byProcedure=new Map();
 const byRef=new Map();
 for(const m of byId.values()){
  if(m.procedureIdentifier)byProcedure.set(m.procedureIdentifier,m.id);
  if(m.internalReference&&m.buyer)byRef.set(m.internalReference+'|'+m.buyer.toLocaleLowerCase(),m.id);
 }
 for(const m of newItems){
  const found=(m.procedureIdentifier&&byProcedure.get(m.procedureIdentifier))||(m.internalReference&&byRef.get(m.internalReference+'|'+m.buyer.toLocaleLowerCase()))||m.id;
  const before=byId.get(found);
  if(!before){byId.set(found,m);continue}
  const srcs=[...(before.officialSources||[])];
  for(const item of [{source:before.source,url:before.url,publicationNumber:before.publicationNumber},{source:m.source,url:m.url,noticeId:m.noticeId}]){
   if(item.url&&!srcs.some(e=>e.url===item.url))srcs.push(item);
  }
  const incomingDate=m.publication||'',oldDate=before.publication||'';
  byId.set(found,{
   ...before,
   ...(incomingDate>oldDate?{publication:incomingDate,deadline:m.deadline||before.deadline}:{}),
   sectors:[...new Set([...(before.sectors||[]),...(m.sectors||[])])],
   score:Math.max(before.score||0,m.score||0),
   publicationWorkspaceId:m.publicationWorkspaceId||before.publicationWorkspaceId,
   officialSources:srcs
  });
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
