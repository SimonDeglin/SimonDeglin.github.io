'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {searchPublications}=require('./bosa-public.cjs');
const OUTPUT=path.resolve(__dirname,'../bosa-diagnostic.json');
const result={checkedAt:new Date().toISOString(),endpoint:'https://www.publicprocurement.be/api/sea/search/publications',checks:[],authorizedPublicSearch:false,note:'Diagnostic technique. Un refus HTTP ne prouve pas absence de données BOSA ; il signifie que cette méthode non authentifiée est indisponible.'};
async function check(){
 const now=new Date(),start=new Date(now.getTime()-24*60*60*1000);
 const iso=n=>n.toISOString().slice(0,10);
 // Réutilise le collecteur d'essai ; 2 petits appels max.
 try{
  const x=await searchPublications(iso(start),iso(now),fetch);
  result.checks.push({name:'bosa_public_search',status:'success',seen:x.scanned,pages:x.pages});
  result.authorizedPublicSearch=true;
 }catch(e){
  result.checks.push({name:'bosa_public_search',status:'unavailable',reason:String(e.message||e).slice(0,300)});
 }
 try{
  const ctl=new AbortController();const timer=setTimeout(()=>ctl.abort(),12000);
  let res;
  try{res=await fetch('https://www.publicprocurement.be/bda',{signal:ctl.signal,headers:{'Accept':'text/html'}})}
  finally{clearTimeout(timer)}
  result.checks.push({name:'public_bulletin_web',status:res.ok?'success':'unavailable',httpStatus:res.status});
 }catch(e){result.checks.push({name:'public_bulletin_web',status:'unavailable',reason:String(e.message||e).slice(0,130)})}
 fs.writeFileSync(OUTPUT,JSON.stringify(result,null,2)+'\n','utf8');
 console.log('BOSA_DIAGNOSTIC',JSON.stringify(result));
}
check().catch(e=>{
  result.checks.push({name:'diagnostic',status:'unavailable',reason:String(e.message||e).slice(0,150)});
  fs.writeFileSync(OUTPUT,JSON.stringify(result,null,2)+'\n','utf8');
  process.exitCode=0;
});
