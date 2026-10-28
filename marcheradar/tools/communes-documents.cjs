/* MarchéRadar — première lecture ciblée des délibérations communales.
 * Sources issues des pages communales découvertes, ne jamais inventer un projet.
 * Chaque opportunité conserve un extrait du document et son lien officiel.
 */
'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),crypto=require('node:crypto');
const profile=require('./kdrix-profile.cjs');
const INVENTORY=path.resolve(__dirname,'../communes.json'),DATA=path.resolve(__dirname,'../data.json');
const MAX_COMMUNES=Math.min(8,Math.max(1,Number(process.env.COMMUNES_DOC_BATCH||4)));
const MATCH=/(?:topograph|g[eé]om[eè]tr|bornage|division parcell|bathym[eé]tr|jaugeag|limnim[eé]tr|[eé]tude hydraulique|bureau d.[eé]tudes|auteur de projet|d[eé]tection de r[eé]seaux|scanner laser|photogramm[eé]tr|certificat PEB|certification [eé]nerg[eé]tique|lev[eé] de terrain|[eé]valuation immobili[eè]re|relev[eé] de cours d.eau)/i;
const INTENT=/(?:d[eé]cide|approuve|d[eé]lib[eè]re|march[eé] de services|d[eé]signation|consultation|cahier sp[eé]cial des charges|lancement d.un march[eé]|mise en concurrence|bureau d.[eé]tudes|mission d.auteur de projet|budget d.[eé]tudes?)/i;
function textOnly(h){return String(h||'').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]*>/g,' ').replace(/&(?:amp|nbsp|quot|#39);/gi,' ').replace(/\s+/g,' ').trim()}
function fileLinks(html,base){
 const out=[];
 for(const a of String(html).matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)){
  let uri;try{uri=new URL(a[1],base)}catch(e){continue}
  if(!/^https?:$/.test(uri.protocol))continue;
  if(!/\.pdf(?:$|\?)/i.test(uri.href))continue;
  if(!out.some(x=>x.url===uri.href))out.push({url:uri.href,title:textOnly(a[2]).slice(0,90)});
 }
 return out.slice(0,12);
}
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
 const out=[];
 for(const [pageNo,page] of String(text||'').split('\f').entries()){
  const lines=page.split('\n').map(x=>x.trim()).filter(Boolean);
  for(let i=0;i<lines.length;i++){
   if(!MATCH.test(lines[i]))continue;
   const quote=lines.slice(Math.max(0,i-2),Math.min(lines.length,i+5)).join(' ').slice(0,1400);
   if(INTENT.test(quote)&&!out.some(x=>x.excerpt.slice(0,100)===quote.slice(0,100)))out.push({excerpt:quote,page:pageNo+1});
   if(out.length>=6)return out;
  }
 }
 return out;
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
  if(sha!==prior.sha256){text=extract(file.bytes);if(!text||!text.trim())throw Error('PDF sans texte exploitable ; version antérieure conservée');parsed=true;}
  check.etag=file.etag||'';check.lastModified=file.lastModified||'';check.contentCheckedAt=now;
 }else if(!sha)throw Error('Version précédente absente');
 if(changed){
  check.history=[...(prior.history||[]),{sha256:prior.sha256,firstSeenAt:prior.firstSeenAt,lastSeenAt:prior.lastSuccess||prior.lastChecked||null}];
  check.changedAt=now;
 }
 check.sha256=sha;check.firstSeenAt=(!prior.sha256||changed)?now:prior.firstSeenAt;
 const nextCommune={...commune,documentChecks:{...(commune.documentChecks||{}),[id]:check}};
 const wasRead=(commune.readDocuments||[]).includes(id);
 nextCommune.readDocuments=[...new Set([...(commune.readDocuments||[]),id])];
 nextCommune.documentsRead=(commune.documentsRead||0)+(wasRead?0:1);
 nextCommune.documentVersionsRead=(commune.documentVersionsRead||0)+(parsed?1:0);
 const candidates=text===null?[]:passages(text).map(p=>({...p,rating:profile.screen({title:p.excerpt.slice(0,180),description:p.excerpt,buyer:'Commune de '+commune.name,region:'Wallonie',source:'LOCALE',opportunityType:'prospection'}).classification})).filter(p=>p.rating);
 // Les passages nouveaux d'un document déjà suivi ne deviennent pas silencieusement
 // de nouveaux dossiers : cela ressusciterait une décision Hors sujet après correction du PDF.
 // Les signaler comme passages du DOCUMENT, sans inventer leur rattachement au marché.
 const review=linked.length?candidates.filter(p=>!linked.some(m=>normalized(m.evidence)===normalized(p.excerpt))).map(({excerpt,page})=>({excerpt,page})):[];
 const version={documentId:id,sha256:sha,checkedAt:now,changedAt:check.changedAt||null};
 let result=items.map(m=>{
  if(!belongs(m,commune,pdf.url))return m;
  const next={...m,sourceDocumentVersion:version};
  if(text!==null){
   next.sourceEvidenceStatus=m.evidence?(normalized(text).includes(normalized(m.evidence))?'found':'not_found'):'unverified';
   next.sourceDocumentReview={sha256:sha,checkedAt:now,candidates:review};
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
    municipalityINS:commune.ins,region:'Wallonie',source:'LOCALE',opportunityType:'prospection',
    opportunityStage:'décision ou besoin à vérifier',sector:p.rating.sector,sectors:p.rating.sectors,
    score:Math.min(60,p.rating.score),screening:'review',publication:'',deadline:'',
    sourceDocument:pdf.url,url:pdf.url,cpv:[],description:'Document communal public. Extrait nécessitant une lecture de validation : '+p.excerpt,
    evidence:p.excerpt,source_status:'extrait_pdf_a_verifier',sourceEvidencePage:p.page,sourceEvidenceStatus:'found',sourceDocumentVersion:version});
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
 const ready=inventory.communes.filter(m=>m.deliberationSources?.some(s=>s.status==='page_accessible'))
  .sort((a,b)=>(a.lastDocumentCheck||'').localeCompare(b.lastDocumentCheck||''))
  .slice(0,limit);
 let documents=0,checked=0,unchanged=0,modified=0,created=0,reviewCandidates=0,errors=[];
 for(const m of ready){
  const attempted=new Set();
  for(const src of m.deliberationSources.filter(s=>s.status==='page_accessible').slice(0,3)){
   try{
    const page=await download(src.url,'text/html',1200000,{fetchFn:options.fetchFn});
    for(const pdf of fileLinks(page.bytes.toString('utf8'),page.finalUrl)){
     const id=documentId(pdf.url);if(attempted.has(id))continue;attempted.add(id);
     try{
      const file=await download(pdf.url,'application/pdf',9000000,{fetchFn:options.fetchFn,previous:m.documentChecks?.[id],now});
      const next=processDocument(data.items,m,pdf,file,now,options.extract||pdfText);
      data.items=next.items;Object.assign(m,next.commune);
      checked++;if(next.parsed)documents++;if(next.unchanged)unchanged++;if(next.changed)modified++;
      created+=next.created;reviewCandidates+=next.reviewCandidates;
     }catch(e){
      const message=String(e.message||e).slice(0,160);
      m.documentChecks={...(m.documentChecks||{}),[id]:{...(m.documentChecks?.[id]||{}),url:pdf.url,lastAttempt:now,lastError:message}};
      errors.push({site:m.name,link:pdf.url,error:message});
     }
    }
   }catch(e){errors.push({site:m.name,link:src.url,error:String(e.message||e).slice(0,160)})}
  }
  m.lastDocumentCheck=now;
 }
 inventory.lastMunicipalDocumentPass=now;
 inventory.counts={...(inventory.counts||{}),documentsRead:inventory.communes.reduce((n,x)=>n+(x.documentsRead||0),0),opportunities:inventory.communes.reduce((n,x)=>n+(x.opportunities||0),0)};
 const prior=data.sources?.COMMUNES_DOCUMENTS||{};
 data.sources={...(data.sources||{}),COMMUNES_DOCUMENTS:{...prior,status:errors.length?'partial':checked?'pilot':'no_documents',last_attempt:now,
  last_success:checked?now:(prior.last_success||null),last_batch:ready.length,documents_checked:checked,documents_read:documents,
  documents_unchanged:unchanged,documents_modified:modified,opportunities_found:created,review_candidates:reviewCandidates,errors_count:errors.length,
  warning:'Extraits non validés humainement ; une modification du fichier ne prouve pas un rectificatif officiel.'}};
 // L'historique d'abord : si le second fichier échoue, la prochaine passe reprend
 // la lecture et retrouve les mêmes ID, au lieu de marquer des données perdues comme lues.
 writeJSON(dataPath,data);writeJSON(inventoryPath,inventory);
 const summary={communes:ready.length,checked,documents,unchanged,modified,opportunities:created,reviewCandidates,errors:errors.length};
 if(!options.quiet)console.log('COMMUNES_DOCUMENTS',JSON.stringify(summary));
 return summary;
}
module.exports={fileLinks,evidence,passages,pdfText,documentId,download,processDocument,run};
if(require.main===module)run().catch(e=>{console.warn('COMMUNES_DOCUMENT_READ_ERROR',e.message);process.exitCode=1});
