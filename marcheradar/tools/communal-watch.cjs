/* MarchéRadar — veille progressive des communes wallonnes.
 * URL des communes = répertoire officiel ODWB. On ne déduit AUCUNE URL
 * de délibérations ; les liens doivent être trouvés sur le site communal.
 * L'état "connecté" n'est donné qu'après lecture effective de documents.
 */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process'),os=require('node:os');
const profile=require('./kdrix-profile.cjs');
const REGISTRY=path.resolve(__dirname,'../communes.json');
const DATA=path.resolve(__dirname,'../data.json');
const BATCH=Number(process.env.COMMUNAL_BATCH||24);
const DELAY=Number(process.env.COMMUNAL_DELAY_MS||700);
const ENDPOINTS=4, MAX_PDF=2;
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const clean=s=>String(s||'').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ')
 .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ')
 .replace(/&(?:nbsp|amp|lt|gt|quot|#39);/gi,' ')
 .replace(/\s+/g,' ').trim();
function isSafeURL(target,origin){
 try{
  const url=new URL(target,origin);
  if(!/^https?:$/.test(url.protocol)||url.username||url.password)return false;
  const x=url.hostname.toLowerCase();
  if(x==='localhost'||x.endsWith('.local')||x.endsWith('.internal')||/^\d{1,3}(?:\.\d{1,3}){3}$/.test(x))return false;
  return true;
 }catch(e){return false}
}
function anchors(html,base){
 const found=[];
 const text=String(html||'');
 const pattern=/<a\b([^>]*?)>([\s\S]*?)<\/a>/gi;
 for(const m of text.matchAll(pattern)){
  const link=m[1].match(/\bhref\s*=\s*(?:"([^"]+)"|'([^']+)')/i);
  if(!link)continue;
  const raw=link[1]||link[2];if(!isSafeURL(raw,base))continue;
  let url;try{url=new URL(raw,base);url.hash='';}catch(e){continue}
  const title=clean(m[2]).slice(0,140),text=(title+' '+url.pathname).toLowerCase();
  if(!found.some(x=>x.url===url.href))found.push({url:url.href,title,text});
 }
 return found;
}
function officialLink(candidate,home){
 try{
  const a=new URL(candidate),b=new URL(home);
  const ha=a.hostname.replace(/^www\./,''),hb=b.hostname.replace(/^www\./,'');
  return ha===hb||ha.endsWith('.'+hb)||ha==='deliberations.be'||ha.endsWith('.deliberations.be');
 }catch(e){return false}
}
const COUNCIL=/conseil communal|conseil municipal|deliberation|deliberations|proces verbal|proces-verbal|pv.des.seances|compte rendu|comptes rendus|ordre du jour|ordres du jour|decision|publication|vie politique/;
const DOC=/\.(?:pdf|docx?|odt)(?:\?|$)/i;
function candidates(html,url){
 return anchors(html,url).filter(x=>officialLink(x.url,url)&&
  (COUNCIL.test(profile.fold(x.text))||DOC.test(x.url))).sort((a,b)=>{
    const a1=COUNCIL.test(profile.fold(a.text)),b1=COUNCIL.test(profile.fold(b.text));
    return Number(b1)-Number(a1);
  });
}
async function fetchBytes(url,limit=4500000){
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),17000);
 try{
  const r=await fetch(url,{redirect:'follow',signal:ctrl.signal,headers:{'User-Agent':'KDRIX-MarcheRadar/1.0 public-documents','Accept':'text/html,application/pdf,application/msword'}});
  if(!r.ok)throw Error('HTTP '+r.status);
  if(!isSafeURL(r.url,url))throw Error('Redirection non vérifiée');
  const buf=Buffer.from(await r.arrayBuffer());
  if(buf.length>limit)throw Error('Document trop volumineux');
  return {bytes:buf,url:r.url||url,contentType:r.headers.get('content-type')||''};
 }finally{clearTimeout(timer)}
}
function pdfText(bytes){
 const target=path.join(os.tmpdir(),'kdrix-pv-'+crypto.randomBytes(6).toString('hex')+'.pdf');
 try{
  fs.writeFileSync(target,bytes);
  return cp.execFileSync('pdftotext',['-layout',target,'-'],{timeout:15000,encoding:'utf8',maxBuffer:8_000_000});
 }finally{try{fs.unlinkSync(target)}catch(e){}}
}
function excerpts(raw){
 const text=String(raw||'');
 if(!text.trim())return [];
 const lines=text.split(/\r?\n/).map(x=>x.trim()).filter(x=>x.length>20);
 const SIGNAL=/(topograph|geom[eè]tr|bathym|hydrograph|jaugeag|bornag|division parcellaire|scanner|photogramm|relev[eé]|arpentage|voirie|route|cheminement|[eé]gout|assainissement|inondation|ruissellement|bassin d'orage|cours d'eau|servitude|propri[eé]t[eé] fonci|plan cadastral|[eé]nerg[eé]tique|peb|auteur de projet|bureau d'[eé]tude|estimation immobili[eè]re|cartograph|[eé]tude technique|acquisition de terrain|vente de terrain|[eé]quipement communal)/i;
 const INTENT=/(d[eé]cid|approuv|march[eé]|bureau|[eé]tude|projet|budget|appel|consultation|passation|acquisition|d[eé]signation|program|r[eé]alisation|envisag)/i;
 const neg=/n'est pas envisag[eé]|ne sera pas r[eé]alis[eé]|projet abandonn[eé]|aucune consultation/i;
 const result=[];
 for(let i=0;i<lines.length;i++){
  if(!SIGNAL.test(lines[i]))continue;
  const part=lines.slice(Math.max(0,i-2),Math.min(lines.length,i+4)).join(' ').slice(0,1800);
  if(!INTENT.test(part)||neg.test(part))continue;
  if(!result.some(x=>x.slice(0,100)===part.slice(0,100)))result.push(part);
  if(result.length>=8)break;
 }
 return result;
}
function councilStage(evidence){
 const s=profile.fold(evidence);
 if(/\b(?:attribu|designat|adjudicat|prestataire retenu|soumissionnaire retenu)\w*/.test(s))return 'prestataire_designe';
 if(/(?:lancement|lancer|mise en concurrence|consulter plusieurs|cahier special des charges|passation)\b/.test(s))return 'consultation_annoncee';
 if(/(?:budget|etude a|besoin de bureau|mission d'etude|recherche d'un bureau)\b/.test(s))return 'etude_a_prevoir';
 if(/(?:approuv|decid|adopt)\w*/.test(s))return 'projet_approuve';
 return 'projet_evoque';
}
function dateFromText(text){
 const value=String(text||'').slice(0,1400);
 const i=value.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
 if(i)return i[0];
 const j=value.match(/\b([0-3]\d)[\/\.]([01]\d)[\/\.](20\d{2})\b/);
 return j?j[3]+'-'+j[2]+'-'+j[1]:null;
}
function opportunity(commune,document,text){
 const classification=profile.screen({title:text.slice(0,250),description:text,source:'LOCALE',
 buyer:commune.name,region:'Wallonie',opportunityType:'prospection'}).classification;
 if(!classification)return null;
 const digest=crypto.createHash('sha256').update(commune.ins+'|'+document.url+'|'+profile.fold(text.slice(0,190))).digest('hex').slice(0,20);
 return {
  id:'communal:'+digest,title:'Prospection · '+commune.name+' · '+text.slice(0,118)+(text.length>118?'…':''),
  buyer:'Commune de '+commune.name,municipalityINS:commune.ins,region:'Wallonie',
  sector:classification.sector,sectors:classification.sectors,
  score:Math.min(68,classification.score),screening:'review',
  opportunityType:'prospection',opportunityStage:councilStage(text),
  source:'LOCALE',source_status:'detection_a_verifier',
  publication:'',dateSource:null,dateMention:dateFromText(text),deadline:'',cpv:[],
  description:'Extrait du document public : '+text+'\nLe document complet doit être vérifié avant tout contact commercial.',
  evidence:text,url:document.url,sourceDocument:document.url,
  officialSources:[{source:'Site communal officiel',url:document.url}]
 };
}
async function scanCommune(commune){
 const errors=[],docs=[],sources=[];
 const site=await fetchBytes(commune.officialSite,2200000);
 if(!/^text\/html|<html|<!doctype html/i.test(site.contentType+' '+site.bytes.slice(0,60)))throw Error('Site officiel non HTML');
 const homepage=site.bytes.toString('utf8');
 commune.lastSiteCheck=new Date().toISOString();
 const seen=new Set();
 const queue=candidates(homepage,site.url).filter(x=>COUNCIL.test(profile.fold(x.text))).slice(0,ENDPOINTS);
 // Documents PDF directement annoncés sur la page d'accueil.
 for(const x of candidates(homepage,site.url).filter(x=>DOC.test(x.url)).slice(0,MAX_PDF))if(!queue.some(y=>y.url===x.url))queue.push(x);
 let examined=0;
 for(const item of queue){
  try{
   await delay(DELAY);
   const r=await fetchBytes(item.url,5000000);
   let text='';
   if(DOC.test(r.url)||/^%PDF/.test(r.bytes.slice(0,6).toString()))text=pdfText(r.bytes);
   else text=clean(r.bytes.toString('utf8'));
   if(text.length<80)continue; // Ne pas qualifier une page JavaScript vide de source connectée.
   examined++;
   sources.push({url:item.url,title:item.title,type:/deliberations\.be/.test(item.url)?'deliberations_be':'site_communal',
    last_success:new Date().toISOString(),documentsRead:1});
   for(const s of excerpts(text)){const o=opportunity(commune,{url:item.url},s);if(o)docs.push(o)}
   // Une page de conseil renvoie souvent à des projets/PV en PDF.
   if(!DOC.test(r.url)&&text.length>=50){
    const sub=candidates(r.bytes.toString('utf8'),r.url).filter(x=>DOC.test(x.url)).slice(0,MAX_PDF);
    for(const pdf of sub){
     if(seen.has(pdf.url))continue;seen.add(pdf.url);
     try{
      await delay(DELAY);
      const buf=await fetchBytes(pdf.url,7000000);
      if(!/^%PDF/.test(buf.bytes.slice(0,6).toString()))continue;
      examined++;const extracted=pdfText(buf.bytes);
      for(const s of excerpts(extracted)){const o=opportunity(commune,{url:pdf.url},s);if(o)docs.push(o)}
     }catch(e){errors.push({url:pdf.url,reason:String(e.message||e).slice(0,120)})}
    }
   }
  }catch(e){errors.push({url:item.url,reason:String(e.message||e).slice(0,120)})}
 }
 return {sources,docs,examined,errors};
}
async function run(){
 if(!fs.existsSync(REGISTRY))throw Error('Exécuter le répertoire ODWB avant la collecte communale');
 const registry=JSON.parse(fs.readFileSync(REGISTRY,'utf8'));
 const data=JSON.parse(fs.readFileSync(DATA,'utf8'));
 const eligible=registry.communes.filter(x=>x.zone!=='exterieure_provisoire'&&x.officialSite);
 const ordered=eligible.sort((a,b)=>String(a.lastSiteCheck||'').localeCompare(String(b.lastSiteCheck||''))+(a.estimatedMinutes||999)-(b.estimatedMinutes||999));
 const selected=ordered.slice(0,Math.min(30,Math.max(1,BATCH)));
 const existing=new Set((data.items||[]).map(x=>x.id));
 const added=[];let sitesOK=0,docsRead=0,errors=0;
 for(const commune of selected){
  try{
   const result=await scanCommune(commune);
   commune.sourceStatus=result.sources.length?'sources_documents_lus':'site_verifie_sans_document';
   commune.deliberationSources=result.sources;
   commune.lastDocumentCheck=new Date().toISOString();
   commune.documentsRead=(commune.documentsRead||0)+result.examined;
   commune.opportunities=(commune.opportunities||0)+result.docs.length;
   commune.errors=result.errors.slice(0,12);
   sitesOK++;docsRead+=result.examined;errors+=result.errors.length;
   for(const item of result.docs)if(!existing.has(item.id)){added.push(item);existing.add(item.id)}
  }catch(e){commune.lastSiteCheck=new Date().toISOString();commune.sourceStatus='site_en_erreur';
    commune.errors=[{reason:String(e.message||e).slice(0,180)}];errors++;}
  await delay(DELAY);
 }
 registry.lastMunicipalPass=new Date().toISOString();
 registry.counts.sitesVerifies=registry.communes.filter(x=>/^(?:sources_documents_lus|site_verifie_sans_document)$/.test(x.sourceStatus)).length;
 registry.counts.deliberationsConnectees=registry.communes.filter(x=>x.deliberationSources.some(y=>y.last_success)).length;
 registry.counts.checkedWithErrors=registry.communes.filter(x=>x.sourceStatus==='site_en_erreur').length;
 registry.counts.documentsRead=registry.communes.reduce((n,x)=>n+(x.documentsRead||0),0);
 registry.counts.opportunities=registry.communes.reduce((n,x)=>n+(x.opportunities||0),0);
 const watched=registry.counts.deliberationsConnectees;
 data.items.push(...added);
 data.sources={...(data.sources||{}),LOCALE:{status:watched?'partial':'pilot',last_success:registry.lastMunicipalPass,
  municipalitiesTotal:registry.communes.length,municipalitiesInProvisionalZone:eligible.length,
  sitesVerified:registry.counts.sitesVerifies,deliberationSourcesRead:watched,
  checkedThisRun:selected.length,documentsReadTotal:registry.counts.documentsRead,
  newOpportunities:added.length,errorsThisRun:errors}};
 data.coverage={...(data.coverage||{}),communal:'Veille progressive sur '+watched+' communes avec page de conseil lue ; '+registry.counts.sitesVerifies+
  ' sites municipaux vérifiés sur '+registry.communes.length+' répertoriés. Zone de trajet indicative, non routière.'};
 data.metrics={...(data.metrics||{}),local_communes_checked:selected.length,local_new_opportunities:added.length,records:data.items.length};
 fs.writeFileSync(REGISTRY,JSON.stringify(registry,null,2)+'\n','utf8');
 fs.writeFileSync(DATA,JSON.stringify(data,null,2)+'\n','utf8');
 console.log('COMMUNAL_WATCH_OK',JSON.stringify({checked:selected.length,sitesOK,docsRead,added:added.length,errors,covered:watched,total:registry.communes.length}));
}
module.exports={anchors,candidates,excerpts,councilStage,opportunity,run};
if(require.main===module)run().catch(e=>{console.error('COMMUNAL_WATCH_UNAVAILABLE',e.message);process.exitCode=1});
