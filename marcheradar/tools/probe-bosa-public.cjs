'use strict';
const fs=require('node:fs'),path=require('node:path');
const OUT=path.resolve(__dirname,'../bosa-diagnostic.json');
const ENDPOINT='https://www.publicprocurement.be/api/sea/search/publications';
const result={checkedAt:new Date().toISOString(),endpoint:ENDPOINT,checks:[],authorizedPublicSearch:false,comment:'Tests de méthodes publiques sans session privée; réponses HTTP enregistrées sans cookies ni secrets.'};
function todayMinus(days){return new Date(Date.now()-days*86400000).toISOString().slice(0,10)}
async function probe(name,url,options){
 try{
  const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),16000);
  let r;
  try{r=await fetch(url,{...options,signal:ctl.signal})}finally{clearTimeout(timer)}
  const body=await r.text();
  let decoded;try{decoded=JSON.parse(body)}catch(e){}
  const safeExcerpt=body.slice(0,1000).replace(/(?:Bearer|access_token|refresh_token|secret|password)[^\\s]{0,80}/gi,'[REDACTED]');
  result.checks.push({name,status:r.ok?'success':'unavailable',httpStatus:r.status,contentType:r.headers.get('content-type')||'',bodyKeys:decoded&&typeof decoded==='object'?Object.keys(decoded).slice(0,20):[],bodyExcerpt:r.ok?'':safeExcerpt});
  return r.ok;
 }catch(e){result.checks.push({name,status:'unavailable',reason:String(e.message||e).slice(0,180)});return false}
}
async function run(){
 const base={method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json','Accept-Language':'fr-BE'}};
 const variants=[
  ['existing_json', {terms:null,procurementProcedureTypes:null,dispatchDateFrom:null,dispatchDateTo:null,
     publicationDateFrom:todayMinus(2),publicationDateTo:todayMinus(0),
     publicationLanguages:null,specialPurchasingTechniques:null,tenderSubmissionDeadlineFrom:null,
     tenderSubmissionDeadlineTo:null,cpvCodes:null,nutsCodes:null,natures:null,noticeSubtypes:[],
     organisationIds:null,authorityIds:null,includeOrganisationChildren:null,
     withActiveSubmissionDeadline:null,accreditations:null,reservedTenders:null,
     page:1,pageSize:3,order:null}],
  ['minimal_page_one',{page:1,pageSize:3}],
  ['minimal_page_zero',{page:0,pageSize:3}]
 ];
 for(const [name,body] of variants){
  const success=await probe(name,ENDPOINT,{...base,body:JSON.stringify(body)});
  if(success){result.authorizedPublicSearch=true;break}
 }
 await probe('public_web','https://www.publicprocurement.be/bda',{headers:{Accept:'text/html'}});
 fs.writeFileSync(OUT,JSON.stringify(result,null,2)+'\n','utf8');
 console.log('BOSA_PROBE',JSON.stringify(result).slice(0,3300));
}
run().catch(e=>{result.checks.push({name:'fatal',status:'unavailable',reason:String(e.message||e).slice(0,140)});fs.writeFileSync(OUT,JSON.stringify(result,null,2)+'\n','utf8');process.exitCode=0;});
