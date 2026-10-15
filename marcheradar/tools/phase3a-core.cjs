/* Marché Radar Phase 3A — data rules only, no network writes.
 * Proof: published notice/API or a visible public BOSA document row.
 * Never conflate a BOSA document listing with a verified direct download.
 */
'use strict';
const crypto=require('node:crypto');
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PUB=/^\d{1,8}-20\d{2}$/;
const FILE=/\.(?:pdf|docx?|xlsx?|xlsm?|xml|zip|odt|dwg|dxf|pptx?|csv|txt)$/i;
const SAFE=/^(?!localhost$)(?!127\.)(?!10\.)(?!192\.168\.)(?!169\.254\.)(?!172\.(?:1[6-9]|2\d|3[01])\.)(?!\[)(?!\d+\.\d+\.\d+\.\d+$)[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i;
function text(x){return x==null?'':String(x).trim()}
function safeURL(raw){
 try{
  const u=new URL(text(raw));
  if(u.protocol!=='https:'||u.username||u.password||!SAFE.test(u.hostname)||u.href.length>1900)return '';
  return u.href;
 }catch(e){return ''}
}
function tedNotice(pub){return PUB.test(text(pub))?'https://ted.europa.eu/fr/notice/-/detail/'+pub:''}
function bosaDocuments(uuid){return UUID.test(text(uuid))?'https://www.publicprocurement.be/publication-workspaces/'+uuid+'/documents':''}
function decodeXML(raw){return text(raw).replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'")}
function getTag(xml,name){
 const re=new RegExp('<(?:[a-zA-Z][\\w.-]*:)?'+name+'(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[a-zA-Z][\\w.-]*:)?'+name+'>','i');
 const m=re.exec(String(xml));return m?decodeXML(m[1]):'';
}
function getBlocks(xml,name){
 const re=new RegExp('<(?:[a-zA-Z][\\w.-]*:)?'+name+'(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[a-zA-Z][\\w.-]*:)?'+name+'>','gi');
 return [...String(xml||'').matchAll(re)].map(x=>x[1]);
}
function combineDateTime(dateRaw,timeRaw){
 const dm=/^(\d{4}-\d{2}-\d{2})(Z|[+-]\d{2}:\d{2})?$/.exec(text(dateRaw));
 const tm=/^(\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?)(Z|[+-]\d{2}:\d{2})?$/.exec(text(timeRaw));
 if(!dm||!Number.isFinite(Date.parse(dm[1]+'T12:00:00Z')))return {value:'',precision:'unknown'};
 if(new Date(dm[1]+'T12:00:00Z').toISOString().slice(0,10)!==dm[1])return {value:'',precision:'unknown'};
 if(!tm)return {value:dm[1],precision:'date'};
 if(dm[2]&&tm[2]&&dm[2]!==tm[2])return {value:dm[1],precision:'date',warning:'fuseau_incoherent'};
 const tz=tm[2]||dm[2]||'';
 if(!tz)return {value:dm[1],precision:'date',timeUnzoned:tm[1]};
 const full=dm[1]+'T'+tm[1]+tz;
 if(!Number.isFinite(Date.parse(full)))return {value:dm[1],precision:'date'};
 return {value:full,precision:'datetime'};
}
function oneDeadline(dates,times){
 dates=Array.isArray(dates)?dates:[dates];
 times=Array.isArray(times)?times:[times];
 const uniqueDates=[...new Set(dates.map(text).filter(Boolean))];
 const uniqueTimes=[...new Set(times.map(text).filter(Boolean))];
 if(uniqueDates.length!==1||uniqueTimes.length>1)return {value:'',precision:'conflict',countDates:uniqueDates.length,countTimes:uniqueTimes.length};
 return combineDateTime(uniqueDates[0],uniqueTimes[0]||'');
}
function parseTedXML(xml){
 xml=String(xml||'');
 if(xml.length<200||!/<(?:\w+:)?(?:ContractNotice|PriorInformationNotice|ContractAwardNotice|Notice|EFormsExtension|QualificationApplicationType)/i.test(xml))
  return {valid:false,links:[],deadline:{value:'',precision:'unknown'}};
 const blocks=getBlocks(xml,'CallForTendersDocumentReference');
 const links=[];
 for(const block of blocks){
  const u=safeURL(getTag(block,'URI'));
  if(u&&!links.includes(u))links.push(u);
 }
 const periods=getBlocks(xml,'TenderSubmissionDeadlinePeriod');
 const dates=periods.map(b=>getTag(b,'EndDate')).filter(Boolean);
 const times=periods.map(b=>getTag(b,'EndTime')).filter(Boolean);
 const deadline=oneDeadline(dates,times);
 return {valid:true,links,deadline,deadlineCount:periods.length};
}
function parseTedAPI(data,publicationNumber){
 const notices=Array.isArray(data?.notices)?data.notices:[];
 const n=notices.find(x=>text(x['publication-number'])===publicationNumber);
 if(!n)return {matched:false,deadline:{value:'',precision:'unknown'}};
 const list=x=>Array.isArray(x)?x:x?[x]:[];
 const deadline=oneDeadline(list(n['deadline-receipt-tender-date-lot']),list(n['deadline-receipt-tender-time-lot']));
 const formats=n.links&&typeof n.links==='object'?n.links:{};
 const officialPdf=safeURL(formats.pdf?.FRA||formats.pdf?.ENG||'');
 return {matched:true,deadline,officialPdf,sourceNotice:tedNotice(publicationNumber)};
}
function parseBosaDeadline(pageText){
 // Strictly the titled tender-submission field on the already verified public BOSA general page.
 const t=String(pageText||'').replace(/\u00a0/g,' ');
 const re=/Date\s+limite\s+de\s+soumission\s+(\d{2})\/(\d{2})\/(20\d{2})\s+([01]\d|2[0-3]):([0-5]\d)\s+(CET|CEST)\b/i;
 const m=re.exec(t);
 if(!m)return {value:'',precision:'unknown'};
 const iso=m[3]+'-'+m[2]+'-'+m[1];
 const d=new Date(iso+'T12:00:00Z');
 if(isNaN(d.getTime())||d.toISOString().slice(0,10)!==iso)return {value:'',precision:'unknown',warning:'date_invalide'};
 const zone=m[6].toUpperCase()==='CET'?'+01:00':'+02:00';
 const value=iso+'T'+m[4]+':'+m[5]+':00'+zone,instant=new Date(value);
 if(isNaN(instant.getTime()))return {value:'',precision:'unknown'};
 const zonePart=new Intl.DateTimeFormat('en-US',{timeZone:'Europe/Brussels',timeZoneName:'shortOffset'}).formatToParts(instant).find(x=>x.type==='timeZoneName');
 const actual=String(zonePart?.value||'').replace('GMT','');
 const expected=zone==='+01:00'?'+1':'+2';
 if(actual!==expected)return {value:'',precision:'unknown',warning:'fuseau_CET_CEST_incoherent'};
 return {value,precision:'datetime',evidence:m[0].replace(/\s+/g,' ').slice(0,130),label:'Date limite de soumission',sourceField:'BOSA page Générale'};
}
function docType(filename){
 const name=text(filename).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
 if(/(?:^|[_\s.-])(?:csc|cch|csс|bestek)(?:[_\s.-]|$)|cahier.{0,12}charges|cahier.{0,12}conditions/.test(name))return 'csc';
 if(/(?:^|[_\s.-])(?:plan|plans|drawing|dwg|dxf)(?:[_\s.-]|$)/.test(name)||/\.(?:dwg|dxf)$/.test(name))return 'plan';
 if(/(?:bordereau|inventaire|inventaris|metre|quantit|offerteformulier)/.test(name))return 'bordereau';
 if(/(?:rectificatif|correctif|modificatif|erratum|wijziging|corrigendum)/.test(name))return 'rectificatif';
 if(/(?:^|[_\s.-])(?:annexe|annex|bijlage)(?:[_\s.-]|$)/.test(name))return 'annexe';
 return 'autre';
}
function parseDocumentRows(rows,market,sourceUrl,checkedAt){
 const entries=[],external=[],seen=new Set();
 if(!bosaDocuments(market.publicationWorkspaceId)||safeURL(sourceUrl)!==bosaDocuments(market.publicationWorkspaceId))return {documents:[],external:[]};
 for(const item of rows||[]){
  const cells=(Array.isArray(item)?item:typeof item==='object'&&Array.isArray(item.cells)?item.cells:[]).map(text).filter(Boolean);
  const filename=cells.find(x=>FILE.test(x.replace(/^['‘]/,'')));
  const externalURL=cells.find(x=>/^https:\/\//i.test(x));
  if(externalURL&&!filename){
   const url=safeURL(externalURL);
   if(url&&!seen.has('link:'+url)){seen.add('link:'+url);external.push({source:'BOSA — lien documentaire externe',kind:'documents_portal',url,verified:true,sourcePage:sourceUrl,checkedAt})}
   continue;
  }
  if(!filename)continue;
  const clean=filename.replace(/^['‘]/,'').slice(0,240);
  const index=cells.indexOf(filename);
  const after=cells.slice(index+1);
  const langs=text(after[0]).slice(0,50),version=text(after[1]).slice(0,15),humanDate=text(after[2]);
  const md=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(humanDate);
  const publicationDate=md?md[3]+'-'+md[2]+'-'+md[1]:'';
  const key=[clean.toLowerCase(),version,publicationDate].join('|');
  if(seen.has(key))continue;
  seen.add(key);
  entries.push({
   id:'bosa-doc:'+crypto.createHash('sha256').update(market.publicationWorkspaceId+'|'+key).digest('hex').slice(0,22),
   title:clean,type:docType(clean),source:'BOSA',languages:langs.split(/,\s*/).filter(Boolean),
   version:version||'',publicationDate,verified:true,accessibility:'listed_public',
   accessPageUrl:sourceUrl,sourceUrl,checkedAt,
   evidence:'Fichier listé publiquement dans l’onglet Documents du dossier BOSA '+market.publicationWorkspaceId,
   // No direct file URL is claimed without a separately verified public download.
   url:''
  });
 }
 return {documents:entries,external};
}
function mergeRecords(m,info){
 const item={...m},stamp=text(info.checkedAt)||new Date().toISOString();
 const newDocs=Array.isArray(info.documents)?info.documents:[];
 const oldDocs=Array.isArray(m.documents)?m.documents:[];
 const docMap=new Map();
 for(const d of [...oldDocs,...newDocs]){
  if(!d||!d.title)continue;
  const key=d.id||[d.source,d.title,d.version,d.publicationDate].map(text).join('|').toLowerCase();
  const prior=docMap.get(key);
  docMap.set(key,prior?{...d,...prior,url:prior.url||d.url||''}:{...d});
 }
 if(docMap.size)item.documents=[...docMap.values()];
 const priorSources=Array.isArray(m.officialSources)?m.officialSources:[];
 const sources=new Map();
 for(const src of [...priorSources,...(info.sources||[])]){
  const u=safeURL(src?.url);if(!u)continue;
  if(!sources.has(u))sources.set(u,{...src,url:u});
 }
 if(sources.size)item.officialSources=[...sources.values()];
 if(info.deadline&&info.deadline.value&&['date','datetime'].includes(info.deadline.precision)&&info.deadlineVerified===true){
  const newValue=info.deadline.value, oldVerified=m.deadlineEvidence?.verified===true;
  const oldDate=text(m.deadline).slice(0,10),newDate=newValue.slice(0,10);
  const oldPublication=m.deadlineEvidence?.publicationNumber;
  const nextPublication=info.deadlinePublicationNumber;
  // A new unrelated or older notice cannot silently invalidate an existing verified deadline.
  const conflict=oldVerified&&oldPublication&&nextPublication&&oldPublication!==nextPublication&&m.deadline&&m.deadline!==newValue;
  const disagreement=oldVerified&&m.deadline&&oldDate!==newDate&&oldPublication===nextPublication;
  if(conflict||disagreement){
   item.deadlineReview={newDeadline:newValue,source:info.deadlineSource,checkedAt:stamp,reason:conflict?'notice_distinct':'verified_deadline_disagreement'};
  }else{
   const finer=info.deadline.precision==='datetime'||!oldVerified;
   if(finer){
    if(m.deadline&&m.deadline!==newValue)item.deadlineHistory=[...(m.deadlineHistory||[]),{value:m.deadline,changeObservedAt:stamp,previousSource:m.deadlineEvidence||null}].slice(-12);
    item.deadline=newValue;
    item.deadlineEvidence={verified:true,precision:info.deadline.precision,source:info.deadlineSource,
     sourceUrl:safeURL(info.deadlineSourceUrl)||'',publicationNumber:nextPublication||'',checkedAt:stamp,
     fields:info.deadlineFields||[]};
   }
  }
 }
 if(info.bulkDocumentDownload?.verified===true)item.bulkDocumentDownload={...info.bulkDocumentDownload};
 if(info.audit)item.documentAudit={...info.audit,checkedAt:stamp};
 return item;
}
module.exports={safeURL,tedNotice,bosaDocuments,parseTedXML,parseTedAPI,parseBosaDeadline,parseDocumentRows,docType,combineDateTime,oneDeadline,mergeRecords};
