/* Une mention métier dans un considérant ne prouve pas un besoin à prospecter. */
'use strict';
const fold=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[’‘]/g,"'").toLowerCase();
// Preuve cherchée dans le texte : action de commande et prestation technique proches.
function needEvidence(text){
 const paragraphs=String(text||'').normalize('NFC').split(/\n|\f/).map(s=>s.replace(/\s+/g,' ').trim()).filter(Boolean);
 const technical='(?:g[eé]om[eè]tre|topograph|bornage|mesurage|arpentage|bathym[eé]tr|hydrauli|hydrolog|auteur de projet|bureau d.[eé]tudes|[eé]tudes? (?:de |d.)?(?:voirie|mobilit[eé]|am[eé]nagement|conception)|certific\w* PEB|relev[eé]s? (?:de terrain|3D|de b[aâ]timent)|scanner laser|photogramm[eé]tr|implantation|[eé]valuation immobili[eè]re)';

 const requests=[new RegExp('(?:d[eé]cide(?:r)?|approuve(?:r)?|propose(?:r)?|lance(?:r)?|convient de).{0,160}(?:march[eé](?: public)? de services|bureau d.[eé]tudes|prestataire externe|mission d.[eé]tudes|consultation de (?:bureaux|prestataires))','i'),new RegExp('(?:d[eé]cide(?:r)?|approuve(?:r)?|propose(?:r)?|lance(?:r)?).{0,120}(?:mission|march[eé](?: public)? de services|consultation|d[eé]signation|faire appel|faire r[eé]aliser|recourir|consulter|d[eé]signer|[eé]tude).{0,180}'+technical,'i'),new RegExp('(?:consulter|d[eé]signer|recourir|faire appel).{0,180}'+technical,'i'),new RegExp('objet (?:du|de ce) march[eé].{0,160}'+technical,'i'),new RegExp('(?:prestataire|bureau).{0,60}(?:sera charg[eé]|aura pour mission|devra r[eé]aliser).{0,180}'+technical,'i')];
 for(let i=0;i<paragraphs.length;i++){
  if(/^(?:Vu |En vertu de |Conform[eé]ment [aà] (?:la loi|l.article)|Consid[eé]rant (?:la loi|l.arr[eê]t[eé]))/i.test(paragraphs[i]))continue;
  const raw=paragraphs.slice(i,i+3).join(' ').replace(/^D[eé]cide\s*:\s*(?:[aà] l.unanimit[eé],?\s*)?/i,'');
  if(/aucun(?:e)? (?:besoin|mission)|n.est pas (?:pr[eé]vu|envisag[eé])|ne.{0,35}pas (?:recourir|consulter|d[eé]signer|lancer|passer|confier|r[eé]aliser)|projet abandonn[eé]/i.test(raw))continue;
  for(const pattern of requests){const m=pattern.exec(raw);if(m&&!/l.(?:entrepreneur|adjudicataire).{0,45}(?:devra|doit|sera tenu).{0,100}(?:d[eé]signer|faire appel|recourir)/i.test(raw))return {excerpt:raw.slice(Math.max(0,m.index-70),Math.min(raw.length,m.index+m[0].length+180)),mission:(raw.slice(m.index,m.index+m[0].length)+raw.slice(m.index+m[0].length).split(/(?<=[.;])\s+(?=[A-ZÀ-ÖØ-Þ])/)[0]).slice(0,260),basis:'document_body'};}
 }
 return null;
}

function assess({title='',text='',kind='prospection'}={}){
 const t=fold(title),body=fold(text),need=needEvidence(text);
 if(need&&!/avenant|prestations complementaires|decompte|honoraires supplementaires/.test(t))return {eligible:true,reason:kind==='award'?'attribution_de_services_pour_la_veille':'mission_explicitement_demandee_dans_le_document',...need};
 if(/^approbation (?:d.un |du )?plan de (?:bornage|mesurage)/.test(t))return {eligible:false,reason:'plan_deja_etabli_sans_nouvelle_mission'};
 if(/transfert du domaine|acte d.acquisition|acte authentique|offre recue|commodat|declassement|reglement|roulage|circulation routiere|incorporation|prise en gestion|demande de retrait|permis d.urbanisme|modification de la voirie/.test(t))return {eligible:false,reason:'acte_administratif_sans_mission_a_commander'};
 const service=(/marche(?: public)? de services?/.test(t)&&/etude|auteur|conception|geometre|ingenierie|topograph|peb|honoraires/.test(t))||/schema de developpement.{0,30}(?:communal|elaboration)|plan communal de mobilite|designation.{0,80}(?:geometre|bureau|auteur de projet)|marche.{0,30}services.{0,120}(?:etude|geometre|topograph|auteur|peb)|mission.{0,80}(?:etude|geometre|auteur de projet)|etude.{0,60}(?:hydrauli|voirie|mobilite)|leve.{0,20}topograph|certificat.{0,15}peb|bathymetr/.test(t);
 if(/avenant|prestations complementaires|decompte|honoraires supplementaires/.test(t))return {eligible:false,reason:'mission_existante_avenant_ou_decompte'};
 if(/marche.{0,25}(?:travaux|fournitures)|travaux.{0,80}(?:mode de passation|cahier|approbation)|materiel pour amenagement/.test(t)&&!service)return {eligible:false,reason:'execution_ou_fournitures_sans_mission_etudes'};
 if(kind==='award'&&service)return {eligible:true,reason:'attribution_de_services_pour_la_veille'};
 if(service)return {eligible:true,reason:'mission_de_services_explicitement_annoncee'};
 const assigned=/attribution.{0,100}(?:geometre|bureau d.etudes)|plan.{0,130}(?:dresse|etabli|realise).{0,130}(?:bureau|geometre)|projet de plan de mesurage realise|auteur de projet.{0,80}(?:designe|attribue)|etabli.{0,45}par l.auteur de projet/.test(body);
 if(assigned)return {eligible:false,reason:'mission_deja_confiee_ou_realisee'};
 const land=/(?:vente|acquisition|division|bornage).{0,100}(?:parcelle|terrain|geometre)|(?:parcelle|terrain).{0,80}(?:mise en vente|acquisition)/.test(t);
 if(land)return {eligible:true,reason:'operation_fonciere_a_verifier_sans_mission_confirmee'};
 return {eligible:false,reason:'aucune_nouvelle_mission_metier_etablie'};
}
module.exports={assess,needEvidence};
