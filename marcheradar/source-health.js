/* Métadonnées de collecte : une date de lecture du site n'est pas une date
   de succès du collecteur. Aucune couverture n'est déduite d'un simple lien. */
(function(root,factory){
 'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.MRSources=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const provinces={brabant_wallon:'Brabant wallon',hainaut:'Hainaut',liege:'Liège',luxembourg:'Luxembourg',namur:'Namur'};
 function provinceOf(c){
  const ins=String(c.ins||'');
  return ins.startsWith('25')?'brabant_wallon':({5:'hainaut',6:'liege',8:'luxembourg',9:'namur'})[ins[0]]||'unknown';
 }
 function date(value){
  if(!value||!Number.isFinite(Date.parse(value)))return 'Non enregistré';
  return new Intl.DateTimeFormat('fr-BE',{timeZone:'Europe/Brussels',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(value));
 }
 function health(record,now=Date.now()){
  const r=record||{},success=Number.isFinite(Date.parse(r.last_success))?r.last_success:null;
  const attempt=r.last_attempt||success;
  const stale=!success||now-Date.parse(success)>48*3600000;
  const failed=!!r.last_error||['unavailable','error','failed'].includes(r.status);
  const complete=r.complete===true;
  return {success,attempt,stale,failed,complete,
   label:failed?'Dernière tentative en échec':!success?'Collecte non confirmée':stale?'Dernier succès ancien':complete?'Période parcourue':'Collecte partielle',
   ok:!!success&&!stale&&!failed&&complete};
 }
 function docs(c){return Math.max(Number(c.documentsRead)||0,Object.values(c.documentChecks||{}).filter(x=>x.sha256&&x.lastSuccess).length)}
 function communeState(c){
  const checks=[...Object.values(c.documentChecks||{}),...Object.values(c.documentSourceChecks||{})];
  const errors=[...(c.errors||[]),...checks.filter(x=>x.lastError).map(x=>x.lastError)];
  if(['site_indisponible','site_en_erreur'].includes(c.sourceStatus)&&!errors.length)errors.push('Site inaccessible au dernier contrôle');
  if(c.lastDocumentResult?.errors&&!errors.length)errors.push('Dernier lot documentaire : '+c.lastDocumentResult.errors+' erreur(s)');
  if(errors.length)return {key:'error',label:(docs(c)>0||(c.htmlDocumentsRead||0)>0)?'Dernier contrôle en erreur · lectures antérieures conservées':'Dernier contrôle en erreur',errors};
  if(docs(c)>0||(c.htmlDocumentsRead||0)>0)return {key:'read',label:'Documents lus · couverture partielle',errors};
  if((c.deliberationSources||[]).some(s=>s.status==='page_accessible'&&s.scopeStatus!=='non_documentary'))return {key:'pages',label:'Pages repérées · documents non confirmés',errors};
  if(c.lastSiteCheck)return {key:'checked',label:'Site consulté · documents non confirmés',errors};
  return {key:'pending',label:c.officialSite?'Pas encore contrôlée':'Adresse manquante',errors};
 }
 function counts(list){
  const r={total:0,sites:0,pages:0,read:0,documents:0,errors:0};
  for(const c of list||[]){r.total++;if(c.lastSiteCheck)r.sites++;
   if((c.deliberationSources||[]).some(s=>s.status==='page_accessible'&&s.scopeStatus!=='non_documentary'))r.pages++;
   const n=docs(c);if(n>0||(c.htmlDocumentsRead||0)>0)r.read++;r.documents+=n;
   if(communeState(c).key==='error')r.errors++;
  }return r;
 }
 return {provinces,provinceOf,date,health,docs,communeState,counts};
});
