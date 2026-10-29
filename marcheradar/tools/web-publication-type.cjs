/* Le type communal est un repérage sourcé, pas une validation de procédure ouverte. */
'use strict';
const fold=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[’‘]/g,"'").toLowerCase();
function classify(title,text,excerpt){
 const body=String(excerpt||text||''),f=fold(body),heading=fold(title);
 if(/ordre du jour|odre du jour|\bodj\b|projet de deliberation|projet d'attribution/.test(heading))return {kind:'prospection',reason:'ordre_du_jour_ou_projet_non_adopte',excerpt:body.slice(0,220).replace(/\s+/g,' ').trim()};
 let kind='prospection',reason='besoin_ou_decision_a_verifier',match;
 const withdrawn=/\b(?:sans suite|infructueux|annule|annulation|renonce|retrait de l'attribution)\b/.exec(f);
 if(withdrawn){kind='other';reason='suite_de_procedure_a_verifier';match=withdrawn;}
 else{
  const award=/avis d'attribution|(?:decide|decision).{0,45}d'attribuer|marche.{0,45}(?:est|a ete) attribue/.exec(f);
  if(award){kind='award';reason='attribution_explicitement_mentionnee';match=award;}
  else if(/avis de marche|appel d'offres|invitation a remettre (?:une|offre)/.test(heading)){
   const competition=/date limite|depot des offres|remise des offres|les offres doivent|soumission/.exec(fold(String(text||body)));
   if(competition){kind='competition';reason='avis_et_modalites_de_remise_reperes';const original=String(text||body);return {kind,reason,excerpt:original.slice(Math.max(0,competition.index-40),competition.index+200).replace(/\s+/g,' ').trim()};}
  }
 }
 return {kind,reason,excerpt:match?body.slice(Math.max(0,match.index-40),match.index+220).replace(/\s+/g,' ').trim():body.slice(0,220).replace(/\s+/g,' ').trim()};
}
module.exports={classify};
