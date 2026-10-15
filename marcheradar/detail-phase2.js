/* MarchéRadar V2 — fiche documentaire, phase 2.
 * Contrat de données : exploite uniquement les champs réellement collectés.
 * Une visite, une exigence ou un document n'est pas réputé vérifié par inférence textuelle.
 * Aucun appel réseau, aucune donnée personnelle, aucun état local.
 */
(function(root,factory){
 'use strict';
 var api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.MRDetailV2=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
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
  if(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)){var tz=(s.match(/(?:Z|[+-]\d{2}:\d{2})$/)||[])[0];return date+' · '+esc(s.slice(11,16))+(tz?' (UTC'+(tz==='Z'?'+00:00':tz)+')':' (fuseau à vérifier)');}
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
  function add(raw,label,kind,meta,unique){
   var u=linkUrl(raw);if(!u)return;
   var key=unique?kind+'|'+u+'|'+str(unique):u;
   if(seen.has(key))return;
   seen.add(key);
   out.push({url:u,label:str(label),kind:kind,site:hostOf(u),meta:str(meta)});
  }
  (Array.isArray(m.documents)?m.documents:[]).forEach(function(d){
   if(!d||typeof d!=='object')return;
   var direct=linkUrl(d.url||d.href),catalogue=linkUrl(d.accessPageUrl),isListed=!direct&&!!catalogue;
   var src=direct||catalogue;
   if(!src)return;
   var title=str(d.title||d.label)||docKind(d);
   var label=(d.type&&d.type!=='autre'?docKind(d)+' · ':'')+title;
   var parts=[];
   if(isListed)parts.push('Fichier listé sur le portail officiel — téléchargement depuis sa page');
   else parts.push('Lien direct renseigné — vérifier le fichier');
   if(d.version)parts.push('version '+str(d.version));
   if(d.publicationDate)parts.push('publié le '+formattedDate(d.publicationDate));
   if(d.languages&&d.languages.length)parts.push('langue(s) '+d.languages.join(', '));
   if(d.sourcePage)parts.push('page '+d.sourcePage);
   add(src,label,'document',parts.join(' · '),d.id||title);
  });
  (Array.isArray(m.officialSources)?m.officialSources:[]).forEach(function(d){
   if(!d||typeof d!=='object')return;
   var origin=str(d.source).toLowerCase(),url=str(d.url);
   var council=m.source==='LOCALE'||origin.includes('communal');
   if(d.kind==='documents_portal'){
    add(url,'Accéder au dossier documentaire référencé','document_portal',
      'Lien figurant dans la publication officielle — fichiers à consulter sur le portail');
    return;
   }
   var label=council?'Consulter le document communal':origin.includes('bosa')?'Ouvrir le dossier e-Procurement':origin.includes('ted')?'Ouvrir l’avis TED':'Consulter la publication source';
   add(url,label,council?'council':'notice',council?'Document source référencé':'Portail officiel — annexes à consulter sur place');
  });
  if(m.sourceDocument)add(m.sourceDocument,'Consulter le document communal','council','Document source référencé');
  if(m.url){
   var name=m.source==='TED'?'Ouvrir l’avis TED':m.source==='BOSA'?'Ouvrir le dossier e-Procurement':m.source==='LOCALE'?'Consulter le document communal':'Consulter la publication';
   add(m.url,name,m.source==='LOCALE'?'council':'notice',m.source==='LOCALE'?'Document source référencé':'Portail officiel — annexes à consulter sur place');
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
  var visit=visitState(m),req=requirements(m),due=status(m),local=m.source==='LOCALE';
  var noticeType=m.noticeKind==='award'?'Avis de résultat':m.noticeKind==='competition'?'Avis de mise en concurrence':local?'Piste de prospection':'Publication';
  var header='<div class="mr2-intro"><div class="mr2-eyebrow">'+esc(local?'VEILLE COMMUNALE':'PUBLICATION OFFICIELLE')+' · '+esc(str(m.source)||'Source à vérifier')+'</div>'+
   '<h3 class="mr2-title">'+esc(m.title||'Marché sans intitulé')+'</h3>'+
   '<div class="mr2-pills">'+pill(due.label,due.tone)+pill(noticeType,'muted')+(m.screening==='review'?pill('Correspondance à vérifier','unknown'):m.screening==='excluded'?pill('Correspondance écartée à examiner','unknown'):'')+'</div>'+
   '<p class="mr2-summary">'+esc(m.description||'Résumé non renseigné dans les données collectées.')+'</p></div>';
  var summary=section('Informations principales','<div class="mr2-fields">'+
   field('Pouvoir adjudicateur',m.buyer||'Non communiqué')+field('Référence',reference(m))+
   field('Zone',m.region||'Non localisée')+field('Date de publication',formattedDate(m.publication))+
   field('Date limite de remise',dateTime(m.deadline)+(m.deadlineTime&&!/T\d{2}:\d{2}/.test(str(m.deadline))?' · heure signalée '+str(m.deadlineTime)+' (à confirmer)':''),m.deadlineEvidence?.verified?'Échéance vérifiée dans '+str(m.deadlineEvidence.source)+' — '+(m.deadlineEvidence.precision==='datetime'?'heure et fuseau disponibles':'heure non publiée'):!m.deadline?'Consulter la publication officielle avant d’engager une offre.':/^\d{4}-\d{2}-\d{2}$/.test(str(m.deadline))?'L’heure limite n’est pas présente dans les données.':'Horodatage issu des données de collecte.')+
   field('CPV',Array.isArray(m.cpv)&&m.cpv.length?m.cpv.join(' · '):'Non renseigné')+
   field('Délai d’exécution',m.executionDuration||'Non renseigné')+
   field('Procédure',noticeType)+
   '</div>'+
   '<p class="mr2-footnote">Le classement reste indicatif lorsque l’heure n’est pas publiée. Une date dépassée ne prouve pas la clôture administrative.</p>'+ (m.deadlineEvidence?.verified&&linkUrl(m.deadlineEvidence.sourceUrl)?'<p class="mr2-footnote">Échéance documentée : <a class="mr2-inline-link" target="_blank" rel="noopener noreferrer" href="'+esc(linkUrl(m.deadlineEvidence.sourceUrl))+'">voir la publication source ↗</a></p>':'')+(m.deadlineReview?'<div class="mr2-highlight mr2-caution"><strong>Échéance à recontrôler</strong><p>Une nouvelle publication comporte une information différente : la dernière échéance vérifiée a été conservée en attendant une validation.</p></div>':''));
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
    '<p class="mr2-footnote">Les titres et versions proviennent des catalogues publics. Les fichiers simplement listés se téléchargent depuis la page officielle, sans lien individuel supposé.</p>':
    '<div class="mr2-highlight"><strong>Aucun fichier de marché indexé</strong><p>Le cahier spécial des charges, les plans et les bordereaux ne sont pas encore récupérés automatiquement. Utiliser les publications officielles ci-dessous pour les rechercher.</p></div>';
  if(m.bulkDocumentDownload?.verified===true)docsBody+='<div class="mr2-highlight"><strong>Téléchargement groupé public vérifié</strong><p>Le téléchargement de l’archive ZIP contenant '+esc(m.bulkDocumentDownload.fileCount)+' fichiers a été testé depuis le portail officiel. Cliquez sur les fichiers ci-dessus pour ouvrir la page Documents et utiliser « Télécharger tous les documents ». L’application ne conserve pas l’archive.</p></div>';
  docsBody+='<h5 class="mr2-mini-title">Publications et documents sources</h5>'+
    (others.length?'<div class="mr2-link-list">'+others.map(external).join('')+'</div>':'<p class="mr2-empty">Aucun lien source exploitable renseigné.</p>');
  var documents=section('Accès aux documents',docsBody,docs.length+' fichier(s) repéré(s)');
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
  var localBody=local?section('Trace de prospection',
   '<div class="mr2-highlight"><strong>Il ne s’agit pas nécessairement d’un appel d’offres ouvert.</strong>'+
   '<p>Un document communal a été repéré. Sa date et son intérêt actuel doivent être vérifiés avant de contacter le pouvoir adjudicateur.</p></div>'+
   (m.evidence?'<div class="mr2-evidence"><strong>Extrait repéré</strong><p>'+esc(m.evidence)+'</p></div>':'')+
   (m.opportunityStage?'<div class="mr2-evidence">Qualification automatique : '+esc(m.opportunityStage.replace(/_/g,' '))+'</div>':'')):'';
  return {html:header+summary+visitSection+documents+section('Sélection et critères d’attribution',reqBody)+localBody,
   primary:primarySource(m),documentCount:docs.length,visitKind:visit.kind,reference:reference(m),status:due};
 }
 function listHints(m){
  var v=visitState(m);
  var vLabel=v.kind==='required'?'Visite obligatoire':v.kind==='optional'?'Visite facultative':v.kind==='review'?'Visite à vérifier':'Visite non renseignée';
  var source=primarySource(m),docs=safeDocs(m);
  var dLabel=docs.length?docs.length+' fichier(s) repéré(s)':source?'Accès à la source':'Source non renseignée';
  return '<div class="mr2-list-hints">'+(m.noticeKind==='award'?'<span>Avis de résultat</span>':'')+'<span>'+esc(vLabel)+'</span><span>'+esc(dLabel)+'</span></div>';
 }
 return {render:render,status:status,sources:sources,primarySource:primarySource,visitState:visitState,requirements:requirements,linkUrl:linkUrl,listHints:listHints};
});
