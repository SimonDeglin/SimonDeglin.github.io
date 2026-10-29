/* File persistante de liens publics, indépendante des dossiers commerciaux.
   Les limites portent sur le travail d'une passe, jamais sur les premiers liens
   d'une page sans en garder la suite. Les bornes du registre sont signalées. */
'use strict';
const crypto=require('node:crypto');
const key=url=>'municipal-doc:'+crypto.createHash('sha256').update(url).digest('hex').slice(0,18);
const CAPS={pages:600,documents:4000,depth:3};
function init(commune){
 const old=commune.documentQueue||{};
 const queue={version:1,pages:{...(old.pages||{})},documents:{...(old.documents||{})},limits:{...(old.limits||{})}};
 return queue;
}
function remember(queue,type,entry,now){
 let u;try{u=new URL(entry.url);if(!/^https?:$/.test(u.protocol))return false;u.hash=''}catch(e){return false}
 const url=u.href,id=key(url),old=queue[type][id];
 if(old){queue[type][id]={...old,lastSeen:now};return true}
 if(Object.keys(queue[type]).length>=CAPS[type]){queue.limits[type]=true;return false}
 if(type==='pages'&&(entry.depth||0)>CAPS.depth){queue.limits.depth=true;return false}
 queue[type][id]={...entry,url,discoveredAt:now,lastSeen:now};return true;
}
function pendingPages(queue,attempted,now){
 return Object.entries(queue.pages).filter(([id,p])=>!attempted.has(id)&&(!p.nextAttemptAt||p.nextAttemptAt<=now))
 .sort(([,a],[,b])=>(a.lastAttempt||'').localeCompare(b.lastAttempt||'')||(a.depth||0)-(b.depth||0)||a.url.localeCompare(b.url));
}
function pendingDocuments(queue,checks,now){
 return Object.entries(queue.documents).filter(([id])=>!checks[id]?.nextAttemptAt||checks[id].nextAttemptAt<=now)
 .sort(([ia,a],[ib,b])=>(checks[ia]?.lastAttempt||'').localeCompare(checks[ib]?.lastAttempt||'')||a.discoveredAt.localeCompare(b.discoveredAt)||a.url.localeCompare(b.url));
}
function progress(queue,checks){
 const pages=Object.values(queue.pages),documents=Object.keys(queue.documents);
 const pagesPending=pages.filter(p=>!p.lastSuccess).length,documentsPending=documents.filter(id=>!checks[id]?.sha256||!checks[id]?.lastSuccess).length;
 return {pagesKnown:pages.length,pagesPending,documentsKnown:documents.length,documentsPending,
  errors:pages.filter(p=>p.lastError).length+documents.filter(id=>checks[id]?.lastError).length,
  limited:Object.values(queue.limits).some(Boolean),limits:{...queue.limits}};
}
module.exports={key,CAPS,init,remember,pendingPages,pendingDocuments,progress};
