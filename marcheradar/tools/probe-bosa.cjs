/* Diagnostic read-only public BOSA. Aucune authentification, aucun POST. */
'use strict';
const fs=require('node:fs');
const out='marcheradar/tools/bosa-discovery.json';
const origins=['https://www.publicprocurement.be/bda/v2--irldz3','https://www.publicprocurement.be/bda','https://www.publicprocurement.be/'];
const result={generated_at:new Date().toISOString(),requests:[],html_script_files:[],api_strings:[],search_focus:[],route_hints:[],errors:[],status:'diagnostic'};
async function fetchBody(url,timeout=18000){
 const ctl=new AbortController();
 const timer=setTimeout(()=>ctl.abort(),timeout);
 try{
  const res=await fetch(url,{headers:{'Accept':'text/html,application/javascript,application/json','User-Agent':'Mozilla/5.0 (compatible; MarcheRadarPublicResearch/0.1)'},signal:ctl.signal,redirect:'follow'});
  const raw=await res.text();
  const record={url,status:res.status,final_url:res.url,content_type:res.headers.get('content-type'),length:raw.length};
  result.requests.push(record);
  return {raw,record};
 }finally{clearTimeout(timer)}
}
function scanJS(s,url){
 const regexes=[
  /.{0,130}(?:\/api\/|https?:\/\/[a-z0-9_.-]*publicprocurement\.be\/|\/v[0-9]+\/(?:publications|notices|search)|(?:search|publication|contractAward|bda)Endpoint).{0,145}/gi,
  /.{0,75}(?:publications\/search|notice\/search|bda\/search|tender\/search|advancedSearch|publication-workspaces).{0,100}/gi
 ];
 const focused=[
  /.{0,145}(?:\/api\/sea\/|\/search\/publications|\/search\/notices|\/bda\/|\/publications\/search|\/notices\/search).{0,160}/gi,
  /.{0,130}(?:static\s+(?:get|search|find|load)[A-Za-z0-9_$]*(?:Notices|Publications|Bulletin|Search|Bda)|(?:get|post)\(\s*[\`"']\/[^'"\`]{0,100}(?:search|notices|publications)).{0,170}/gi
 ];
 focused.forEach(re=>{for(const hit of s.matchAll(re)){
  const v=hit[0].replace(/\s+/g,' ').slice(0,310);
  if(result.search_focus.length<320&&!result.search_focus.some(x=>x.context===v))result.search_focus.push({source:url,context:v});
 }});
 const unique=new Set();
 regexes.forEach(re=>{for(const hit of s.matchAll(re)){
   const item=hit[0].slice(0,240).replace(/\s+/g,' ').replace(/["'][a-zA-Z0-9-_]{60,}["']/g,'<redacted>');
   if(!unique.has(item)){unique.add(item);if(result.api_strings.length<300)result.api_strings.push({source:url,context:item})}
 }});
}
async function main(){
 for(const url of origins){
  try{
   const {raw,record}=await fetchBody(url);
   if(record.status>=400)continue;
   let paths=[...raw.matchAll(/<script[^>]+src\s*=\s*["']([^"']+\.js(?:\?[^"']*)?)["']/gi)].map(m=>new URL(m[1],record.final_url).href);
   paths.push(...[...raw.matchAll(/<link[^>]+(?:href|src)\s*=\s*["']([^"']+\.js(?:\?[^"']*)?)["']/gi)].map(m=>new URL(m[1],record.final_url).href));
   scanJS(raw,url);
   for(const p of paths){if(!result.html_script_files.includes(p))result.html_script_files.push(p)}
   result.route_hints.push({url,html_excerpt:raw.slice(0,500),script_count:paths.length});
  }catch(e){result.errors.push({url,error:String(e.message||e)})}
 }
 for(const url of result.html_script_files.slice(0,16)){
  try{
   const response=await fetchBody(url);
   if(response.record.status===200 && response.raw.length<=12_000_000)scanJS(response.raw,url);
  }catch(e){result.errors.push({url,error:String(e.message||e)})}
 }
 fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');
 console.log('BOSA public probe:',JSON.stringify({pages:origins.length,files:result.html_script_files.length,strings:result.api_strings.length,errors:result.errors}));
}
main().catch(e=>{result.errors.push({fatal:String(e)});fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');console.log('BOSA diagnostic saved, check report')});
