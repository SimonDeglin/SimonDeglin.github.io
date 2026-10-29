/* MarchéRadar V2 — fiche documentaire, phase 2.
 * Contrat de données : exploite uniquement les champs réellement collectés.
 * Une visite, une exigence ou un document n'est pas réputé vérifié par inférence textuelle.
 * Aucun appel réseau, aucune donnée personnelle, aucun état local.
 */
(function(root,factory){
 'use strict';
 var api=factory(typeof module==='object'&&module.exports?require('./publication-filters.js'):root.MRPublications,typeof module==='object'&&module.exports?require('./document-dates.js'):root.MRDocumentDates);
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.MRDetailV2=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(publications,documentDates){
 'use strict';
 function str(x){return x==null?'':String(x).trim()}
 function esc(x){return str(x).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
 function linkUrl(raw){
  try{
   var u=new URL(str(raw));
   if(!/^https?:$/.test(u.protocol)||u.username||u.password||!u.hostname||u.hostname.indexOf('.')<0)return '';
   if(u.href.length>1800)return '';
   return u.href;
  }catch(e){return ''}
 }
 function hostOf(raw){try{return new URL(raw).hostname.replace(/^www\./,'')}catch(e){return ''}}
 function dateOnly(raw){
  var match=/^(\d{4})-(\d{2})-(\d{2})/.exec(str(raw));
  if(!match)return '';
  var d=new Date(match[1]+'-'+match[2]+'-'+match[3]+'T12:00:00Z');
  return !isNaN(d)&&d.toISOString().slice(0,10)===match[0]?
   match[3]+'/'+match[2]+'/'+match[1]:'';
 }
 function formattedDate(raw){return dateOnly(raw)||'Non publiée'}
 function dateTime(raw){
  var s=str(raw),date=formattedDate(s);
  if(!s)return 'Non publiée';
  if(/^\d{4}-\d{2}-\d{2}$/.test(s))return date+' — heure non publiée';
  if(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s))return date+' · '+esc(s.slice(11,16))+( /(?:Z|[+-]\d{2}:\d{2})$/.test(s)?' (fuseau indiqué dans la source)':' (fuseau à vérifier)' );
  return date;
 }
 function status(m,now){
  var s=str(m.deadline);
  var parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Brussels',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now||new Date());
  function p(name){return (parts.find(function(v){return v.type===name})||{}).value||''}
  var today=p('year')+'-'+p('month')+'-'+p('day');
  if(m.noticeKind==='award')return {label:'Avis de résultat',tone:'neutral',kind:'result'};
  if(!s){
   if(m.source==='LOCALE'&&m.screening!=='excluded')return {label:'Prospection — échéance non publiée',tone:'prospect',kind:'prospect'};
   return {label:'Échéance à vérifier',tone:'unknown',kind:'unknown'};
  }
  if(/^\d{4}-\d{2}-\d{2}$/.test(s)){
   if(!dateOnly(s))return {label:'Date à vérifier',tone:'unknown',kind:'unknown'};
   return s>=today?{label:'Date de remise à venir',tone:'open',kind:'open'}:{label:'Date limite dépassée',tone:'closed',kind:'closed'};
  }
  if(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(s)){
   var timestamp=Date.parse(s);
   if(Number.isFinite(timestamp))return timestamp>=(now?now.getTime():Date.now())?
    {label:'Remise encore possible selon date publiée',tone:'open',kind:'open'}:
    {label:'Date limite dépassée',tone:'closed',kind:'closed'};
  }
  return {label:'Date et heure à vérifier',tone:'unknown',kind:'unknown'};
 }
 function reference(m){
  return str(m.internalReference||m.bdaReference||m.publicationNumber||m.tedReference||m.procedureIdentifier||m.noticeId)||'Non communiquée';
 }
 function docKind(d){
  var raw=str(d.type||d.kind).toLowerCase();
  if(/csc|cahier|specification|tender[_ -]?document/.test(raw))return 'Cahier spécial des charges';
  if(/plan|drawing/.test(raw))return 'Plan';
  if(/borde|price|quantity/.test(raw))return 'Bordereau';
  if(/annexe|appendix/.test(raw))return 'Annexe';
  if(/rectificatif|amend|corrigend/.test(raw))return 'Rectificatif';
  if(/question|clarif/.test(raw))return 'Questions et réponses';
  return 'Document du marché';
 }
 function sources(m){
  var out=[],seen=new Set();
  function add(raw,label,kind,meta){
   var u=linkUrl(raw);if(!u||seen.has(u))return;
   seen.add(u);
   out.push({url:u,label:str(label),kind:kind,site:hostOf(u),meta:str(meta)});
  }
  (Array.isArray(m.documents)?m.documents:[]).forEach(function(d){
   if(!d||typeof d!=='object')return;
   add(d.url||d.href,str(d.title||d.label)||docKind(d),'document',d.sourcePage?'Page '+d.sourcePage:'Lien renseigné — accessibilité à vérifier');
  });
  // Adresse de la rubrique Documents relevée sur le portail officiel.
  // Une rubrique accessible n'est PAS un fichier CSC vérifié.
  if(m.documentsPageUrl)add(m.documentsPageUrl,'Ouvrir la rubrique Documents e-Procurement','portal_documents','Liste officielle des pièces — présence et téléchargement à vérifier');
  (Array.isArray(m.consultationUrls)?m.consultationUrls:[]).forEach(function(x){
   if(x&&x.url)add(x.url,'Documents hébergés par un prestataire externe','external_consultation','Lien référencé par BOSA — fichiers et accès à vérifier');
  });
  (Array.isArray(m.officialSources)?m.officialSources:[]).forEach(function(d){
   if(!d||typeof d!=='object')return;
   var origin=str(d.source).toLowerCase(),url=str(d.url);
   var council=m.source==='LOCALE'||origin.includes('communal');
   var text=council?'Consulter le document communal':origin.includes('bosa')?'Ouvrir le dossier e-Procurement':origin.includes('ted')?'Ouvrir l’avis TED':'Consulter la publication source';
   add(url,text,council?'council':'notice',council?'Document source référencé':'Portail officiel — annexes à consulter sur place');
  });
  if(m.sourceDocument)add(m.sourceDocument,'Consulter le document communal','council','Document source référencé');
  if(m.url){
   var text=m.source==='TED'?'Ouvrir l’avis TED':m.source==='BOSA'?'Ouvrir le dossier e-Procurement':m.source==='LOCALE'?(publications&&publications.source(m)==='other'?'Consulter le document public':'Consulter le document communal'):'Consulter la publication';
   add(m.url,text,m.source==='LOCALE'?'council':'notice',m.source==='LOCALE'?'Document source référencé':'Portail officiel — annexes à consulter sur place');
  }
  return out;
 }
 function primarySource(m){
  var list=sources(m);
  return list.find(function(x){return x.kind==='notice'})||list.find(function(x){return x.kind==='council'})||list[0]||null;
 }
 function safeDocs(m){return sources(m).filter(function(x){return x.kind==='document'})}
 function visitState(m){
  var v=m.visit&&typeof m.visit==='object'?m.visit:null;
  var hints=(Array.isArray(m.constraints)?m.constraints:[]).filter(function(x){return /visite|rendez-vous sur site|attestation de visite/i.test(str(x))}).map(str);
  if(v&&['required','optional','none'].includes(v.status)&&v.verified===true&&linkUrl(v.sourceUrl)&&str(v.evidence)){
   return {kind:v.status,label:v.status==='required'?'Visite obligatoire (source documentée)':v.status==='optional'?'Visite facultative (source documentée)':'Aucune visite prévue (source documentée)',date:str(v.date),time:str(v.time),place:str(v.place),registration:str(v.registration),registrationDeadline:str(v.registrationDeadline),contact:str(v.contact),page:v.page||null,evidence:str(v.evidence),sourceUrl:linkUrl(v.sourceUrl)};
  }
  if(v||hints.length)return {kind:'review',label:'Mention de visite à vérifier',hints:hints.slice(0,3),evidence:v?str(v.evidence):'',sourceUrl:v?linkUrl(v.sourceUrl):''};
  return {kind:'unknown',label:'Visite non vérifiée',hints:[]};
 }
 function requirements(m){
  var raw=Array.isArray(m.requirements)?m.requirements:[];
  return raw.filter(function(item){return item&&typeof item==='object'&&str(item.text||item.description)}).map(function(item){
   return {text:str(item.text||item.description),type:str(item.type),verified:item.verified===true&&!!linkUrl(item.sourceUrl)&&!!str(item.evidence),sourceUrl:linkUrl(item.sourceUrl),page:item.page||null,evidence:str(item.evidence)};
  }).slice(0,20);
 }
 function field(label,value,extra){
  return '<div class="mr2-field"><span>'+esc(label)+'</span><strong>'+esc(value||'Non publié')+'</strong>'+(extra?'<small>'+esc(extra)+'</small>':'')+'</div>';
 }
 function pill(text,tone){return '<span class="mr2-pill '+esc(tone||'muted')+'">'+esc(text)+'</span>'}
 function external(item){
  return '<a class="mr2-source-link" target="_blank" rel="noopener noreferrer" href="'+esc(item.url)+'"><span class="mr2-link-name">'+esc(item.label)+'</span><span class="mr2-link-origin">'+esc(item.site)+'</span>'+(item.meta?'<span class="mr2-link-meta">'+esc(item.meta)+'</span>':'')+'<span class="mr2-link-arrow" aria-hidden="true">↗</span></a>';
 }
 function section(title,body,subtitle){
  return '<section class="mr2-section"><div class="mr2-section-head"><h4>'+esc(title)+'</h4>'+(subtitle?'<span>'+esc(subtitle)+'</span>':'')+'</div>'+body+'</section>';
 }
 function render(m,options){
  options=options||{};
  var all=sources(m),docs=all.filter(function(x){return x.kind==='document'}),others=all.filter(function(x){return x.kind!=='document'});
  var selectedType=options.publicationType||'all',selectedSource=options.sourceFilter||'all';
  var focused=publications&&(selectedType!=='all'||selectedSource!=='all')?publications.facets(m).find(function(f){return (selectedType==='all'||f.type===selectedType)&&(selectedSource==='all'||f.source===selectedSource)}):null;
  var visit=visitState(m),req=requirements(m),due=selectedType==='result'&&focused?{label:'Avis de résultat',tone:'neutral',kind:'result'}:status(m),local=m.source==='LOCALE'&&(!publications||publications.source(m)==='municipal');
  var noticeType=m.noticeKind==='award'?'Avis de résultat':m.noticeKind==='competition'?'Avis de mise en concurrence':local?'Piste de prospection':'Publication';
  if(focused&&selectedType!=='all')noticeType=selectedType==='result'?'Avis de résultat':selectedType==='competition'?'Avis de mise en concurrence':selectedType==='prospect'?'Piste de prospection':'Autre publication';
  var selection=focused?'<div class="mr2-highlight mr2-caution"><strong>Vue sélectionnée : '+esc((publications.sources.find(function(s){return s.id===focused.source})||{label:focused.source}).label)+' · '+esc(noticeType)+'</strong><p>Les rubriques décrivent le dossier regroupé. Vérifier la chronologie et les versions des avis.</p></div>':'';
  var header='<div class="mr2-intro"><div class="mr2-eyebrow">'+esc(local?'VEILLE COMMUNALE':m.source==='LOCALE'?'SITE PUBLIC':'PUBLICATION OFFICIELLE')+' · '+esc(publications?publications.labels(m,selectedSource):(str(m.source)||'Source à vérifier'))+'</div>'+
   '<h3 class="mr2-title">'+esc(m.title||'Marché sans intitulé')+'</h3>'+
   '<div class="mr2-pills">'+pill(due.label,due.tone)+pill(noticeType,'muted')+(m.screening==='review'?pill('Correspondance à vérifier','unknown'):m.screening==='excluded'?pill('Correspondance écartée à examiner','unknown'):'')+'</div>'+
   '<p class="mr2-summary">'+esc(m.description||'Résumé non renseigné dans les données collectées.')+'</p></div>';
  var dated=documentDates&&documentDates.view(m);
  var summary=section('Informations principales','<div class="mr2-fields">'+
   field('Pouvoir adjudicateur',m.buyer||'Non communiqué')+field('Référence',reference(m))+
   field('Zone',m.region||'Non localisée')+(dated?field(dated.label,dated.value,dated.proof)+(m.sourceDocumentDates?.session&&m.sourceDocumentDates?.document?field('Date du document',documentDates.format(m.sourceDocumentDates.document.date),'Date distincte de la séance et de la collecte.'):'' ):field('Date de publication',formattedDate(m.publication)))+
   field(selectedType==='result'&&focused?'Date limite de l’appel d’offres du dossier':'Date limite de remise',dateTime(m.deadline)+(m.deadlineTime&&!/T\d{2}:\d{2}/.test(str(m.deadline))?' · heure signalée '+str(m.deadlineTime)+' (à confirmer)':''),m.deadlineSourceKind==='bosa_verified_public'&&m.deadlineSourceUrl?'Date et heure vérifiées dans le dossier officiel e-Procurement. Vérifier les éventuels rectificatifs.':!m.deadline?'Consulter la publication officielle avant d’engager une offre.':/^\d{4}-\d{2}-\d{2}$/.test(str(m.deadline))?'L’heure limite n’est pas présente dans les données.':'Horodatage issu des données de collecte.')+
   field('CPV',Array.isArray(m.cpv)&&m.cpv.length?m.cpv.join(' · '):'Non renseigné')+
   field('Délai d’exécution',m.executionDuration||'Non renseigné')+
   field('Procédure',noticeType)+
   '</div>'+
   '<p class="mr2-footnote">Le classement des échéances est indicatif si l’heure de remise n’est pas publiée. Une date dépassée ne constitue pas une preuve de clôture administrative de la procédure.</p>');
  var visitBody='<div class="mr2-highlight '+(visit.kind==='required'?'mr2-risk':visit.kind==='review'?'mr2-caution':'')+'">'+
   '<strong>'+esc(visit.label)+'</strong>'+
   '<p>'+(visit.kind==='unknown'?'Aucune vérification documentaire de l’existence d’une visite n’est disponible. Consulter le cahier spécial des charges et les avis rectificatifs.':visit.kind==='review'?'Une mention a été repérée, mais son caractère obligatoire, sa date et ses modalités ne sont pas confirmés.':'Information structurée accompagnée d’une référence documentaire.')+'</p>'+
   '</div>';
  if(visit.kind==='required'||visit.kind==='optional'||visit.kind==='none'){
   visitBody+='<div class="mr2-fields">'+field('Date',visit.date?formattedDate(visit.date):'Non renseignée')+field('Heure',visit.time||'Non renseignée')+
   field('Lieu',visit.place||'Non renseigné')+field('Inscription',visit.registration||'Non renseignée')+
   field('Date limite d’inscription',visit.registrationDeadline?formattedDate(visit.registrationDeadline):'Non renseignée')+
   field('Contact',visit.contact||'Non renseigné')+'</div>'+
   '<div class="mr2-evidence">Extrait source : « '+esc(visit.evidence)+' »'+(visit.page?' · page '+esc(visit.page):'')+
   (visit.sourceUrl?' · <a target="_blank" rel="noopener noreferrer" href="'+esc(visit.sourceUrl)+'">Voir le document ↗</a>':'')+'</div>';
  }
  if(visit.kind==='review'){
   if(visit.hints.length)visitBody+='<div class="mr2-evidence">'+visit.hints.map(function(x){return '<p>'+esc(x)+'</p>'}).join('')+'</div>';
   if(visit.evidence)visitBody+='<div class="mr2-evidence">'+esc(visit.evidence)+'</div>';
   if(visit.sourceUrl)visitBody+='<a class="mr2-inline-link" href="'+esc(visit.sourceUrl)+'" target="_blank" rel="noopener noreferrer">Consulter la source de la mention ↗</a>';
  }
  var visitSection=section('Visite des lieux',visitBody,'À vérifier avant de répondre');
  var docsBody=docs.length?'<div class="mr2-link-list">'+docs.map(external).join('')+'</div>'+
    '<p class="mr2-footnote">Liens renseignés dans la source. Leur disponibilité et leur version doivent être contrôlées.</p>':
    '<div class="mr2-highlight"><strong>Aucun fichier de marché indexé</strong><p>Le cahier spécial des charges, les plans et les bordereaux ne sont pas encore récupérés automatiquement. Utiliser les publications officielles ci-dessous pour les rechercher.</p></div>';
  docsBody+='<h5 class="mr2-mini-title">Publications et documents sources</h5>'+
    (others.length?'<div class="mr2-link-list">'+others.map(external).join('')+'</div>':'<p class="mr2-empty">Aucun lien source exploitable renseigné.</p>');
  var inventory=Array.isArray(m.documentInventory)?m.documentInventory:[];
  var analyses=Array.isArray(m.documentAnalyses)?m.documentAnalyses:[];
  var currentAnalyses=analyses.filter(function(x){return inventory.some(function(doc){return doc.documentId===x.documentId&&doc.versionId===x.versionId})});
  if(inventory.length){
   docsBody='<h5 class="mr2-mini-title">'+inventory.length+' pièce(s) répertoriée(s) dans le registre public BOSA</h5>'+
   '<p class="mr2-footnote">Les intitulés et identifiants proviennent de l’API publique. Certaines pièces peuvent avoir fait l’objet d’une extraction automatique indiquée plus bas. Le téléchargement et les rectificatifs restent à contrôler dans la rubrique Documents.</p>'+
   '<div class="mr2-requirements">'+inventory.slice(0,50).map(function(x){
    return '<div class="mr2-requirement"><strong>'+esc(x.title||'Fichier sans intitulé')+'</strong>'+
    '<small>'+esc(x.fileType||'format non renseigné')+' · '+esc(x.language||'langue non renseignée')+' · '+(currentAnalyses.some(function(a){return a.documentId===x.documentId&&a.versionId===x.versionId})?'texte extrait automatiquement':'accès à vérifier')+'</small></div>';
   }).join('')+'</div>'+docsBody;
  }
  var documents=section('Accès aux documents',docsBody,inventory.length+' pièce(s) répertoriée(s) · '+docs.length+' fichier(s) lié(s)');
  // Passages extraits automatiquement, non validés comme faits de la procédure.
  var reading='';
  if(currentAnalyses.length){
   var labels={references:'Références exigées',constraints:'Contraintes techniques',deadline:'Délais et remise des offres',visit:'Visites / réunions',award:'Attribution',selection:'Sélection et références',deliverables:'Prestations et livrables'};
   var inner='<div class="mr2-highlight mr2-caution"><strong>Lecture automatique — vérification nécessaire</strong>'+
    '<p>Ces extraits ont été repérés dans les PDF officiels. Leur formulation ne confirme ni une échéance, ni une obligation de visite, ni la version en vigueur. Consulter les pièces et les rectificatifs avant de répondre.</p></div>';
   currentAnalyses.forEach(function(a){
    var url=linkUrl(a.sourcePageUrl);
    inner+='<h5 class="mr2-mini-title">'+esc(a.fileName||'Document PDF')+' · '+esc(a.pageCount||'?')+' page(s)</h5>'+
     '<p class="mr2-footnote">Version '+esc(String(a.versionId||'').slice(0,12))+' · empreinte PDF '+esc(String(a.sha256||'').slice(0,14))+'…</p>';
    (Array.isArray(a.evidence)?a.evidence:[]).slice(0,12).forEach(function(p){
     inner+='<div class="mr2-evidence"><strong>'+esc(labels[p.kind]||'Passage documentaire')+' — page '+esc(p.page)+'</strong>'+
      '<p>'+esc(p.excerpt||'')+'</p></div>';
    });
    if(url)inner+='<p><a class="mr2-inline-link" href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">Retrouver ce document dans e-Procurement ↗</a></p>';
   });
   reading=section('Passages repérés dans les documents',inner,currentAnalyses.length+' PDF lu(s)');
  }
  var reqBody='<div class="mr2-highlight"><strong>'+(req.some(function(x){return x.verified})?'Éléments documentés et éléments à contrôler':'Conditions de participation non analysées')+'</strong>'+
   '<p>'+(!req.length?'Les références professionnelles, capacités techniques, critères de sélection et critères d’attribution doivent être consultés dans les documents officiels. Aucun de ces éléments n’a été vérifié par l’application.':'La présence dans cette fiche ne dispense pas de contrôler les exigences et leurs éventuels rectificatifs.')+'</p></div>';
  if(req.length)reqBody+='<div class="mr2-requirements">'+req.map(function(x){
   return '<div class="mr2-requirement">'+pill(x.verified?'Source documentée':'À vérifier',x.verified?'open':'unknown')+
   '<strong>'+esc(x.text)+'</strong>'+(x.evidence?'<p>Extrait : '+esc(x.evidence)+'</p>':'')+
   (x.verified?'<a class="mr2-inline-link" target="_blank" rel="noopener noreferrer" href="'+esc(x.sourceUrl)+'">Consulter la source '+(x.page?'(p. '+esc(x.page)+')':'')+' ↗</a>':'')+'</div>';
  }).join('')+'</div>';
  if(Array.isArray(m.constraints)&&m.constraints.length){
   reqBody+='<h5 class="mr2-mini-title">Points signalés par la collecte — non vérifiés dans le CSC</h5>'+
     '<div class="mr2-bullets">'+m.constraints.map(function(x){return '<div>• '+esc(x)+'</div>'}).join('')+'</div>';
  }
  var localBody=m.source==='LOCALE'?section('Trace de prospection',
   '<div class="mr2-highlight"><strong>Il ne s’agit pas nécessairement d’un appel d’offres ouvert.</strong>'+
   '<p>Un document public a été repéré. Sa date et son intérêt actuel doivent être vérifiés avant de contacter le pouvoir adjudicateur.</p></div>'+
   municipalDocumentTrace(m)+
   (m.evidence?'<div class="mr2-evidence"><strong>'+(m.sourceEvidenceStatus==='not_found'?'Extrait historique — à revalider':'Extrait repéré')+'</strong><p>'+esc(m.evidence)+'</p></div>':'')+
   (m.opportunityStage?'<div class="mr2-evidence">Qualification automatique : '+esc(m.opportunityStage.replace(/_/g,' '))+'</div>':'')):'';
  return {html:selection+header+summary+visitSection+documents+reading+section('Sélection et critères d’attribution',reqBody)+localBody,
   primary:focused&&linkUrl(focused.url)?{url:linkUrl(focused.url),kind:'notice'}:primarySource(m),documentCount:docs.length,visitKind:visit.kind,reference:reference(m),status:due};
 }
 function municipalDocumentTrace(m){
  var v=m.sourceDocumentVersion;
  if(!v||!str(v.sha256))return '';
  var date=Number.isFinite(Date.parse(v.checkedAt))?new Intl.DateTimeFormat('fr-BE',{timeZone:'Europe/Brussels',dateStyle:'short',timeStyle:'short'}).format(new Date(v.checkedAt)):'date non renseignée';
  var html='<div class="mr2-highlight mr2-caution"><strong>'+(v.changedAt?'Modification du fichier PDF détectée':'Version du PDF contrôlée')+'</strong>'+
   '<p>Dernier contrôle : '+esc(date)+' (Bruxelles). Empreinte '+esc(str(v.sha256).slice(0,16))+'…</p>'+
   (v.changedAt?'<p>Une modification du fichier ne constitue pas, à elle seule, un rectificatif officiel du marché.</p>':'')+
   (m.sourceEvidenceStatus==='not_found'?'<p><strong>L’extrait historique n’a pas été retrouvé dans la version contrôlée. Sa validité actuelle doit être vérifiée.</strong></p>':'')+'</div>';
  if(Array.isArray(m.municipalEvidence)&&m.municipalEvidence.length>1){
   html+='<details class="mr2-source-passages"><summary>Passages regroupés du même document ('+m.municipalEvidence.length+')</summary>'+(m.municipalReference?'<p>Référence explicitement repérée : '+esc(m.municipalReference)+'</p>':'<p>Passages du même point communal, à vérifier.</p>')+m.municipalEvidence.slice(0,6).map(function(p){return '<div class="mr2-evidence"><strong>Page '+esc(p.page)+'</strong><p>'+esc(p.excerpt)+'</p></div>'}).join('')+'</details>';
  }
  var review=m.sourceDocumentReview;
  if(review&&review.sha256===v.sha256&&Array.isArray(review.candidates)&&review.candidates.length){
   html+='<details class="mr2-source-changes"><summary>Passages du document à comparer ('+review.candidates.length+')</summary>'+
    '<p class="mr2-footnote">Ces passages concernent le document entier. Leur rattachement à ce marché n’est pas confirmé. Le dossier et son classement sont conservés.</p>'+
    review.candidates.slice(0,6).map(function(p){return '<div class="mr2-evidence"><strong>Page '+esc(p.page)+' — à vérifier</strong><p>'+esc(p.excerpt)+'</p></div>'}).join('')+'</details>';
  }
  return html;
 }
 function listHints(m){
  var v=visitState(m);
  var vLabel=v.kind==='required'?'Visite obligatoire':v.kind==='optional'?'Visite facultative':v.kind==='review'?'Visite à vérifier':'Visite non renseignée';
  var source=primarySource(m),docs=safeDocs(m);
  var inv=Array.isArray(m.documentInventory)?m.documentInventory:[];
  var dLabel=inv.length?inv.length+' pièce(s) répertoriée(s) — accès à vérifier':docs.length?docs.length+' document(s) indexé(s)':source?'Accès à la source':'Source non renseignée';
  return '<div class="mr2-list-hints">'+(m.noticeKind==='award'?'<span>Avis de résultat</span>':'')+'<span>'+esc(vLabel)+'</span><span>'+esc(dLabel)+'</span></div>';
 }
 return {municipalDocumentTrace:municipalDocumentTrace,render:render,status:status,sources:sources,primarySource:primarySource,visitState:visitState,requirements:requirements,linkUrl:linkUrl,listHints:listHints};
});
