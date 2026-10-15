/* MarchéRadar KDRIX — registre officiel des communes wallonnes.
 * Source : Union des Villes et Communes de Wallonie / ODWB (CC-BY 4.0).
 * https://digitalwallonia.opendatasoft.com/explore/dataset/communes_s3/
 * Ne jamais afficher un temps de route comme vérifié lorsqu'il est estimé.
 */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const OUTPUT=path.resolve(__dirname,'../communes.json');
const API='https://digitalwallonia.opendatasoft.com/api/explore/v2.1/catalog/datasets/communes_s3/records';
const LIEGE_APPROX={lat:50.6439,lon:5.5718,label:"Liège (centre approximatif, en attente de validation de l'adresse du bureau)"};
function coords(raw){
 if(raw==null)return null;
 if(Array.isArray(raw)&&raw.length>=2&&raw.every((n,i)=>i<2?Number.isFinite(Number(n)):true)){
  const a=Number(raw[0]),b=Number(raw[1]);
  if(a>48&&a<52&&b>2&&b<7)return {lat:a,lon:b};
  if(b>48&&b<52&&a>2&&a<7)return {lat:b,lon:a};
 }
 if(typeof raw==='string'){return coords(raw.split(/[;, ]+/).filter(Boolean).map(Number))}
 if(typeof raw==='object'){
  if(Number.isFinite(Number(raw.lat))&&Number.isFinite(Number(raw.lon)))return coords([raw.lat,raw.lon]);
  if(Number.isFinite(Number(raw.latitude))&&Number.isFinite(Number(raw.longitude)))return coords([raw.latitude,raw.longitude]);
  if(raw.coordinates)return coords(raw.coordinates);
 }
 return null;
}
function haversine(a,b){
 const r=Math.PI/180,p1=a.lat*r,p2=b.lat*r,dl=(b.lon-a.lon)*r,dp=(b.lat-a.lat)*r;
 const h=Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;
 return 6371*2*Math.asin(Math.min(1,Math.sqrt(h)));
}
function approxMinutes(km){return Math.round(km*1.42*60/68+10)}
function zone(estimated,road){
 const minutes=Number.isFinite(road)?road:estimated;
 if(!Number.isFinite(minutes))return 'a_verifier';
 if(minutes<=135)return 'principale';
 if(minutes<=165)return 'peripherique';
 return 'exterieure_provisoire';
}
function normalize(row,previous){
 const f=row||{},ins=String(f.ins??f.INS??f.code_ins??'').trim();
 const name=String(f.nom||f.nom_court||'').trim();
 const rawWebsite=String(f.site_web||f.siteweb||'').trim();
 const website=/^www\.[a-z0-9.-]+$/i.test(rawWebsite)?'https://'+rawWebsite:rawWebsite;
 const point=coords(f.geopoint_administration)||coords(f.centroid);
 if(!name||!/^\d{5}$/.test(ins))return null;
 if(website){try{const u=new URL(website);if(!/^https?:$/.test(u.protocol))return null}catch(e){return null}}
 const km=point?Math.round(haversine(point,LIEGE_APPROX)*10)/10:null;
 const estimate=km===null?null:approxMinutes(km);
 const old=previous||{};
 const road=Number.isFinite(old.roadMinutes)?old.roadMinutes:null;
 return {
  ins,name,officialSite:website,postCode:String(f.cp||''),municipalAddress:String(f.adresse||''),
  coordinates:point,
  straightLineKm:km,roadMinutes:road,estimatedMinutes:estimate,
  travelMethod:road===null?'estimation_geographique_non_routiere':'itineraire_verifie',
  zone:zone(estimate,road),
  sourceStatus:old.sourceStatus||(website?'site_repertorie_non_verifie':'site_absent_dans_annuaire'),
  deliberationSources:old.deliberationSources||[],
  lastSiteCheck:old.lastSiteCheck||null,lastDocumentCheck:old.lastDocumentCheck||null,
  latestCouncilDate:old.latestCouncilDate||null,
  documentsRead:Number(old.documentsRead||0),opportunities:Number(old.opportunities||0),
  errors:old.errors||[]
 };
}
async function get(url){
 for(let k=0;k<2;k++){
  const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),25000);
  try{
   const res=await fetch(url,{signal:ctrl.signal,headers:{Accept:'application/json'}});
   if(!res.ok)throw Error('ODWB HTTP '+res.status);
   return await res.json();
  }catch(e){if(k===1)throw e;await new Promise(r=>setTimeout(r,1200))}
  finally{clearTimeout(timer)}
 }
}
async function collect(){
 const rows=[];let total=null;
 for(let offset=0;offset<400;offset+=100){
  const url=API+'?limit=100&offset='+offset;
  const data=await get(url);
  if(total===null)total=Number(data.total_count);
  if(!Array.isArray(data.results))throw Error('Schéma API ODWB inconnu');
  rows.push(...data.results);
  if(rows.length>=total||data.results.length<100)break;
  await new Promise(r=>setTimeout(r,350));
 }
 if(rows.length<250||rows.length>280)throw Error('Inventaire incomplet / inattendu : '+rows.length+'/'+total);
 let prior={communes:[]};try{prior=JSON.parse(fs.readFileSync(OUTPUT,'utf8'))}catch(e){if(e.code!=='ENOENT')throw e}
 const history=new Map((prior.communes||[]).map(x=>[x.ins,x]));
 const communes=rows.map(x=>normalize(x,history.get(String(x.ins??x.INS??'')))).filter(Boolean);
 if(communes.length!==rows.length){const missed=rows.filter(x=>!normalize(x,history.get(String(x.ins??x.INS??'')))).map(x=>({name:x.nom,ins:x.ins??x.INS,website:x.site_web}));throw Error('Communes non normalisées : '+communes.length+'/'+rows.length+' : '+JSON.stringify(missed).slice(0,300));}
 const ids=new Set(communes.map(x=>x.ins));
 if(ids.size!==communes.length)throw Error('Doublons INS détectés');
 communes.sort((a,b)=>a.name.localeCompare(b.name,'fr'));
 const zones=communes.reduce((acc,x)=>(acc[x.zone]=(acc[x.zone]||0)+1,acc),{});
 const output={
  source:'ODWB/UVCW',sourceUrl:'https://digitalwallonia.opendatasoft.com/explore/dataset/communes_s3/',
  lastDirectorySync:new Date().toISOString(),sourceTotal:total,origin:LIEGE_APPROX,
  roadRoutingStatus:'non_calcule_automatiquement',
  notice:'Les durées indiquées par estimatedMinutes ne sont pas des trajets calculés : priorisation indicative uniquement. Ne jamais éliminer automatiquement une commune sur cette estimation.',
  counts:{total:communes.length,sitesRepertories:communes.filter(x=>!!x.officialSite).length,
   sitesVerifies:communes.filter(x=>x.lastSiteCheck&&!x.errors?.length).length,
   deliberationsConnectees:communes.filter(x=>x.deliberationSources.some(s=>s.last_success)).length,zones},
  communes
 };
 fs.writeFileSync(OUTPUT,JSON.stringify(output,null,2)+'\n','utf8');
 console.log('COMMUNES_DIRECTORY_OK',JSON.stringify(output.counts));
}
module.exports={coords,haversine,normalize,approxMinutes,zone,collect};
if(require.main===module)collect().catch(e=>{
 const message=String(e.message||e).slice(0,350);
 fs.writeFileSync(path.resolve(__dirname,'../communes-error.json'),
  JSON.stringify({at:new Date().toISOString(),error:message},null,2)+'\n','utf8');
 console.error('COMMUNES_DIRECTORY_ERROR',message);
 process.exitCode=1;
});
