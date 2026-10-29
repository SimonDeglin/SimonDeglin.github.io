/* Qualification indicative de l'objet, distincte de l'admissibilité de KDRIX.
   Module partagé par les collecteurs et l'affichage ; aucune capacité interne
   n'est déduite des mots-clés d'un avis. */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MRQualification=api})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const fold=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[’‘]/g,"'").replace(/[–—-]/g,' ').replace(/\s+/g,' ').trim();
 function subject(s){const p=String(s||'').split(/\s+[–—]\s+/);return p.length>=3?p.slice(2).join(' – '):String(s||'')}
 const ROAD=/\b(?:voiries?|routi[eè]r\w*|routes?|ravel|cyclables?|egout\w*|assainissement|hydrauli\w*|hydrolog\w*)\b|espace public|place (?:communale|publique)|reamenagement.{0,35}(?:place|centre)|cours d'eau|bassin d'orage/;
 const ARCH=/\b(?:architectur\w*|eglise|edifice|musee|facades?|batiments?|ecoles?|logements?|vestiaire|buvette|creche|restauration du patrimoine)\b/;
 const AUTHOR=/auteur de projet|mission complete d'etudes|mission de conception|bureau d'etudes/;
 function enrich(m,c){
  const title=fold(subject(m.title)),description=fold(m.description).slice(0,14000),cpv=Array.isArray(m.cpv)?m.cpv:[];
  const local=m.source==='LOCALE'||m.opportunityType==='prospection';
  const architecture=ARCH.test(title)&&AUTHOR.test(title+' '+description);
  const infrastructure=ROAD.test(title)||(!ARCH.test(title)&&ROAD.test(description));
  const generic=AUTHOR.test(title+' '+description)&&!infrastructure;
  const works=/^(?:marche(?: public)? de travaux|travaux|construction|reconstruction|reparation|renovation|refection|pose|installation|terrassements?)\b/.test(title)||cpv.some(x=>/^45/.test(String(x)));
  const mixed=/\b(?:etudes?|conception) (?:et (?:la )?)?(?:realisation|construction|execution)\b/.test(title)&&works;
  const service=/\b(?:marches? de services?|mission|etudes?|leves?|releves?|mesurages?|geometre|bornage|vectorisation|certificat|certification|jaugeages?|photogrammetrie|auscultation|monitoring)\b/.test(title)||cpv.some(x=>/^71/.test(String(x)));
  const little=(c.sectors||[]).includes('PetitsTravaux');
  const result={...c,sectors:[...(c.sectors||[c.sector])]};
  if(generic){
   result.sectors=result.sectors.filter(s=>s!=='VRD');
   if(!result.sectors.length)result.sectors=['Qualif'];
   result.sector=result.sectors.includes(result.sector)?result.sector:result.sectors[0];
  }
  const kind=local?'prospect':mixed?'mixed':works?'works':service?'services':'unknown';
  let route='scope',explanation='Indices métier à confronter aux prestations exactes du dossier.';
  if(local){route='local_signal';explanation='Signal communal à valider : ni marché ouvert ni prestation commandée confirmés.'}
  else if(works&&!little){route='ancillary';explanation='Marché de travaux ou contrat mixte : la prestation KDRIX peut être accessoire. Vérifier un lot distinct ou une intervention en sous-traitance.'}
  else if(architecture){route='partner';explanation='Mission architecturale globale : vérifier la place exacte des prestations KDRIX et le besoin d’un partenaire. Ce titre ne prouve pas une mission de voirie.'}
  else if(generic){explanation='Mission globale insuffisamment décrite : aucun objet de voirie ou hydraulique identifié pour justifier un classement VRD.'}
  else if(little){route='small_works';explanation='Petits travaux techniques liés aux mesures : vérifier l’ampleur, les qualifications et les moyens nécessaires.'}
  else if(c.screening==='main'&&kind==='services'){route='service';explanation='Prestation métier repérée dans l’objet. Les conditions de participation et les moyens KDRIX restent à vérifier.'}
  if(generic||architecture||(works&&!little)){
   result.screening='review';result.score=Math.min(result.score,works?60:55);
   result.matchReason=works?'prestation_dans_marche_de_travaux':architecture?'mission_architecturale_a_qualifier':'mission_globale_a_qualifier';
  }
  result.qualification={version:'2026-10-29',kind,route,explanation,capacityStatus:'not_assessed'};
  return result;
 }
 const kinds={services:'Services',works:'Travaux',mixed:'Conception et exécution',prospect:'Signal de prospection',unknown:'Nature à confirmer'};
 const routes={service:'Prestation métier identifiée',ancillary:'Prestation accessoire à examiner',partner:'Mission globale / partenariat à examiner',scope:'Périmètre à préciser',small_works:'Petits travaux techniques à vérifier',local_signal:'Besoin communal à vérifier'};
 const reasons={formule_administrative_sans_signal_metier:'Formule administrative sans prestation métier identifiable.',travaux_execution:'Travaux d’exécution sans prestation KDRIX identifiable.',objet_hors_domaine:'Objet identifié hors des activités ciblées.',aucun_signal_metier:'Aucun indice métier suffisant dans les informations collectées.',fournitures_et_location:'Fournitures ou location, sans mission technique identifiée.',assurance_ou_nettoyage:'Assurance ou nettoyage.',execution_flandre:'Lieu d’exécution identifié en Flandre.',acheteur_flamand:'Acheteur flamand sans lieu wallon identifié.',avis_neerlandais:'Publication identifiée comme exclusivement néerlandophone.'};
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function render(m,options={}){
  if(m.screening==='excluded')return '<section class="mr-qualification"><strong>'+(options.manualOverride?'Classement manuel conservé':'Correspondance écartée par le filtre')+'</strong><p>'+esc(reasons[m.screeningReason]||'Correspondance non retenue automatiquement. Consulter l’avis avant de la réintégrer.')+'</p><small>'+(options.manualOverride?'Votre décision est prioritaire sur le filtre automatique.':'Ce filtre est distinct de votre classement personnel.')+'</small></section>';
  const q=m.qualification;if(!q)return '<section class="mr-qualification"><strong>Qualification métier à compléter</strong><p>Le score ne valide ni l’admissibilité ni les moyens KDRIX.</p></section>';
  return '<section class="mr-qualification"><strong>'+esc(routes[q.route]||routes.scope)+'</strong><small>'+esc(kinds[q.kind]||kinds.unknown)+'</small><p>'+esc(q.explanation)+'</p><small>Admissibilité et capacité KDRIX : non évaluées. Indice de repérage, sans probabilité de réussite.</small></section>';
 }
 return {enrich,render,kinds,routes};
});
