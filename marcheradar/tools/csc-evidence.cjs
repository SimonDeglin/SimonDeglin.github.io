/* MarchéRadar - extraction documentaire prudente.
 *
 * Le présent module ne déclare jamais une visite obligatoire, une échéance ou
 * une condition de soumission comme VERIFIEE. Chaque passage est une indication
 * non validée, liée à une page et à l'empreinte du PDF source.
 * Aucun texte intégral ni URL de téléchargement temporaire n'est sauvegardé.
 */
'use strict';
const crypto=require('node:crypto');
const rules=[
 {kind:'deadline',label:'Dates et remise des offres',regex:/\b(date\s+limite|d[ée]lai\s+de\s+remise|heure\s+limite|remise\s+des\s+offres|d[ée]p[oô]t\s+des\s+offres|soumission\s+des\s+offres|uiterste\s+(?:datum|indieningsdatum)|indiening\s+van\s+de\s+offertes?)\b/gi},
 {kind:'visit',label:'Visites et réunions',regex:/\b(visite\s+(?:des\s+lieux|du\s+site|obligatoire|sur\s+place)|r[ée]union\s+d['’]information|plaatsbezoek|verplicht\s+plaatsbezoek)\b/gi},
 {kind:'award',label:'Critères d’attribution',regex:/\b(crit[eè]res?\s+d['’]attribution|prix\s+(?:est\s+)?(?:l['’])?unique\s+crit[eè]re|pond[ée]ration\s+des\s+crit[eè]res?|gunningscriteria|gunningscriterium|gunningscriterium\s+prijs)\b/gi},
 {kind:'selection',label:'Conditions de participation',regex:/\b(s[ée]lection\s+qualitative|capacit[ée]\s+technique|r[ée]f[ée]rences?\s+similaires?|agr[ée]ation|erkenning|technische\s+bekwaamheid|selectiecriteria)\b/gi},
 {kind:'deliverables',label:'Prestations et livrables',regex:/\b(livrables?|profils?\s+en\s+travers|plan\s+topographique|lev[ée]s?\s+bathym[ée]triques?|opmetingen|dwarsprofielen|meetstaten)\b/gi}
];
function normalize(s){return String(s||'').replace(/\s+/g,' ').trim()}
function extractPassages(text,options={}){
 const maxTotal=Math.min(Math.max(Number(options.maxTotal)||10,1),20);
 const maxPerKind=Math.min(Math.max(Number(options.maxPerKind)||3,1),5);
 const pages=String(text||'').split('\f');
 const results=[],byKind={},seen=new Set();
 for(let i=0;i<pages.length;i++){
  const page=pages[i];
  if(!page||!page.trim())continue;
  for(const rule of rules){
   if((byKind[rule.kind]||0)>=maxPerKind)continue;
   rule.regex.lastIndex=0;
   let match;
   while((match=rule.regex.exec(page))!==null){
    if(results.length>=maxTotal||(byKind[rule.kind]||0)>=maxPerKind)break;
    // Un extrait court qui peut être retrouvé dans le document officiel.
    const lo=Math.max(0,match.index-45);
    const hi=Math.min(page.length,match.index+match[0].length+105);
    const snippet=normalize(page.slice(lo,hi)).slice(0,185);
    if(snippet.length<15)continue;
    const token=rule.kind+':'+snippet.toLowerCase().replace(/[^a-z0-9À-ÿ]/g,'').slice(0,105);
    if(seen.has(token))continue;
    seen.add(token);
    results.push({kind:rule.kind,page:i+1,excerpt:snippet,reviewStatus:'to_verify'});
    byKind[rule.kind]=(byKind[rule.kind]||0)+1;
   }
  }
 }
 return results.sort((a,b)=>a.page-b.page||a.kind.localeCompare(b.kind));
}
function makeAnalysis({market,document,bytes,numberOfPages,text,extractedAt}){
 if(!market||market.source!=='BOSA'||!market.publicationWorkspaceId)throw Error('Public BOSA market expected');
 if(!document||!document.id||!document.documentId||!document.versionId||!document.title)throw Error('Source manifest incomplete');
 if(!Buffer.isBuffer(bytes)||bytes.length<1024||bytes.length>25_000_000||bytes.subarray(0,5).toString()!=='%PDF-')throw Error('Invalid or oversized PDF');
 if(!Number.isInteger(numberOfPages)||numberOfPages<1||numberOfPages>1000)throw Error('Invalid page count');
 if(typeof text!=='string'||text.length<300)throw Error('No machine-readable PDF text');
 if(text.length>5_000_000)throw Error('PDF extracted text too large');
 if(text.split('\f').filter(s=>s.trim()).length>numberOfPages+3)throw Error('PDF text page count mismatch');
 const evidence=extractPassages(text);
 return {
  documentId:document.documentId,inventoryId:document.id,versionId:document.versionId,
  fileName:document.title,fileType:'pdf',
  pageCount:numberOfPages,textLength:text.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),
  sourcePageUrl:'https://www.publicprocurement.be/publication-workspaces/'+market.publicationWorkspaceId+'/documents',
  analysisKind:'automatic_keyword_passages',reviewStatus:'to_verify',
  extractedAt:extractedAt||new Date().toISOString(),evidence
 };
}
function mergeAnalysis(m,analysis){
 if(!m||!Array.isArray(m.documentInventory))throw Error('Market inventory missing');
 if(!m.documentInventory.some(d=>d.documentId===analysis.documentId&&d.versionId===analysis.versionId))throw Error('Analysis document/version is not in official inventory');
 const prior=Array.isArray(m.documentAnalyses)?m.documentAnalyses:[];
 const idx=prior.findIndex(d=>d.documentId===analysis.documentId);
 const normalized={...analysis};
 if(idx>=0){
  const old=prior[idx];
  // Ne pas réécrire la base pour un même fichier analysé à nouveau.
  if(old.versionId===normalized.versionId&&old.sha256===normalized.sha256&&old.reviewStatus===normalized.reviewStatus&&JSON.stringify(old.evidence)===JSON.stringify(normalized.evidence))return {market:m,updated:false};
 }
 const result=prior.slice();
 if(idx>=0)result[idx]=normalized;else result.push(normalized);
 result.sort((a,b)=>String(a.fileName).localeCompare(String(b.fileName),'fr'));
 return {market:{...m,documentAnalyses:result},updated:true};
}
module.exports={rules,extractPassages,makeAnalysis,mergeAnalysis,normalize};
