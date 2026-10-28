/* Inventaire de départ : marcheradar/communes.json (261 communes issues d'ODWB).
   Une URL municipale n'est déclarée surveillée qu'après vérification.
   Détection des pages communales uniquement : les PDF et les décisions
   seront analysés par un collecteur distinct.
*/
'use strict';
const fs=require('node:fs'),path=require('node:path');
const INVENTORY=path.resolve(__dirname,'../communes.json');
const DATA=path.resolve(__dirname,'../data.json');
const LIMIT=Math.max(1,Math.min(25,Number(process.env.COMMUNES_BATCH||10)));
const LABEL=/(conseil.{0,16}communal|d[eé]lib[eé]ration|proc[eè]s.verbal|ordre.{0,12}jour|conseil municipal|s[eé]ance.{0,12}publique)/i;
function clean(text){return String(text||'').replace(/<[^>]*>/g,' ').replace(/&(?:nbsp|amp|quot);/gi,' ').replace(/\s+/g,' ').trim()}
function links(html,base){
 const items=[],seen=new Set();
 for(const m of String(html).matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)){
  let target;try{target=new URL(m[1],base)}catch(e){continue}
  if(!/^https?:$/.test(target.protocol)||!/conseil|d[eé]lib[eé]rat|proces|proc[eè]s|ordre|pv-/i.test(target.pathname+' '+clean(m[2])))continue;
  const title=clean(m[2]);
  if(!LABEL.test(title+' '+target.pathname)||seen.has(target.href))continue;
  seen.add(target.href);items.push({url:target.href,title:title.slice(0,120),status:'lien_public_repere_non_analyse'});
 }
 return items.slice(0,25);
}
async function getHtml(url){
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),18000);
 try{
  const r=await fetch(url,{redirect:'follow',signal:controller.signal,
   headers:{Accept:'text/html','User-Agent':'KDRIX-PublicCouncilDiscovery/1.0'}});
  if(!r.ok)throw Error('HTTP '+r.status);
  if(!/html|text/.test(r.headers.get('content-type')||''))throw Error('Not HTML');
  return {url:r.url,content:(await r.text()).slice(0,1200000)};
 }finally{clearTimeout(timeout)}
}
function eligible(records){return records.filter(x=>x.officialSite)
 .sort((a,b)=>(a.lastSiteCheck||'').localeCompare(b.lastSiteCheck||'')||(Number.isFinite(a.estimatedMinutes)?a.estimatedMinutes:9999)-(Number.isFinite(b.estimatedMinutes)?b.estimatedMinutes:9999)||(a.ins||'').localeCompare(b.ins||''))}
async function run(){
 const idx=JSON.parse(fs.readFileSync(INVENTORY,'utf8'));
 if(!Array.isArray(idx.communes))throw Error('No commune directory');
 const today=new Date().toISOString(),batch=eligible(idx.communes).slice(0,LIMIT),results=[];
 for(const entry of batch){
  const commune=idx.communes.find(x=>x.ins===entry.ins);
  try{
   const site=await getHtml(commune.officialSite);
   const found=links(site.content,site.url);
   const merged=new Map((commune.deliberationSources||[]).map(s=>[s.url,s]));
   for(const x of found){
    const previous=merged.get(x.url);
    if(previous?.status==='page_accessible'){merged.set(x.url,previous);continue;}
    // Une page de délibérations n'est exploitable qu'après lecture HTML effective.
    // Les liens PDF directs sont traités par un collecteur dédié, pas comme des pages.
    if(/\.pdf(?:$|[?#])/i.test(x.url)){merged.set(x.url,{...x,status:'document_pdf_a_analyser'});continue;}
    try{
     const verified=await getHtml(x.url);
     merged.set(x.url,{...x,url:verified.url,status:'page_accessible',last_success:today});
    }catch(e){merged.set(x.url,{...x,status:'lien_public_repere_non_analyse',last_error:String(e.message||e).slice(0,120)});}
   }
   commune.deliberationSources=[...merged.values()];
   commune.sourceStatus=commune.deliberationSources.some(x=>x.status==='page_accessible')?'pages_conseils_verifiees':found.length?'pages_candidates_trouvees':'site_lu_sources_non_localisees';
   commune.errors=[];
   results.push({name:commune.name,links:found.length});
  }catch(e){
   commune.sourceStatus='site_indisponible';
   commune.errors=[String(e.message||e).slice(0,160)];
   results.push({name:commune.name,error:commune.errors[0]});
  }
  commune.lastSiteCheck=today;
 }
 idx.lastMunicipalPass=today;
 idx.counts={...(idx.counts||{}),
  total:idx.communes.length,sitesChecked:idx.communes.filter(x=>x.lastSiteCheck).length,
  candidatePages:idx.communes.filter(x=>x.deliberationSources?.length>0).length,
  documentsRead:idx.communes.reduce((n,x)=>n+(x.documentsRead||0),0),
  sourceErrors:idx.communes.filter(x=>x.sourceStatus==='site_indisponible').length};
 fs.writeFileSync(INVENTORY,JSON.stringify(idx,null,2)+'\n');
 const data=JSON.parse(fs.readFileSync(DATA,'utf8'));
 data.sources={...(data.sources||{}),COMMUNES:{status:'inventory_not_document_collection',
  updatedAt:today,...idx.counts}};
 fs.writeFileSync(DATA,JSON.stringify(data,null,2)+'\n');
 console.log('COMMUNES_DISCOVERY',JSON.stringify({batch:results.length,counts:idx.counts,results}));
}
module.exports={links,eligible,run};
if(require.main===module)run().catch(e=>{console.warn('COMMUNES_DISCOVERY_ERROR',e.message);process.exitCode=0});
