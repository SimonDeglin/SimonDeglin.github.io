/* Une mention métier dans un considérant ne prouve pas un besoin à prospecter. */
'use strict';
const fold=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[’‘]/g,"'").toLowerCase();
function assess({title='',text='',kind='prospection'}={}){
 const t=fold(title),body=fold(text);
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
module.exports={assess};
