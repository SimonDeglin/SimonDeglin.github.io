/* MarchéRadar KDRIX - collecte automatique d'avis officiels TED.
   Source : https://api.ted.europa.eu/v3/notices/search
   Usage : node marcheradar/tools/collect-ted.cjs
   Aucun secret/API key n'est requis pour l'API de recherche TED.
*/
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const OUTPUT=path.join(__dirname,'..','data.json');
const API='https://api.ted.europa.eu/v3/notices/search';
const PAGE=200;
const SAFE_MAX_PAGES=75;
const FIELDS=[
 'publication-number','notice-title','buyer-name','buyer-country','buyer-city',
 'publication-date','notice-type','classification-cpv','procedure-identifier',
 'description-proc','description-lot',
 'deadline-receipt-tender-date-lot','deadline-receipt-request-date-lot',
 'deadline-receipt-expressions-date-lot',
 'place-of-performance-subdiv-lot','place-of-performance-subdiv-proc'
];
const FIELD_FALLBACK=['publication-number','notice-title','buyer-name','buyer-country',
 'publication-date','notice-type','classification-cpv','procedure-identifier',
 'deadline-receipt-tender-date-lot','description-proc'];
const KEYWORDS={
 Topo:/(topograph|topograf|landmeet|landmeter|landmess|g[eé]om[eè]tr|geod[eé]s|opmeting|inmeting|topographical|quantity survey|lev[eé] topographique|relev[eé] topographique|profil en travers)/,
 Scan:/(scanner.{0,12}3d|3d.{0,12}scan|scan.{0,12}laser|laser.{0,12}3d|nuage de points|point cloud|laserscan|bim|building information model)/,
 Drone:/(drone|uav|photogramm[eé]tr|orthophot|orthofot|lidar|luchtfotografie)/,
 Hydro:/(bathym[eé]tr|hydrograph|sonar|bodempeil|dieptemet|peiling(?:en)?|bathymetric|underwater survey)/,
 VRD:/(voiries?|wegenis|wegenbouw|am[eé]nagement.{0,15}(?:voirie|route)|infrastructure routi[eè]re|road engineering|wegenontwerp|\bvrd\b)/,
 Reseaux:/(imp[eé]trant|nutsleiding|kabel.{0,10}leid|ri[oô]l|[eé]gout|riool|canalisat|leidingennet|ondergronds.{0,10}net|r[eé]seau enterr[eé]|geodetect)/,
 Hydraulique:/(hydrauli|waterbouw|jaugeag|debietmeting|waterstand|cours d.eau|waterloop|overstrom|inondation)/,
 Foncier:/(parcellaire|verkavel|kadastr|cadastr|bornage|grensbepaling|perceelsgrens|division.{0,16}terrain|property boundary|land division|foncier)/,
 Implant:/(implantation|piquetage|staking out|uitzet|replante|as.built|r[eé]colement|werfinmeting)/,
 Expert:/(expertise immobili[eè]re|expertise judiciaire|schattingsverslag|onroerend.{0,8}waard|[eé]valuation immobili[eè]re|expropri|onteigening|land valuation|real estate appraisal|estimation immobili[eè]re|vastgoedexpert)/,
 PEB:/(certificat(?:ion)? .{0,22}[eé]nerg[eé]t|prestatiecertific|energieprestatie|energy performance certificate|epc.{0,8}woning|certificaat energet|audit [eé]nerg[eé]t|rapport peb|peb.{0,12}gebouw)/,
 Carto:/(cartograph|geografisch informatiesysteem|geographic information|mapping service|geodata|\bsig\b|\bgis\b|digital terrain model)/
};
const CPV={
 '71351810':['Topo'],'71351800':['Topo'],'71353000':['Topo','Scan'],
 '71352000':['Topo'],'71355000':['Topo','Foncier'],'71353100':['Hydro'],
 '71354300':['Topo','Reseaux','Foncier'],'71354400':['Hydro'],
 '71354500':['Hydro'],'71354100':['Carto'],'71353200':['Topo'],
 '71351400':['Hydraulique'],'71314300':['PEB'],
 '71322100':['VRD','Hydraulique'],'71322200':['VRD','Reseaux'],
 '71311210':['VRD'],'71321300':['Reseaux'],'71336000':['Topo'],
 '71250000':['Expert'],'71242000':['VRD'],'71351600':['Hydraulique'],
 '71351920':['Hydraulique']
};
function txt(value){
 if(value==null)return '';
 if(typeof value==='string'||typeof value==='number')return String(value).trim();
 if(Array.isArray(value))return value.map(txt).filter(Boolean).join(' ; ');
 if(typeof value==='object'){
  for(const lang of ['fra','fre','fr','nld','dut','nl','eng','en','deu','ger']){
   if(Object.prototype.hasOwnProperty.call(value,lang)){
    const s=txt(value[lang]);if(s)return s;
   }
  }
  for(const v of Object.values(value)){const s=txt(v);if(s)return s}
 }
 return '';
}
function flatten(v,result=[]){
 if(v==null)return result;
 if(typeof v==='string'||typeof v==='number'){result.push(String(v));return result}
 if(Array.isArray(v)){v.forEach(x=>flatten(x,result));return result}
 if(typeof v==='object')Object.values(v).forEach(x=>flatten(x,result));
 return result;
}
function get(n,key){return n[key]??n[key.replaceAll('-','_')]??null}
function dateList(raw){
 const values=flatten(raw).flatMap(s=>s.match(/\b20\d{2}-\d{2}-\d{2}\b/g)||[]);
 return [...new Set(values)].sort();
}
function iso(raw){return dateList(raw)[0]||''}
function earliestDate(raw){return dateList(raw)[0]||''}
function codes(raw){return [...new Set((flatten(raw).join(' ').match(/\b\d{8}\b/g)||[]))]}
function simplify(raw){return String(raw||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')}
function classify(title,description,cpvs){
 const top=simplify(title),rest=simplify(description);const points=new Map();
 const add=(id,n)=>points.set(id,(points.get(id)||0)+n);
 for(const [id,regex] of Object.entries(KEYWORDS)){
  // accent normalization and multilingual matching; title is weighted more
  if(regex.test(top))add(id,57);else if(regex.test(rest))add(id,33);
 }
 for(const code of cpvs){
  const tags=CPV[code]||[];
  tags.forEach(id=>add(id,44));
  if(!tags.length&&/^7135/.test(code))add('Topo',20);
  if(!tags.length&&/^7132/.test(code))add('VRD',17);
  if(!tags.length&&/^7131/.test(code))add('VRD',11);
 }
 if(!points.size)return null;
 const tags=[...points.entries()].filter(row=>row[1]>=17).sort((a,b)=>b[1]-a[1]).map(x=>x[0]);
 const max=Math.max(...points.values());
 const score=Math.max(28,Math.min(99,Math.round(24+max*0.7)));
 return {sector:tags[0],sectors:tags,score};
}
function region(n){
 const s=simplify(flatten([get(n,'place-of-performance-subdiv-lot'),get(n,'place-of-performance-subdiv-proc'),get(n,'buyer-city')]).join(' '));
 if(/\bbe1\d{2}\b|bruxelles|brussel|brussels|schaerbeek/.test(s))return 'Bruxelles';
 if(/\bbe3\d{2}\b|wallon|liege|namur|charleroi|mons|tournai|verviers|huy|wavre|arlon|dinant/.test(s))return 'Wallonie';
 if(/\bbe2\d{2}\b|vlaander|antwerpen|gent\b|brugge|leuven|hasselt/.test(s))return 'Flandre';
 return 'Belgique';
}
function normalize(n){
 const num=(txt(get(n,'publication-number')).match(/\d{1,8}-\d{4}/)||[])[0];
 const title=txt(get(n,'notice-title')).slice(0,1100);
 if(!num||!title)return null;
 const kind=txt(get(n,'notice-type')).toLowerCase();
 // Results of already awarded procedures are not upcoming calls for tenders.
 if(/^(can-|result-|can-|can\b|award-|res-)/.test(kind))return null;
 const desc=[txt(get(n,'description-proc')),txt(get(n,'description-lot'))].filter(Boolean).join('\n\n').slice(0,2600);
 const cpvs=codes(get(n,'classification-cpv'));const sector=classify(title,desc,cpvs);
 if(!sector)return null;
 const dates=flatten(['deadline-receipt-tender-date-lot','deadline-receipt-request-date-lot','deadline-receipt-expressions-date-lot'].map(f=>get(n,f)));
 const due=earliestDate(dates)||earliestDate(get(n,'deadline'));
 return {
  id:'ted:'+num,publicationNumber:num,procedureIdentifier:txt(get(n,'procedure-identifier')),
  title,buyer:txt(get(n,'buyer-name')).slice(0,500)||'Acheteur non précisé',
  region:region(n),sector:sector.sector,sectors:sector.sectors,score:sector.score,
  publication:iso(get(n,'publication-date')),deadline:due,cpv:cpvs,
  description:desc||'Le détail de cette prestation est à consulter dans l’avis officiel.',
  source:'TED',source_status:'api',noticeType:kind,
  url:'https://ted.europa.eu/fr/notice/-/detail/'+num
 };
}
/* Revalider les données existantes avant fusion pour écarter les faux positifs
   découverts à mesure que le dictionnaire métier est affiné. Les identifiants
   des dossiers conservés restent stables. */
function cleanPrevious(items){
 const output=[],removed=[];
 for(const m of items||[]){
  if(!m||!m.title||m.source==='Démo')continue;
  const rating=classify(m.title,m.description,m.cpv||[]);
  if(!rating){removed.push(m.publicationNumber||m.id);continue}
  output.push({...m,sector:rating.sector,sectors:rating.sectors,score:rating.score});
 }
 return {items:output,removed};
}
function combine(old,newItems){
 const byId=new Map(),byPub=new Map(),byProcedure=new Map();
 function index(r){
  for(const p of [r.publicationNumber,...(r.noticeNumbers||[]),...(r.relatedNoticeNumbers||[])]){
   if(p)byPub.set(p,r.id);
  }
  if(r.procedureIdentifier)byProcedure.set(r.procedureIdentifier,r.id);
 }
 for(const r of old||[]){
  if(!r||!r.id||!r.title||r.source==='Démo')continue;
  const item={...r,sectors:[...new Set(r.sectors||[r.sector])]};
  byId.set(item.id,item);index(item);
 }
 for(const n of newItems){
  const prevId=byPub.get(n.publicationNumber)||byProcedure.get(n.procedureIdentifier);
  if(!prevId||!byId.has(prevId)){byId.set(n.id,n);index(n);continue}
  const prior=byId.get(prevId);
  const nextDate=n.publication||'';
  const latest=nextDate>=(prior.publication||'');
  const merged={...(latest?prior:n),...(latest?n:prior)};
  merged.id=prevId;
  merged.sectors=[...new Set([...(prior.sectors||[]),...(n.sectors||[])])];
  merged.score=Math.max(prior.score||0,n.score||0);
  merged.noticeNumbers=[...new Set([...(prior.noticeNumbers||[]),...(prior.relatedNoticeNumbers||[]),prior.publicationNumber,n.publicationNumber].filter(Boolean))];
  merged.procedureIdentifier=n.procedureIdentifier||prior.procedureIdentifier||'';
  merged.deadline=latest?(n.deadline||prior.deadline):(prior.deadline||n.deadline);
  merged.description=merged.description||prior.description||n.description;
  merged.source_status=n.source_status;
  byId.set(prevId,merged);index(merged);
 }
 return [...byId.values()].sort((a,b)=>(b.publication||'').localeCompare(a.publication||'')||(b.score||0)-(a.score||0));
}
function asUTC(date){return date.toISOString().slice(0,10).replace(/-/g,'')}
function utcDay(date,days){return new Date(date.getTime()+days*86400000)}
function wait(ms){return new Promise(r=>setTimeout(r,ms))}
async function request(query,fields,page){
 const req={query,fields,page,limit:PAGE,scope:'ALL',paginationMode:'PAGE_NUMBER',checkQuerySyntax:false};
 for(let attempt=1;attempt<=3;attempt++){
  const ctrl=new AbortController();const timer=setTimeout(()=>ctrl.abort(),45000);
  try{
   const response=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify(req),signal:ctrl.signal});
   const body=await response.text();
   if(response.ok){
    const json=JSON.parse(body);
    if(!Array.isArray(json.notices))throw Error('Réponse TED sans liste notices');
    return json;
   }
   if([429,502,503,504].includes(response.status)&&attempt<3){await wait(2000*attempt);continue}
   throw Error('HTTP '+response.status+' '+body.slice(0,380));
  }catch(e){
   if(attempt===3||!/(abort|fetch failed|ETIMEDOUT|ECONNRESET)/i.test(String(e.message)))throw e;
   await wait(1000*attempt);
  }finally{clearTimeout(timer)}
 }
}
async function retrieve(query){
 const out=[];let fields=FIELDS;let reported=null;
 for(let page=1;page<=SAFE_MAX_PAGES;page++){
  let response;
  try{response=await request(query,fields,page)}
  catch(e){
   if(page===1&&fields===FIELDS&&/HTTP 400/.test(String(e.message))){
    fields=FIELD_FALLBACK;
    response=await request(query,fields,page);
   }else throw e;
  }
  if(reported===null)reported=Number(response.totalNoticeCount||response.totalCount||0);
  out.push(...response.notices);
  if(response.notices.length<PAGE||reported>0&&out.length>=reported)break;
  if(page===SAFE_MAX_PAGES)throw Error('Plus de '+SAFE_MAX_PAGES+' pages : fenêtre de collecte trop large');
  await wait(200);
 }
 return {notices:out,total:reported,fields};
}
async function run(){
 let previous={items:[],data_origin:'none'};
 try{previous=JSON.parse(fs.readFileSync(OUTPUT,'utf8'))}catch(e){if(e.code!=='ENOENT')throw e}
 const now=new Date();
 const INITIAL=previous.data_origin!=='ted_api';
 const lookback=Number(process.env.MARCHE_RADAR_DAYS|| (INITIAL?100:12));
 if(!Number.isInteger(lookback)||lookback<1||lookback>366)throw Error('MARCHE_RADAR_DAYS invalide');
 const start=utcDay(now,-lookback+1);
 const notices=[],stats=[],warnings=[];
 const STEP=INITIAL?10:7;
 for(let day=new Date(start);day<=now;day=utcDay(day,STEP)){
  const end=utcDay(day,STEP-1)<now?utcDay(day,STEP-1):now;
  const interval='PD = ('+asUTC(day)+' <> '+asUTC(end)+')';
  for(const source of [
   {name:'Acheteurs belges',expr:'buyer-country=BEL',required:true},
   {name:'Exécution en Belgique',expr:'place-of-performance=BEL',required:false}
  ]){
   const q=source.expr+' AND '+interval+' SORT BY PD DESC';
   try{
    const res=await retrieve(q);
    notices.push(...res.notices);
    stats.push({source:source.name,from:asUTC(day),to:asUTC(end),found:res.notices.length,reported:res.total});
    console.log(source.name,asUTC(day),asUTC(end),res.notices.length,'avis');
   }catch(e){
    if(source.required)throw Error(source.name+' '+interval+' : '+e.message);
    warnings.push(source.name+' '+interval+' : '+e.message);
    console.warn('Source complémentaire non disponible:',warnings[warnings.length-1]);
   }
  }
 }
 if(!stats.length)throw Error('Aucune réponse TED exploitable');
 const unique=new Map();
 for(const raw of notices){
  const n=normalize(raw);
  if(n)unique.set(n.publicationNumber,n);
 }
 const cleaned=cleanPrevious(previous.items||[]);
 const markets=combine(cleaned.items,[...unique.values()]);
 if(cleaned.removed.length)console.log('Annonces hors périmètre nettoyées:',cleaned.removed.length);
 if(!markets.length)throw Error('Aucun marché exploitable : données existantes conservées');
 const timestamp=new Date().toISOString();
 const data={
  schema_version:2,generated_at:timestamp,data_origin:'ted_api',
  collector_status:warnings.length?'partial':'ok',
  note:'TED interrogé le '+timestamp.slice(0,10)+' : '+notices.length+' avis examinés ; '+unique.size+' notices liées aux métiers KDRIX détectées sur la période. BOSA et conseils communaux encore non raccordés.',
  coverage:{TED:warnings.length?'partiel : exécution en Belgique incomplète':'collecte automatique active',BOSA:'non connecté',communal:'non connecté'},
  metrics:{scanned:notices.length,matched_current_run:unique.size,records:markets.length,excluded_after_dictionary_update:cleaned.removed.length,days_queried:lookback,queries:stats,warnings},
  items:markets
 };
 fs.writeFileSync(OUTPUT,JSON.stringify(data,null,2)+'\n','utf8');
 console.log('MARCHERADAR_OK',JSON.stringify({matched:unique.size,records:markets.length,scanned:notices.length}));
}
module.exports={txt,flatten,iso,earliestDate,codes,classify,region,normalize,cleanPrevious,combine,retrieve,run};
if(require.main===module){run().catch(e=>{console.error('MARCHERADAR_ERROR',e.message);process.exitCode=1})}
