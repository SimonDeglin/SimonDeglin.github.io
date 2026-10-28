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
 {kind:'references',label:'Références exigées',regex:/\b(r[ée]f[ée]rences?\s+(?:similaires?|professionnelles?|de\s+(?:services|missions|travaux))|liste\s+des\s+(?:principaux\s+)?services|attestations?\s+de\s+bonne\s+ex[ée]cution)\b/gi},
 {kind:'constraints',label:'Contraintes techniques',regex:/\b(syst[eè]me\s+de\s+coordonn[ée]es|Lambert\s*(?:72|2008)|pr[ée]cision\s+(?:planim[ée]trique|altim[ée]trique)|[ée]quipe\s+bilingue|mat[ée]riel\s+(?:requis|impos[ée])|format\s+(?:DWG|DXF|XML|ACCESS)|ADCP|BEFDSS)\b/gi},
 {kind:'deadline',label:'Dates et remise des offres',regex:/\b(date\s+limite|d[ée]lai\s+de\s+remise|heure\s+limite|remise\s+des\s+offres|d[ée]p[oô]t\s+des\s+offres|soumission\s+des\s+offres|uiterste\s+(?:datum|indieningsdatum)|indiening\s+van\s+de\s+offertes?)\b/gi},
 {kind:'visit',label:'Visites et réunions',regex:/\b(visite\s+(?:des\s+lieux|du\s+site|obligatoire|sur\s+place)|r[ée]union\s+d['’]information|plaatsbezoek|verplicht\s+plaatsbezoek)\b/gi},
 {kind:'award',label:'Critères d’attribution',regex:/\b(crit[eè]res?\s+d['’]attribution|prix\s+(?:est\s+)?(?:l['’])?unique\s+crit[eè]re|pond[ée]ration\s+des\s+crit[eè]res?|gunningscriteria|gunningscriterium|gunningscriterium\s+prijs)\b/gi},
 {kind:'selection',label:'Conditions de participation',regex:/\b(s[ée]lection\s+qualitative|capacit[ée]\s+technique|r[ée]f[ée]rences?\s+similaires?|agr[ée]ation|erkenning|technische\s+bekwaamheid|selectiecriteria)\b/gi},
 {kind:'deliverables',label:'Prestations et livrables',regex:/\b(livrables?|prestations?\s+[àa]\s+r[ée]aliser|plans?\s+d['’]ex[ée]cution|nuages?\s+de\s+points|mod[eè]le\s+num[ée]rique|profils?\s+en\s+travers|plan\s+topographique|lev[ée]s?\s+bathym[ée]triques?|opmetingen|dwarsprofielen|meetstaten)\b/gi}
];
function normalize(s){return String(s||'').replace(/\s+/g,' ').trim()}
function extractPassages(text,options={}){
 const maxTotal=Math.min(Math.max(Number(options.maxTotal)||10,1),20);
 const maxPerKind=Math.min(Math.max(Number(options.maxPerKind)||3,1),5);
 const pages=String(text||'').split('\f');
 const candidates=[],seen=new Set(),counters={};
 for(let i=0;i<pages.length;i++){
  const page=pages[i];
  if(!page||!page.trim())continue;
  // Ne pas saturer l'analyse avec les entrées de table des matières.
  const heading=page.slice(0,1100).toLowerCase();
  if(/table\s+des\s+mati[eè]res|inhoudsopgave|sommaire\s+g[eé]n[eé]ral/i.test(heading))continue;
  for(const rule of rules){
   rule.regex.lastIndex=0;
   let match,found=0;
   while((match=rule.regex.exec(page))!==null&&found<80&&candidates.length<700){
    const lo=Math.max(0,match.index-40),hi=Math.min(page.length,match.index+match[0].length+115);
    const excerpt=normalize(page.slice(lo,hi)).slice(0,185);
    if(excerpt.length<25)continue;
    const lineStart=page.lastIndexOf('\n',match.index)+1;
    const lineEnd=page.indexOf('\n',match.index);
    const line=page.slice(lineStart,lineEnd<0?page.length:lineEnd);
    if(/\.{4,}/.test(line)||/[·_]{7,}/.test(line))continue;
    const token=rule.kind+':'+excerpt.toLowerCase().replace(/[^a-z0-9À-ÿ]/g,'').slice(0,125);
    if(seen.has(token))continue;
    seen.add(token);
    let score=3;
    if(i>=3)score+=2;
    if(/prix\s+(?:est|constitue)\s+(?:l['’]|le\s+)?(?:unique|seul)|enige\s+gunningscriterium|100\s*%/i.test(excerpt))score+=14;
    if(/obligatoire|verplicht|au\s+plus\s+tard|avant\s+le|pr[eé]cis[eé]e?\s+dans/i.test(excerpt))score+=5;
    if(/\b\d{1,2}[\/.-]\d{1,2}[\/.-]20\d{2}\b|\b\d{1,2}\s+(?:octobre|novembre|d[eé]cembre|januari|februari)\s+20\d{2}\b/i.test(excerpt))score+=5;
    score+=Math.min(excerpt.length,160)/160;
    candidates.push({kind:rule.kind,page:i+1,excerpt,reviewStatus:'to_verify',score});
    found++;
   }
  }
 }
 candidates.sort((a,b)=>b.score-a.score||a.page-b.page);
 const result=[];
 // Donner d'abord une place à chaque rubrique, même si une page contient
 // de nombreuses mentions du prix ou des dates.
 const firstKinds=new Set();
 const balanced=candidates.filter(c=>{if(firstKinds.has(c.kind))return false;firstKinds.add(c.kind);return true});
 const ordered=[...balanced,...candidates.filter(c=>!balanced.includes(c))];
 for(const c of ordered){
  if(result.length>=maxTotal)break;
  if((counters[c.kind]||0)>=maxPerKind)continue;
  counters[c.kind]=(counters[c.kind]||0)+1;
  result.push({kind:c.kind,page:c.page,excerpt:c.excerpt,reviewStatus:c.reviewStatus});
 }
 return result.sort((a,b)=>a.page-b.page||a.kind.localeCompare(b.kind));
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
