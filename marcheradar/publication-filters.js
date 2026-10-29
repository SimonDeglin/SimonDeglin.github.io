/* Un dossier peut réunir plusieurs avis : croiser source et type sur le même
   avis connu, sans dupliquer le dossier ni inventer le type d'un lien secondaire. */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MRPublications=api})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const txt=v=>String(v||'').trim();
 const sources=[{id:'all',label:'Toutes les sources'},{id:'BOSA',label:'BOSA'},{id:'TED',label:'TED'},{id:'municipal',label:'Site web communal'},{id:'other',label:'Autres sites publics'}];
 const types=[{id:'all',label:'Tous les types'},{id:'competition',label:"Appels d’offres"},{id:'result',label:'Attributions'},{id:'prospect',label:'Prospection'},{id:'unknown',label:'Autres'}];
 function webSource(m){return m.webSourceType==='municipal'||/^\d{5}$/.test(txt(m.municipalityINS))||/^commune\b/i.test(txt(m.buyer))?'municipal':'other'}
 function source(m){return m.source==='BOSA'||m.source==='TED'?m.source:webSource(m)}
 function kind(m){
  if(!m||typeof m!=='object')return 'unknown';
  const k=txt(m.noticeKind).toLowerCase(),n=txt(m.noticeType||m.noticeSubType).toLowerCase();
  if(m.webTypeEvidence&&m.sourceDocumentVersion&&m.webTypeEvidence.sha256!==m.sourceDocumentVersion.sha256)return 'unknown';
  if(m.sourceEvidenceStatus==='not_found'&&m.webTypeEvidence)return 'unknown';
  if(k==='award'||/^(?:can|e4|result|award)(?:[-_]|$)/.test(n))return 'result';
  if(k==='competition'||/^(?:cn|e3)(?:[-_]|$)/.test(n))return 'competition';
  if(k==='other'||k==='unknown')return 'unknown';
  if(k==='prospection'||m.source==='LOCALE')return 'prospect';
  return 'unknown';
 }
 function facets(m){
  const result=[],seen=new Set(),primarySource=source(m),primaryKind=kind(m);
  const add=(s,k,url)=>{const key=s+'|'+k;if(!seen.has(key)){seen.add(key);result.push({source:s,type:k,url:txt(url)})}else if(url){const old=result.find(f=>f.source===s&&f.type===k);if(!old.url)old.url=txt(url)}};
  add(primarySource,primaryKind,m.url);
  for(const item of Array.isArray(m.officialSources)?m.officialSources:[]){
   const s=source({...m,...item});const hasKind=item.noticeKind||item.noticeType||item.noticeSubType;
   add(s,hasKind?kind(item):s===primarySource?primaryKind:'unknown',item.url);
  }
  for(const item of Array.isArray(m.bosaResults)?m.bosaResults:[])add('BOSA',kind({...item,noticeKind:'award'}),item.url);
  // Les attributions TED sont rattachées par le collecteur au dossier initial.
  for(const item of Array.isArray(m.awards)?m.awards:[]){if(item.source==='TED')add('TED','result',item.url);else if(item.source==='BOSA')add('BOSA','result',item.url)}
  return result;
 }
 function matches(m,s='all',t='all'){return facets(m).some(f=>(s==='all'||f.source===s)&&(t==='all'||f.type===t))}
 function sourceCounts(list,type='all'){
  const r={all:0,BOSA:0,TED:0,municipal:0,other:0};
  for(const m of list||[]){const set=new Set(facets(m).filter(f=>type==='all'||f.type===type).map(f=>f.source));if(set.size)r.all++;for(const s of set)r[s]++}return r;
 }
 function typeCounts(list,origin='all'){
  const r={all:0,competition:0,result:0,prospect:0,unknown:0};
  for(const m of list||[]){const set=new Set(facets(m).filter(f=>origin==='all'||f.source===origin).map(f=>f.type));if(set.size)r.all++;for(const t of set)r[t]++}return r;
 }
 function labels(m,selected='all'){return [...new Set(facets(m).filter(f=>selected==='all'||f.source===selected).map(f=>f.source))].map(id=>(sources.find(s=>s.id===id)||{label:id}).label).join(' · ')}
 return {sources,types,source,kind,facets,matches,sourceCounts,typeCounts,labels};
});
