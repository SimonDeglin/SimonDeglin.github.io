/* File persistante de liens publics, indépendante des dossiers commerciaux.
   Les limites portent sur le travail d'une passe, jamais sur les premiers liens
   d'une page sans en garder la suite. Les bornes du registre sont signalées. */
'use strict';
const crypto=require('node:crypto');
const dates=require('../document-dates.js');
const policy=require('./communal-source-policy.cjs');
function dateHint(p){if(p.sessionProof?.date)return p.sessionProof.date;const d=dates.extract({url:p.url,title:p.title});return (d.session||d.document)?.date||''}
function priority(p,now){const hint=dateHint(p),year=new Date(now).getUTCFullYear();if(hint)return hint>=dates.cutoff(now)?0:9;const text=p.url+' '+(p.title||'');return new RegExp('(?:annee[-/ ]?)?'+year).test(text)?1:/RSS|deliberations\.be|ordre|proces|verbaux|seances|d[eé]cision|march[eé]s/i.test(text)?2:4}
function outside(p,check,now){const date=(check?.sourceDocumentDates?.session||check?.sourceDocumentDates?.document)?.date||dateHint(p);return date&&date<dates.cutoff(now)}
const key=url=>'municipal-doc:'+crypto.createHash('sha256').update(url).digest('hex').slice(0,18);
const CAPS={pages:600,documents:4000,depth:3};
function init(commune){
 const old=commune.documentQueue||{};
 const ordered=items=>Object.fromEntries(Object.entries(items||{}).map(([id,p],i)=>[id,{...p,discoveryOrder:p.discoveryOrder??i}]));
 const queue={version:1,pages:ordered(old.pages),documents:ordered(old.documents),limits:{...(old.limits||{})}};
 return queue;
}
function remember(queue,type,entry,now){
 let u;try{u=new URL(entry.url);if(!/^https?:$/.test(u.protocol))return false;u.hash=''}catch(e){return false}
 const url=u.href,id=key(url),old=queue[type][id];
 if(old){queue[type][id]={...old,lastSeen:now,title:entry.title&&entry.title!=='PDF déjà suivi'?entry.title:old.title,sessionProof:entry.sessionProof||old.sessionProof};return true}
 if(Object.keys(queue[type]).length>=CAPS[type]){queue.limits[type]=true;return false}
 if(type==='pages'&&(entry.depth||0)>CAPS.depth){queue.limits.depth=true;return false}
 queue[type][id]={...entry,url,discoveredAt:now,lastSeen:now,discoveryOrder:Object.keys(queue[type]).length};return true;
}
function pendingPages(queue,attempted,now){
 return Object.entries(queue.pages).filter(([id,p])=>!p.scopeExcluded&&!policy.excluded(p)&&priority(p,now)!==9&&!attempted.has(id)&&(!p.nextAttemptAt||p.nextAttemptAt<=now))
 .sort(([,a],[,b])=>priority(a,now)-priority(b,now)||(a.lastAttempt||'').localeCompare(b.lastAttempt||'')||(a.depth||0)-(b.depth||0)||(a.discoveryOrder??999999)-(b.discoveryOrder??999999)||a.url.localeCompare(b.url));
}
function pendingDocuments(queue,checks,now){
 return Object.entries(queue.documents).filter(([id,p])=>!policy.excluded(p)&&!outside(p,checks[id],now)&&(!checks[id]?.nextAttemptAt||checks[id].nextAttemptAt<=now))
 .sort(([ia,a],[ib,b])=>priority(a,now)-priority(b,now)||dateHint(b).localeCompare(dateHint(a))||(checks[ia]?.lastAttempt||'').localeCompare(checks[ib]?.lastAttempt||'')||a.discoveredAt.localeCompare(b.discoveredAt)||(a.discoveryOrder??999999)-(b.discoveryOrder??999999)||a.url.localeCompare(b.url));
}
function progress(queue,checks){
 const pages=Object.values(queue.pages),documents=Object.keys(queue.documents);
 const pagesPending=pages.filter(p=>!p.scopeExcluded&&!p.lastSuccess).length,documentsPending=documents.filter(id=>!checks[id]?.sha256||!checks[id]?.lastSuccess).length;
 return {pagesKnown:pages.length,pagesPending,documentsKnown:documents.length,documentsPending,
  errors:pages.filter(p=>p.lastError).length+documents.filter(id=>checks[id]?.lastError).length,
  limited:Object.values(queue.limits).some(Boolean),limits:{...queue.limits}};
}
module.exports={key,CAPS,dateHint,priority,outside,init,remember,pendingPages,pendingDocuments,progress};
