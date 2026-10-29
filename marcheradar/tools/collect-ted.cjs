/* MarchéRadar KDRIX - collecte automatique d'avis officiels TED.
   Source : https://api.ted.europa.eu/v3/notices/search
   Usage : node marcheradar/tools/collect-ted.cjs
   Aucun secret/API key n'est requis pour l'API de recherche TED.
*/
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const profile=require('./kdrix-profile.cjs');
const awards=require('./awards-ted.cjs');
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
 'place-of-performance-subdiv-lot','place-of-performance-subdiv-proc',
 ...awards.FIELDS
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
 Carto:/(cartograph|geografisch informatiesysteem|geographic information|mapping service|geodata|\bsig\b|\bgis\b|digital terrain model)/,
 PetitsTravaux:/(station.{0,25}limnim[eé]tr|limnim[eé]tr|stations?.{0,30}(?:de mesure|hydrom[eé]tr|jaugeage)|acc[eè]s s[eé]curis[eé].{0,35}cours d.eau|am[eé]nagement.{0,25}acc[eè]s.{0,25}cours d.eau|passerelle.{0,25}jaugeage|[eé]chelle.{0,25}limnim[eé]tr)/
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
function worksScope(title,description,cpvs){
 const top=simplify(title),body=simplify(description);
 const smallRelevant=/(limnimetr|station.{0,25}(?:mesure|hydrometr|jaugeage)|acces securis.{0,35}cours d.eau|amenagement.{0,25}acces.{0,25}cours d.eau|passerelle.{0,25}jaugeage|echelle.{0,25}limnimetr)/;
 const smallDescription=/(petit.{0,12}amenagement|petit.{0,12}reparat|petit.{0,12}ouvrag|plans? d.execution|amenagements? ponctuels?)/;
 const designOnly=/(^|[–:])\s*(etude|étude|conception|services|mission d.auteur de projet|diagnostic|studie|ontwerp)/.test(top)&&!/(travaux|reparation|maintenance|construction)/.test(top);
 const workContext=cpvs.some(code=>/^45/.test(code))||/(travaux|amenagement|reparation|maintenance|petit ouvrage|small works)/.test(top);
 const isSmallWorks=!designOnly&&workContext&&(smallRelevant.test(top)||smallRelevant.test(body)&&smallDescription.test(body));
 // Le curage, le dragage et le désenvasement ne sont pas des prestations KDRIX.
 const curageTitle=/(curage|desenvas|dragage|dredging|baggerwerk|baggeren|riolen reinigen|rioolrein|rioolruim|reiniging.{0,15}rioler)/;
 if(curageTitle.test(top)&&!/^(etude|studie|conception)/.test(top))return {rejected:'curage'};
 const publicWorks=cpvs.some(code=>/^(45|452|453)/.test(code));
 const titleAsWorks=/(travaux de construction|travaux? (?:de |d.)(?:voirie|route|chauss[eé]e|construction|terrassement)|wegen(?:is)?werken|wegenbouw|road construction|aanleg.{0,20}(?:wegen|wegdek)|construction.{0,10}(?:route|road|canalis)|r[eé]habilitation.{0,20}(?:voirie|route))/;
 const servicesRole=/(missions? d.auteur de projet|bureau d.etudes|ma[iî]trise d.[oœ]uvre|ontwerpopdracht|studieopdracht|services? d.ing[eé]nierie|[eé]tudes? (?:de |des )?(?:voirie|v\.?r\.?d|r[eé]seau|hydraul)|conception|ontwerp)/;
 if(isSmallWorks)return {smallWorks:true};
 const mainWork=publicWorks&&/(travaux|construction|renovation|rehabilitation|equipement|installat|aanleg|bouw|werken|uitvoering)/.test(top);
 const directServiceTitle=/(topograph|topograf|landmeet|landmet|releves? |bathym|scan|drone|photogrammetr|geometre|expertise|peb\b|etude|conception|bureau d.etudes|auteur de projet)/.test(top);
 if(mainWork&&!directServiceTitle)return {rejected:'travaux_hors_champ'};
 if((publicWorks||titleAsWorks.test(top))&&
    (titleAsWorks.test(top)||/(travaux de construction|aanleg van|wegeniswerken|uitvoering van werken)/.test(top))&&
    !servicesRole.test(top)){
  return {rejected:'travaux_routiers_ou_generaux'};
 }
 return {smallWorks:false};
}
function classify(title,description,cpvs){return profile.classify(title,description,cpvs)}
function detectRegion(place){
 const s=simplify(place||'');
 const matches=[
  /\bbe1\d{2}\b|bruxelles|brussel|brussels|schaerbeek|anderlecht|etterbeek/,
  /\bbe3\d{2}\b|wallon|liege|namur|charleroi|mons|tournai|verviers|huy|wavre|arlon|dinant|jambes|luxembourg belgique/,
  /\bbe2\d{2}\b|vlaander|antwerpen|gent\b|brugge|leuven|hasselt|oostende|kortrijk/
 ].map(pattern=>pattern.test(s));
 const found=matches.map((yes,i)=>yes?['Bruxelles','Wallonie','Flandre'][i]:null).filter(Boolean);
 return found.length===1?found[0]:null;
}
function region(n){
 // La commune du pouvoir adjudicateur n'est PAS nécessairement le lieu d'exécution.
 const perf=flatten([get(n,'place-of-performance-subdiv-lot'),get(n,'place-of-performance-subdiv-proc')]).join(' ');
 const place=detectRegion(perf);
 if(place)return place;
 // BEZZZ et les marchés multi-régionaux restent visibles "Belgique" pour contrôle.
 if(/\bBEZZZ\b/i.test(perf)||detectRegion(perf)===null&&/\bBE\d{3}\b/.test(perf))return 'Belgique';
 return detectRegion(flatten([get(n,'buyer-city')]).join(' '))||'Belgique';
}
function normalize(n,funnel){
 const reject=function(reason){if(funnel)funnel[reason]=(funnel[reason]||0)+1;return null};
 const num=(txt(get(n,'publication-number')).match(/\d{1,8}-\d{4}/)||[])[0];
 const title=txt(get(n,'notice-title')).slice(0,1100);
 if(!num||!title)return reject('metadonnees_incompletes');
 const kind=txt(get(n,'notice-type')).toLowerCase();
 // Results of already awarded procedures are not upcoming calls for tenders.
 if(/^(can-|result-|can-|can\b|award-|res-)/.test(kind))return reject('avis_attribution_analyse_separement');
 const desc=[txt(get(n,'description-proc')),txt(get(n,'description-lot'))].filter(Boolean).join('\n\n').slice(0,2600);
 const cpvs=codes(get(n,'classification-cpv'));
 const buyer=txt(get(n,'buyer-name')).slice(0,500)||'Acheteur non précisé';
 const place=region(n);
 const verdict=profile.screen({title,description:desc,cpv:cpvs,buyer,region:place,source:'TED'});
 if(!verdict.classification)return reject(verdict.reason||'non_classe');
 const sector=verdict.classification;
 if(funnel)funnel['qualifie_'+sector.screening]=(funnel['qualifie_'+sector.screening]||0)+1;
 const dates=flatten(['deadline-receipt-tender-date-lot','deadline-receipt-request-date-lot','deadline-receipt-expressions-date-lot'].map(f=>get(n,f)));
 const due=earliestDate(dates)||earliestDate(get(n,'deadline'));
 return {
  id:'ted:'+num,publicationNumber:num,procedureIdentifier:txt(get(n,'procedure-identifier')),
  title,buyer,
  region:place,sector:sector.sector,sectors:sector.sectors,score:sector.score,screening:sector.screening,qualification:sector.qualification,matchReason:sector.matchReason,
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
 const output=[],removed=[],reasons={};
 for(const m of items||[]){
  if(!m||!m.title||m.source==='Démo')continue;
  if(m.source==='LOCALE'&&String(m.screeningReason||'').startsWith('verification_locale_')){
   output.push({...m,screening:'excluded'});continue;
  }
  const result=profile.screen(m);
  if(!result.classification){
   removed.push(m.publicationNumber||m.id);
   reasons[result.reason]=(reasons[result.reason]||0)+1;
   // Conserver l'identifiant et la fiche historique : un utilisateur a peut-être
   // déjà classé ce marché. On masque seulement la fiche dans le Listing complet.
   output.push({...m,screening:'excluded',screeningReason:result.reason});
   continue;
  }
  output.push({...m,...result.classification,screeningReason:null});
 }
 return {items:output,removed,reasons};
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
  const prevId=(byId.has(n.id)&&n.id)||byPub.get(n.publicationNumber)||byProcedure.get(n.procedureIdentifier);
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
  // An ISO submission timestamp verified on the official BOSA workspace must not
  // be overwritten by an older, date-only summary from a different source.
  merged.deadline=prior.deadlineSourceKind==='bosa_verified_public'&&prior.deadline?
    prior.deadline:(latest?(n.deadline||prior.deadline):(prior.deadline||n.deadline));
  merged.description=merged.description||prior.description||n.description;
  merged.source_status=n.source_status;
  const rating=classify(merged.title,merged.description,merged.cpv||[]);
  if(rating)Object.assign(merged,rating);
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
 const unique=new Map(),rawFunnel={};
 for(const raw of notices){
  const n=normalize(raw,rawFunnel);
  if(n)unique.set(n.publicationNumber,n);
 }
 const cleaned=cleanPrevious(previous.items||[]);
 const markets=combine(cleaned.items,[...unique.values()]);
 const enriched=awards.attach(markets,notices);
 const finalMarkets=enriched.items;
 const reviewCount=finalMarkets.filter(x=>x.screening==='review').length;
 const bosaCount=finalMarkets.filter(x=>x.source==='BOSA').length;
 if(cleaned.removed.length)console.log('Anciennes fiches hors périmètre conservées mais masquées par défaut:',cleaned.removed.length);
 if(!finalMarkets.length)throw Error('Aucun marché exploitable : données existantes conservées');
 const timestamp=new Date().toISOString();
 const data={
  schema_version:2,generated_at:timestamp,data_origin:'ted_api',
  collector_status:warnings.length?'partial':'ok',
  note:'TED interrogé le '+timestamp.slice(0,10)+' : '+notices.length+' avis lus, '+enriched.marketMatches+' procédure(s) enrichie(s) par des résultats publics. BOSA national et conseils communaux encore à raccorder.',
  sources:previous.sources||{},
  coverage:{...(previous.coverage||{}),TED:warnings.length?'partiel : exécution en Belgique incomplète':'collecte automatique active'},
  metrics:{...(previous.metrics||{}),scanned:notices.length,raw_screening:rawFunnel,matched_current_run:unique.size,records:finalMarkets.length,review_count:reviewCount,award_notice_count:enriched.awardNotices,awarded_market_matches:enriched.marketMatches,award_fields_requested:stats.every(s=>s.fields?.includes('winner-name')),retained_as_excluded:cleaned.removed.length,excluded_reasons:cleaned.reasons,days_queried:lookback,queries:stats,warnings},
  items:finalMarkets
 };
 fs.writeFileSync(OUTPUT,JSON.stringify(data,null,2)+'\n','utf8');
 console.log('MARCHERADAR_OK',JSON.stringify({matched:unique.size,records:finalMarkets.length,awardNotices:enriched.awardNotices,awardMatches:enriched.marketMatches,scanned:notices.length}));
}
module.exports={txt,flatten,iso,earliestDate,codes,classify,worksScope,detectRegion,region,normalize,cleanPrevious,combine,retrieve,run};
if(require.main===module){run().catch(e=>{console.error('MARCHERADAR_ERROR',e.message);process.exitCode=1})}
