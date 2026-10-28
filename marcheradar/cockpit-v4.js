/* MarchéRadar — cockpit KDRIX (V4)
 * Navigation: dossier principal > domaine > type de publication > échéance.
 * Rendu neutre, uniquement sur des informations présentes dans les données.
 * Sans modification des notes, favoris ni classements enregistrés.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.MRCockpit=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 function txt(v){return v==null?'':String(v).trim()}
 function esc(v){return txt(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
 const types=[
  {id:'all',label:'Tous les types'},
  {id:'competition',label:"Appels d'offres"},
  {id:'result',label:'Résultats'},
  {id:'prospect',label:'Prospection'},
  {id:'unknown',label:'À qualifier'}
 ];
 function kind(m){
  if(!m||typeof m!=='object')return 'unknown';
  if(m.source==='LOCALE')return 'prospect';
  const k=txt(m.noticeKind).toLowerCase();
  const notice=txt(m.noticeType).toLowerCase();
  if(k==='award'||/^(can|e4|result|award)(?:[-_]|$)/.test(notice))return 'result';
  if(k==='competition'||/^cn(?:[-_]|$)/.test(notice))return 'competition';
  return 'unknown';
 }
 function matchesType(m,type){return !type||type==='all'||kind(m)===type}
 function typeLabel(type){
  return ({competition:"Appel d'offres",result:"Avis de résultat",prospect:'Prospection locale',unknown:'Type à confirmer'})[type]||'Publication';
 }
 function typeBadge(m){const k=kind(m);return '<span class="v4-kind v4-kind-'+esc(k)+'">'+esc(typeLabel(k))+'</span>'}
 function typeCounts(list){
  const r={all:0,competition:0,result:0,prospect:0,unknown:0};
  for(const m of list||[]){const k=kind(m);r.all++;r[k]++}
  return r;
 }
 function renderTypeFilters(counts,active){
  return types.map(t=>'<button type="button" class="v4-type-btn'+(t.id===active?' active':'')+'" data-publication="'+esc(t.id)+'" aria-pressed="'+(t.id===active?'true':'false')+'">'+esc(t.label)+' <span class="v4-type-count">'+(counts[t.id]||0)+'</span></button>').join('');
 }
 // Metrics do not equate "date not published" with an officially open procedure.
 function metrics(list,stageOf,dueStatus,daysLeft){
  const result={unclassified:0,nearDeadline:0,unknownDeadline:0,awards:0,localProspects:0,
   total:(list||[]).length};
  const ongoing=['inbox','maybe','answer'];
  for(const m of list||[]){
   const t=kind(m),stage=stageOf(m.id);
   if(stage==='irrelevant'){result.total--;continue}
   if(t==='competition'){
    const due=dueStatus(m);
    if(stage==='inbox'&&m.screening!=='excluded')result.unclassified++;
    if(ongoing.includes(stage)){
     if(due==='unknown')result.unknownDeadline++;
     const n=daysLeft(m.deadline);
     if(due==='open'&&n!==null&&n>=0&&n<=14)result.nearDeadline++;
    }
   }else if(t==='result')result.awards++;
   else if(t==='prospect'&&m.screening!=='excluded')result.localProspects++;
  }
  return result;
 }
 function renderCockpit(metrics){
  const items=[
   {label:'Appels d’offres à trier',count:metrics.unclassified,note:'Non classés, hors correspondances écartées',action:'competition'},
   {label:'Échéances sous 14 jours',count:metrics.nearDeadline,note:'Procédures avec date renseignée',action:null},
   {label:'Dates à vérifier',count:metrics.unknownDeadline,note:'Procédures suivies, sans échéance fiable',action:null},
   {label:'Avis de résultat',count:metrics.awards,note:'À analyser commercialement',action:'result'}
  ];
  return '<div class="v4-cockpit-title"><div><span class="v4-eyebrow">VEILLE OPÉRATIONNELLE</span>'+
  '<h2>Ce qui compte pour KDRIX</h2><p>Quatre repères utiles, sans confondre marchés ouverts, résultats et pistes communales.</p></div>'+
  '<span class="v4-total">'+esc(metrics.total)+' dossiers en base</span></div>'+
  '<div class="v4-kpi-grid">'+items.map((a,i)=>'<'+(a.action?'button type="button"':'div')+
    ' class="v4-metric'+(a.action?' v4-metric-action':'')+'"'+(a.action?' data-cockpit="'+esc(a.action)+'" aria-label="'+esc(a.label+' : '+a.count+' — afficher')+'"':'')+'>'+
   '<span class="v4-metric-label">'+esc(a.label)+'</span>'+
   '<strong>'+a.count+'</strong><small>'+esc(a.note)+'</small>'+
   (a.action?'<span class="v4-metric-see">Consulter ↗</span>':'')+'</'+(a.action?'button':'div')+'>').join('')+'</div>';
 }
 function sourceCount(m){
  const n=(Array.isArray(m.documentInventory)?m.documentInventory.length:0);
  const files=(Array.isArray(m.documents)?m.documents.length:0);
  const read=(Array.isArray(m.documentAnalyses)?m.documentAnalyses.length:0);
  return {indexed:n,linked:files,read};
 }
 function preview(m,stage,deadlineStatus,options={}){
  if(!m)return '<div class="v4-preview-idle"><strong>Aucun marché visible</strong><p>Adapte les filtres pour retrouver les dossiers de suivi.</p></div>';
  const type=kind(m),sources=sourceCount(m);
  const archived=options.horsSujet===true;
  let when;
  if(type==='result')when='Avis de résultat publié — aucune soumission à préparer sur cet avis';
  else if(type==='prospect')when='Piste communale — aucune procédure ouverte confirmée';
  else if(type==='competition')when=!m.deadline?
   'Date limite de remise non vérifiée':(deadlineStatus==='open'?'Date de remise à venir selon la source':deadlineStatus==='closed'?'Date limite publiée dépassée':'Date et heure limites à vérifier');
  else when='Nature de la procédure à confirmer';
  const field=(label,value)=>'<div class="v4-preview-field"><span>'+esc(label)+'</span><b>'+esc(value)+'</b></div>';
  const deadline=txt(m.deadline)?txt(m.deadline).slice(0,10).split('-').reverse().join('/'):'Non renseignée';
  const warning=type==='competition'&&!m.deadline?'Vérifier la date sur e-Procurement ou TED avant toute décision.':
   type==='prospect'?'Vérifier que le projet communal correspond à une opportunité d’étude réelle.':
   type==='result'?'Résultat utile pour la veille concurrentielle et les renouvellements.':
   'Vérifier le type de publication et les documents.';
  const docText=sources.read?sources.read+' PDF lu(s) automatiquement':
   sources.indexed?sources.indexed+' pièce(s) répertoriée(s), lecture à vérifier':
   sources.linked?sources.linked+' fichier(s) lié(s)':'Aucune pièce indexée';
  const sectors=Array.isArray(m.sectors)&&m.sectors.length?m.sectors:[m.sector||'À déterminer'];
  const description=txt(m.description).replace(/\s+/g,' ');
  const shortDescription=description.length>450?description.slice(0,449).replace(/\s+\S*$/,'')+'…':description;
  const analyses=Array.isArray(m.documentAnalyses)?m.documentAnalyses.filter(a=>Array.isArray(m.documentInventory)&&m.documentInventory.some(d=>d.documentId===a.documentId&&d.versionId===a.versionId)):[];
  const firstEvidence=analyses.flatMap(a=>(a.evidence||[]).slice(0,1).map(e=>({file:a.fileName,page:e.page,excerpt:e.excerpt}))).slice(0,2);
  const passages=firstEvidence.length?'<div class="v5-preview-evidence"><strong>Passages repérés automatiquement — à vérifier</strong>'+
   firstEvidence.map(e=>'<p><span>'+esc(e.file||'PDF')+' · p. '+esc(e.page)+'</span>'+esc(e.excerpt||'')+'</p>').join('')+'</div>':'';
  const notes=txt(options.notes).replace(/\s+/g,' ');
  return '<div class="v4-preview-head"><span class="v4-eyebrow">LECTURE RAPIDE · MARCHÉ SÉLECTIONNÉ</span><h3>'+esc(m.title||'Publication sans titre')+'</h3>'+
   '<div>'+typeBadge(m)+'</div></div>'+
   '<div class="v5-preview-summary"><strong>Objet de la mission</strong><p>'+esc(shortDescription||'Aucun descriptif suffisamment précis dans les données collectées. Consulter la source officielle.')+'</p></div>'+
   '<div class="v4-preview-fields">'+
   field('Acheteur',m.buyer||'Non renseigné')+
   field('Dossier KDRIX',stage)+
   field('Domaine(s)',sectors.join(' · '))+
   field('Échéance',type==='competition'?deadline:'Pas de date de remise associée')+
   field('Documents',docText)+
   field('Source et zone',(m.source||'Source non renseignée')+' · '+(m.region||'Région non précisée'))+
   '</div>'+
   '<p class="v4-preview-status">'+esc(when)+'</p>'+passages+
   (notes?'<div class="v5-preview-note"><strong>Votre note KDRIX</strong><p>'+esc(notes.slice(0,240))+'</p></div>':'')+
   '<p class="v4-preview-advice">'+esc(warning)+'</p>'+
   '<div class="v5-preview-actions"><button type="button" class="v4-preview-open" id="quickOpenTender" data-id="'+esc(m.id)+'">Fiche complète <span aria-hidden="true">↗</span></button>'+
   '<button type="button" class="v5-preview-dismiss'+(archived?' v5-restore':'')+'" id="quickDismissTender" data-id="'+esc(m.id)+'">'+
   (archived?'Réintégrer au listing':'Écarter : Hors sujet')+'</button></div>'+
   '<p class="v5-preview-footnote">Les informations affichées proviennent des publications collectées. Les obligations restent à confirmer dans le CSC.</p>';
 }
 return {kind,matchesType,types,typeLabel,typeBadge,typeCounts,renderTypeFilters,metrics,renderCockpit,preview,sourceCount};
});
