/* MarchéRadar — première lecture ciblée des délibérations communales.
 * Sources issues des pages communales découvertes, ne jamais inventer un projet.
 * Chaque opportunité conserve un extrait du document et son lien officiel.
 */
'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),crypto=require('node:crypto');
const profile=require('./kdrix-profile.cjs');
const {selection}=require('./communes-scope.cjs');
const queueApi=require('./municipal-queue.cjs');
const sourcePolicy=require('./communal-source-policy.cjs');
const webType=require('./web-publication-type.cjs');
const signals=require('./municipal-signals.cjs');
const documentDates=require('../document-dates.js');
const sourceHealth=require('../source-health.js');
const INVENTORY=path.resolve(__dirname,'../communes.json'),DATA=path.resolve(__dirname,'../data.json');
const EXTRACTION_VERSION='2026-10-29-document-dates-v5';
const MAX_COMMUNES=Math.min(8,Math.max(1,Number(process.env.COMMUNES_DOC_BATCH||4)));
const MATCH=/(?:topograph|g[eé]om[eè]tr|bornage|division parcell|bathym[eé]tr|jaugeag|limnim[eé]tr|[eé]tude hydraulique|bureau d.[eé]tudes|auteur de projet|d[eé]tection de r[eé]seaux|scanner laser|photogramm[eé]tr|certificat PEB|certification [eé]nerg[eé]tique|lev[eé] de terrain|[eé]valuation immobili[eè]re|relev[eé] de cours d.eau|voirie|espace public|am[eé]nagement.{0,15}place|bassin d.orage|acquisition.{0,15}parcelle|vente.{0,15}terrain)/i;
const INTENT=/(?:d[eé]cide|approuve|d[eé]lib[eè]re|march[eé] de services|d[eé]signation|consultation|cahier sp[eé]cial des charges|lancement d.un march[eé]|mise en concurrence|bureau d.[eé]tudes|mission d.auteur de projet|budget d.[eé]tudes?)/i;
function textOnly(h){return String(h||'').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]*>/g,' ').replace(/&(?:amp|nbsp|quot|#39);/gi,' ').replace(/\s+/g,' ').trim()}
function fileLinks(html,base){
 const out=[];
 for(const a of String(html).matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)){
  let uri;try{uri=new URL(a[1].replace(/&amp;/g,'&'),base)}catch(e){continue}
  if(!/^https?:$/.test(uri.protocol))continue;
  const title=textOnly(a[2]).slice(0,90);
  const gateway=/\/download\/[^/]+\/?$/i.test(uri.pathname)&&/ordre.{0,15}jour|proc[eè]s.{0,10}verbal|\bpv\b|avis.{0,15}march[eé]|cahier.{0,15}charges/i.test(title);
  const typed=/type\s*=\s*["']application\/pdf["']/i.test(a[0])||/\/@@download\/file(?:$|\?)/i.test(uri.href);
  if(!/\.pdf(?:$|[?#])/i.test(uri.href)&&!gateway&&!typed)continue;
  // WordPress Download Monitor ajoute une valeur de cache variable : elle ne
  // doit pas créer une nouvelle identité de document à chaque passage.
  if(gateway)uri.searchParams.delete('tmstv');
  uri.hash='';
  if(!out.some(x=>x.url===uri.href))out.push({url:uri.href,title});
 }
 return out;
}
function childPages(html,base){
 const parent=new URL(base),out=[];
 for(const a of String(html).matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)){
  let u;try{u=new URL(a[1].replace(/&amp;/g,'&'),base)}catch(e){continue}
  u.hash='';
  if(u.origin!==parent.origin||u.pathname===parent.pathname||!u.pathname.startsWith(parent.pathname.replace(/\/$/,'')+'/'))continue;
  if(/\.pdf(?:$|[?#])/i.test(u.href)||!/conseil|deliber|d[eé]lib[eé]r|proces|proc[eè]s|ordre|seance|s[eé]ance|pv-|march[eé]s|20\d{2}/i.test(u.pathname+' '+textOnly(a[2])))continue;
  if(!sourcePolicy.excluded({url:u.href,title:textOnly(a[2])})&&!out.includes(u.href))out.push(u.href);
 }return out;
}
function readableSource(s){return s.scopeStatus!=='non_documentary'&&!sourcePolicy.excluded(s)&&(s.status==='page_accessible'||s.status==='document_pdf_a_analyser')}
async function download(url,type,max,options={}){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
 try{
  const headers={Accept:type,'User-Agent':'KDRIX-PublicCouncilMonitor/1.1'};
  const before=options.previous,at=Date.parse(options.now||new Date().toISOString());
  // Relecture complète au moins tous les 7 jours, même avec des validateurs HTTP.
  const age=before?at-Date.parse(before.contentCheckedAt||''):NaN;
  if(before?.sha256&&Number.isFinite(age)&&age>=0&&age<7*86400000){
   if(before.etag)headers['If-None-Match']=before.etag;
   if(before.lastModified)headers['If-Modified-Since']=before.lastModified;
  }
  const r=await (options.fetchFn||fetch)(url,{signal:controller.signal,headers});
  if(r.status===304){
   if(!before?.sha256||(!headers['If-None-Match']&&!headers['If-Modified-Since']))throw Error('Réponse 304 sans version vérifiable');
   return {notModified:true,finalUrl:r.url||url};
  }
  if(!r.ok)throw Error('HTTP '+r.status);
  if(Number(r.headers.get('content-length')||0)>max)throw Error('Fichier supérieur à la limite');
  if(!r.body)throw Error('Réponse vide');
  const reader=r.body.getReader(),chunks=[];let length=0;
  try{while(true){const part=await reader.read();if(part.done)break;length+=part.value.length;
   if(length>max){await reader.cancel();throw Error('Fichier supérieur à la limite');}chunks.push(Buffer.from(part.value));
  }}finally{reader.releaseLock();}
  return {bytes:Buffer.concat(chunks),finalUrl:r.url||url,etag:r.headers.get('etag')||'',lastModified:r.headers.get('last-modified')||''};
 }finally{clearTimeout(timer)}
}
function pdfText(bytes){
 if(bytes.slice(0,5).toString()!=='%PDF-')return '';
 const tmp=path.join(os.tmpdir(),'kdrix-council-'+crypto.randomBytes(8).toString('hex')+'.pdf');
 try{fs.writeFileSync(tmp,bytes);return cp.execFileSync('pdftotext',['-layout',tmp,'-'],{encoding:'utf8',timeout:16000,maxBuffer:6000000})}
 finally{try{fs.unlinkSync(tmp)}catch(e){}}
}
function passages(text){
 const out=[];let sectionHeading=null;
 for(const [pageNo,page] of String(text||'').split('\f').entries()){
  const lines=page.split('\n').map(x=>x.trim()).filter(Boolean);
  for(let i=0;i<lines.length;i++){
   if(/^\d{1,3}[.)]\s+.{30,}/.test(lines[i]))sectionHeading=lines[i].slice(0,250);
   if(!MATCH.test(lines[i])||/agent constatateur|assermentation|d[eé]signation.{0,35}(?:conseiller|d[eé]l[eé]gu[eé]|membre du conseil)/i.test(lines[i]))continue;
   let lo=Math.max(0,i-2),hi=Math.min(lines.length,i+5);
   for(let j=i;j>=lo;j--)if(/^\d{1,3}[.)]\s/.test(lines[j])){lo=j;break}
   for(let j=i+1;j<hi;j++)if(/^\d{1,3}[.)]\s/.test(lines[j])){hi=j;break}
   const quote=lines.slice(lo,hi).join(' ').slice(0,1400);
   if(INTENT.test(quote)&&!out.some(x=>x.excerpt.slice(0,100)===quote.slice(0,100)))out.push({excerpt:quote,page:pageNo+1,sectionHeading});
   if(out.length>=36)return signals.group(out).slice(0,6);
  }
 }
 return signals.group(out).slice(0,6);
}
function evidence(text){return passages(text).map(x=>x.excerpt)}
function digest(value){return crypto.createHash('sha256').update(value).digest('hex')}
function documentId(url){return 'municipal-doc:'+digest(url).slice(0,18)}
function normalized(text){return String(text||'').normalize('NFKC').replace(/\s+/g,' ').trim()}
function belongs(m,commune,url){return m.source==='LOCALE'&&(m.sourceDocument||m.url)===url&&
 (m.municipalityINS===commune.ins||m.buyer==='Commune de '+commune.name)}
function processDocument(items,commune,pdf,file,now,extract=pdfText){
 const id=documentId(pdf.url),prior=commune.documentChecks?.[id]||{};
 const linked=items.filter(m=>belongs(m,commune,pdf.url));
 let sha=prior.sha256,text=null,changed=false,parsed=false;
 const check={...prior,url:pdf.url,finalUrl:file.finalUrl||pdf.url,lastAttempt:now,lastChecked:now,lastSuccess:now,lastError:null};
 if(!file.notModified){
  if(!Buffer.isBuffer(file.bytes)||file.bytes.subarray(0,5).toString()!=='%PDF-')throw Error('Le fichier reçu n’est pas un PDF');
  sha=digest(file.bytes);changed=!!prior.sha256&&prior.sha256!==sha;
  if(sha!==prior.sha256||prior.extractorVersion!==EXTRACTION_VERSION){text=extract(file.bytes);if(!text||!text.trim())throw Error('PDF sans texte exploitable ; version antérieure conservée');parsed=true;}
  check.etag=file.etag||'';check.lastModified=file.lastModified||'';check.contentCheckedAt=now;
 }else if(!sha)throw Error('Version précédente absente');
 if(changed){
  check.history=[...(prior.history||[]),{sha256:prior.sha256,firstSeenAt:prior.firstSeenAt,lastSeenAt:prior.lastSuccess||prior.lastChecked||null}];
  check.changedAt=now;
 }
 if(parsed)check.sourceDocumentDates=documentDates.extract({text,title:pdf.title,url:pdf.url,sha256:sha});
 if(parsed){check.extractorVersion=EXTRACTION_VERSION;check.textExtractedAt=now;}
 check.sha256=sha;check.firstSeenAt=(!prior.sha256||changed)?now:prior.firstSeenAt;
 const nextCommune={...commune,documentChecks:{...(commune.documentChecks||{}),[id]:check}};
 const wasRead=(commune.readDocuments||[]).includes(id);
 nextCommune.readDocuments=[...new Set([...(commune.readDocuments||[]),id])];
 nextCommune.documentsRead=(commune.documentsRead||0)+(wasRead?0:1);
 nextCommune.documentVersionsRead=(commune.documentVersionsRead||0)+(parsed&&sha!==prior.sha256?1:0);
 const candidates=text===null?[]:passages(text).map(p=>({...p,rating:profile.screen({title:p.excerpt.slice(0,180),description:p.excerpt,buyer:'Commune de '+commune.name,region:'Wallonie',source:'LOCALE',opportunityType:'prospection'}).classification})).filter(p=>p.rating);
 // Les passages nouveaux d'un document déjà suivi ne deviennent pas silencieusement
 // de nouveaux dossiers : cela ressusciterait une décision Hors sujet après correction du PDF.
 // Les signaler comme passages du DOCUMENT, sans inventer leur rattachement au marché.
 const review=linked.length?candidates.filter(p=>!linked.some(m=>normalized(m.evidence)===normalized(p.excerpt))).map(({excerpt,page})=>({excerpt,page})):[];
 const version={documentId:id,sha256:sha,checkedAt:now,changedAt:check.changedAt||null};
 let result=items.map(m=>{
  if(!belongs(m,commune,pdf.url))return m;
  const next={...m,sourceDocumentVersion:version,sourceDocumentDates:check.sourceDocumentDates||documentDates.extract({title:pdf.title,url:pdf.url})};
  if(text!==null){
   next.sourceEvidenceStatus=m.evidence?(normalized(text).includes(normalized(m.evidence))?'found':'not_found'):'unverified';
   next.sourceDocumentReview={sha256:sha,checkedAt:now,candidates:review};
   if(next.sourceEvidenceStatus==='found'){
    const type=webType.classify((pdf.title||'')+' '+pdf.url.replace(/[\/_-]/g,' '),text,m.evidence);
    next.noticeKind=type.kind;next.webSourceType='municipal';
    next.webTypeEvidence={...type,sourceUrl:pdf.url,page:m.sourceEvidencePage||null,sha256:sha};
   }
  }
  return next;
 });
 let created=0;
 if(!linked.length){
  const known=new Set(items.map(x=>x.id));
  for(const p of candidates){
   // Conserver l'algorithme d'identifiant historique pour les premières lectures.
   const marketId='local:'+digest(pdf.url+'|'+p.excerpt.slice(0,170)).slice(0,20);
   if(known.has(marketId))continue;
   known.add(marketId);created++;
   result.push({id:marketId,title:'Conseil communal — opportunité à vérifier : '+commune.name,buyer:'Commune de '+commune.name,
    municipalityINS:commune.ins,region:'Wallonie',source:'LOCALE',webSourceType:'municipal',opportunityType:'prospection',
    noticeKind:webType.classify((pdf.title||'')+' '+pdf.url.replace(/[\/_-]/g,' '),text,p.excerpt).kind,
    webTypeEvidence:{...webType.classify((pdf.title||'')+' '+pdf.url.replace(/[\/_-]/g,' '),text,p.excerpt),sourceUrl:pdf.url,page:p.page,sha256:sha},
    opportunityStage:'décision ou besoin à vérifier',sector:p.rating.sector,sectors:p.rating.sectors,
    score:Math.min(60,p.rating.score),screening:'review',qualification:p.rating.qualification,publication:'',deadline:'',
    sourceDocument:pdf.url,sourceDocumentDates:check.sourceDocumentDates,url:pdf.url,cpv:[],description:'Document communal public. Extrait nécessitant une lecture de validation : '+p.excerpt,
    evidence:p.excerpt,municipalReference:p.explicitReference||null,municipalSection:p.sectionHeading||null,municipalEvidence:p.relatedPassages||[{page:p.page,excerpt:p.excerpt}],source_status:'extrait_pdf_a_verifier',sourceEvidencePage:p.page,sourceEvidenceStatus:'found',sourceDocumentVersion:version});
  }
 }
 nextCommune.opportunities=(commune.opportunities||0)+created;
 return {items:result,commune:nextCommune,created,parsed,changed,unchanged:!parsed,reviewCandidates:review.length};
}
function writeJSON(file,value){
 const temp=file+'.tmp-'+process.pid;
 try{fs.writeFileSync(temp,JSON.stringify(value,null,2)+'\n');fs.renameSync(temp,file)}finally{if(fs.existsSync(temp))fs.unlinkSync(temp)}
}
async function run(options={}){
 if(!options.extract&&cp.spawnSync('pdftotext',['-v'],{encoding:'utf8'}).error)throw Error('pdftotext indisponible');
 const inventoryPath=options.inventoryPath||INVENTORY,dataPath=options.dataPath||DATA;
 const inventory=JSON.parse(fs.readFileSync(inventoryPath,'utf8')),data=JSON.parse(fs.readFileSync(dataPath,'utf8'));
 if(!Array.isArray(inventory.communes)||!Array.isArray(data.items))throw Error('Inventaire communal ou historique invalide');
 const now=options.now||new Date().toISOString(),limit=options.maxCommunes||MAX_COMMUNES;
 const ready=selection(inventory.communes,options).filter(m=>m.deliberationSources?.some(readableSource))
  .sort((a,b)=>(a.lastDocumentCheck||'').localeCompare(b.lastDocumentCheck||''))
  .slice(0,limit);
 let documentsRead=0,checked=0,unchanged=0,modified=0,created=0,reviewCandidates=0,errors=[];
 for(const m of ready){
  const before={checked,errors:errors.length},queue=queueApi.init(m);
  for(const entry of Object.values(queue.pages))entry.scopeExcluded=sourcePolicy.excluded(entry)||null;
  for(const src of m.deliberationSources.filter(readableSource)){
   if(/\.pdf(?:$|[?#])/i.test(src.url))queueApi.remember(queue,'documents',{url:src.url,title:src.title||'',sourceUrl:src.url},now);
   else{
    const previous=m.documentSourceChecks?.[documentId(src.url)]||{};
    queueApi.remember(queue,'pages',{url:src.url,depth:0,lastAttempt:previous.lastAttempt,lastSuccess:previous.lastSuccess,lastError:previous.lastError},now);
   }
  }
  // Les PDF déjà contrôlés restent suivis même si leur lien disparaît d'une page.
  for(const prior of Object.values(m.documentChecks||{}))if(prior.url)queueApi.remember(queue,'documents',{url:prior.url,title:'PDF déjà suivi',sourceUrl:prior.url},now);
  const attemptedPages=new Set(),maxPages=Math.min(6,Math.max(1,Number(options.maxPages)||3));
  for(let count=0;count<maxPages;count++){
   const candidate=queueApi.pendingPages(queue,attemptedPages,now)[0];if(!candidate)break;
   const [id,pageEntry]=candidate;attemptedPages.add(id);
   try{
    const page=await download(pageEntry.url,'text/html',1200000,{fetchFn:options.fetchFn}),html=page.bytes.toString('utf8');
    for(const pdf of fileLinks(html,page.finalUrl))queueApi.remember(queue,'documents',{...pdf,sourceUrl:pageEntry.url},now);
    for(const url of childPages(html,page.finalUrl))queueApi.remember(queue,'pages',{url,depth:(pageEntry.depth||0)+1,sourceUrl:pageEntry.url},now);
    queue.pages[id]={...pageEntry,lastAttempt:now,lastSuccess:now,lastError:null,nextAttemptAt:null};
    m.documentSourceChecks={...(m.documentSourceChecks||{}),[id]:{url:pageEntry.url,lastAttempt:now,lastSuccess:now,lastError:null}};
   }catch(e){
    const message=String(e.message||e).slice(0,160),nextAttemptAt=new Date(Date.parse(now)+6*3600000).toISOString();
    queue.pages[id]={...pageEntry,lastAttempt:now,lastError:message,nextAttemptAt};
    m.documentSourceChecks={...(m.documentSourceChecks||{}),[id]:{...(m.documentSourceChecks?.[id]||{}),url:pageEntry.url,lastAttempt:now,lastError:message}};
    errors.push({site:m.name,link:pageEntry.url,error:message});
   }
  }
  const maxDocuments=Math.min(12,Math.max(1,Number(options.maxDocuments)||12));
  const documents=queueApi.pendingDocuments(queue,m.documentChecks||{},now).filter(([,pdf])=>!options.documentURLs||options.documentURLs.includes(pdf.url)).slice(0,maxDocuments);
  for(const [id,pdf] of documents){
   try{
    const file=await download(pdf.url,'application/pdf',9000000,{fetchFn:options.fetchFn,previous:m.documentChecks?.[id]?.extractorVersion===EXTRACTION_VERSION?m.documentChecks[id]:undefined,now});
    const next=processDocument(data.items,m,pdf,file,now,options.extract||pdfText);
    data.items=next.items;Object.assign(m,next.commune);
    m.documentChecks[id].nextAttemptAt=null;
    checked++;if(next.parsed)documentsRead++;if(next.unchanged)unchanged++;if(next.changed)modified++;
    created+=next.created;reviewCandidates+=next.reviewCandidates;
   }catch(e){
    const message=String(e.message||e).slice(0,160);
    m.documentChecks={...(m.documentChecks||{}),[id]:{...(m.documentChecks?.[id]||{}),url:pdf.url,lastAttempt:now,lastError:message,nextAttemptAt:new Date(Date.parse(now)+6*3600000).toISOString()}};
    errors.push({site:m.name,link:pdf.url,error:message});
   }
  }
  m.documentQueue=queue;m.documentProgress=queueApi.progress(queue,m.documentChecks||{});
  m.lastDocumentCheck=now;
  m.lastDocumentResult={checked:checked-before.checked,errors:errors.length-before.errors,attempted:documents.length,pagesAttempted:attemptedPages.size};
  if(checked>before.checked)m.lastDocumentSuccess=now;
 }

 data.metrics={...(data.metrics||{}),records:data.items.length};
 inventory.lastMunicipalDocumentPass=now;
 const actualCounts=sourceHealth.counts(inventory.communes);
 inventory.counts={...(inventory.counts||{}),total:actualCounts.total,sitesChecked:actualCounts.sites,sitesVerifies:actualCounts.sites,candidatePages:actualCounts.pages,documentsRead:actualCounts.documents,deliberationsConnectees:actualCounts.read,sourceErrors:actualCounts.errors,opportunities:inventory.communes.reduce((n,x)=>n+(x.opportunities||0),0)};
 if(data.sources?.COMMUNES)data.sources.COMMUNES={...data.sources.COMMUNES,...inventory.counts};
 const prior=data.sources?.COMMUNES_DOCUMENTS||{};
 data.sources={...(data.sources||{}),COMMUNES_DOCUMENTS:{...prior,status:errors.length?'partial':checked?'pilot':'no_documents',last_attempt:now,
  last_success:checked?now:(prior.last_success||null),last_batch:ready.length,documents_checked:checked,documents_read:documentsRead,
  documents_unchanged:unchanged,documents_modified:modified,opportunities_found:created,review_candidates:reviewCandidates,errors_count:errors.length,
  warning:'Extraits non validés humainement ; une modification du fichier ne prouve pas un rectificatif officiel.'}};
 // L'historique d'abord : si le second fichier échoue, la prochaine passe reprend
 // la lecture et retrouve les mêmes ID, au lieu de marquer des données perdues comme lues.
 writeJSON(dataPath,data);writeJSON(inventoryPath,inventory);
 const summary={communes:ready.length,checked,documents:documentsRead,unchanged,modified,opportunities:created,reviewCandidates,errors:errors.length};
 if(!options.quiet)console.log('COMMUNES_DOCUMENTS',JSON.stringify(summary));
 return summary;
}
module.exports={fileLinks,childPages,evidence,passages,pdfText,documentId,download,processDocument,run};
if(require.main===module)run().catch(e=>{console.warn('COMMUNES_DOCUMENT_READ_ERROR',e.message);process.exitCode=1});
