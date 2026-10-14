/* TED Contract Award Notices — données publiques, sans inférer les prix manquants.
 * Champs : https://docs.ted.europa.eu/ODS/latest/reuse/field-list.html
 * Les tableaux de l'API ne sont pas supposés être alignés par lot.
 */
'use strict';
const FIELDS=[
 'winner-name','winner-identifier','tendering-party-name',
 'received-submissions-type-code','received-submissions-type-val',
 'winner-decision-date','contract-conclusion-date','result-lot-identifier',
 'tender-lot-identifier','tender-value','tender-value-cur',
 'tender-value-lowest','tender-value-cur-lowest',
 'tender-value-highest','tender-value-cur-highest',
 'result-value-notice','result-value-cur-notice',
 'winner-selection-status','not-awarded-reason'
];
function raw(n,key){return n?.[key]??n?.[key.replace(/-/g,'_')]??null}
function flatten(value,out=[]){
 if(value===null||value===undefined)return out;
 if(typeof value==='number'||typeof value==='string'||typeof value==='boolean'){out.push(String(value).trim());return out}
 if(Array.isArray(value)){value.forEach(x=>flatten(x,out));return out}
 if(typeof value==='object'){
  // Language variants: select one language to avoid artificial duplication.
  for(const lang of ['fra','fre','fr','nld','nl','eng','en','deu']){
   if(Object.prototype.hasOwnProperty.call(value,lang))return flatten(value[lang],out);
  }
  Object.values(value).forEach(x=>flatten(x,out));
 }
 return out;
}
function values(n,key){return [...new Set(flatten(raw(n,key)).filter(Boolean))]}
function one(n,key){return values(n,key)[0]||''}
function numeric(value){
 if(!/^\d+(?:[.,]\d+)?$/.test(String(value)))return null;
 const num=Number(String(value).replace(',','.'));return Number.isFinite(num)?num:null;
}
function amounts(n,base,currencyKey){
 const numbers=values(n,base).map(numeric).filter(v=>v!==null&&v>=0);
 const curr=values(n,currencyKey).filter(x=>/^[A-Z]{3}$/.test(x));
 return numbers.map((amount,i)=>({amount,currency:curr.length===1?curr[0]:curr.length===numbers.length?curr[i]:null}));
}
function dateISO(str){return (String(str||'').match(/\b20\d{2}-\d{2}-\d{2}\b/)||[])[0]||''}
function parse(rawNotice){
 const type=one(rawNotice,'notice-type').toLowerCase();
 if(!/^(can-|result-|can\b|res-|award-)/.test(type))return null;
 const procedureIdentifier=one(rawNotice,'procedure-identifier');
 const number=one(rawNotice,'publication-number').match(/\d{1,8}-\d{4}/)?.[0]||'';
 if(!procedureIdentifier||!number)return null;
 const names=values(rawNotice,'winner-name');
 const winnerIdentifiers=values(rawNotice,'winner-identifier');
 const tenderingPartyNames=values(rawNotice,'tendering-party-name');
 const submissionTypes=values(rawNotice,'received-submissions-type-code');
 const submissionCounts=values(rawNotice,'received-submissions-type-val').map(numeric).filter(v=>v!==null&&Number.isInteger(v)&&v>=0);
 const lotIdentifiers=values(rawNotice,'result-lot-identifier');
 const status=values(rawNotice,'winner-selection-status');
 const chosen=status.some(x=>x==='selec-w')||names.length>0;
 const failedReasons=values(rawNotice,'not-awarded-reason');
 const publicationDate=dateISO(one(rawNotice,'publication-date'));
 const decisionDate=dateISO(one(rawNotice,'winner-decision-date'));
 const conclusionDate=dateISO(one(rawNotice,'contract-conclusion-date'));
 const offerCount=submissionCounts.length===1&&submissionTypes.length<=1?submissionCounts[0]:null;
 return {
  publicationNumber:number,
  procedureIdentifier,
  publicationDate,decisionDate,conclusionDate,
  noticeType:type,source:'TED',
  sourceUrl:'https://ted.europa.eu/fr/notice/-/detail/'+number,
  selectedWinner:chosen,
  winners:names, // Identifiants non appariés sans preuve de correspondance index-lot.
  winnerIdentifiers,
  mentionedTenderers:tenderingPartyNames,
  lotIdentifiers,
  offerCount,
  offerCountsByLotUnassigned:offerCount!==null?[]:submissionCounts,
  submissionTypes,
  winnerSelectionStatuses:status,
  notAwardedReasons:failedReasons,
  tenderValues:amounts(rawNotice,'tender-value','tender-value-cur'),
  lowestTenderValues:amounts(rawNotice,'tender-value-lowest','tender-value-cur-lowest'),
  highestTenderValues:amounts(rawNotice,'tender-value-highest','tender-value-cur-highest'),
  totalAwardValues:amounts(rawNotice,'result-value-notice','result-value-cur-notice'),
  caveat:'Valeurs et soumissionnaires peuvent concerner plusieurs lots. Ne pas apparier les tableaux sans preuve dans l’avis officiel.'
 };
}
function attach(items,rawNotices){
 const byProc=new Map();
 for(const n of rawNotices){
  const award=parse(n);
  if(!award)continue;
  if(!byProc.has(award.procedureIdentifier))byProc.set(award.procedureIdentifier,[]);
  byProc.get(award.procedureIdentifier).push(award);
 }
 let updated=0;
 const next=items.map(m=>{
  const key=String(m.procedureIdentifier||'');
  if(!key)return m;
  const incoming=byProc.get(key)||[];
  if(!incoming.length)return m;
  const dict=new Map();
  for(const a of (Array.isArray(m.awards)?m.awards:[])){
   if(a.publicationNumber)dict.set(a.publicationNumber,a);
  }
  for(const a of incoming)dict.set(a.publicationNumber,a);
  updated++;
  const awards=[...dict.values()].sort((a,b)=>(b.publicationDate||'').localeCompare(a.publicationDate||''));
  return {...m,awards,lastPublicResultAt:awards[0]?.publicationDate||null};
 });
 return {items:next,awardNotices:[...byProc.values()].reduce((s,a)=>s+a.length,0),marketMatches:updated};
}
module.exports={FIELDS,flatten,values,parse,attach};
