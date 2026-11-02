'use strict';
const fold=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
function excluded(source){
 const text=fold((source.title||'')+' '+(source.url||''));
 // Un intitulé de point/PDF ne sert pas de filtre métier : lire son contenu.
 const document=source.documentCandidate||/\.pdf(?:$|[?#])|deliberations\.be\/[^/]+\/decisions\/[^/]+\/[^/?]+/.test(source.url||'')&&!String(source.url).includes('@@');
 if(document&&!/\.(?:png|jpe?g|gif|svg|mp4|mp3|docx?)(?:$|[?#])|youtube|youtu\.be|facebook|instagram|sendto_form|sendtomanager|@@images/.test(text))return null;
 if(/conseil.{0,35}(?:des[ /_-]+enfants|des[ /_-]+jeunes|consultatif)|interpellation[ /_-]+citoyenne|demande.{0,15}interpellation/.test(text))return 'instance_ou_demande_hors_collecte';
 if(/sendtomanager|sendto_form|print_view|@@images|\.(?:jpe?g|png|docx?)(?:$|[?#])|(?:^|[\/_-])(?:composition|membres)(?:[\/_-]|$)|youtube|youtu\.be|facebook|instagram|videos?[-_/ ]|competences[-_ ]scabinales|declaration[-_ ]de[-_ ]politique|confidentialit|protection.des.donnees|reglement.{0,15}(?:police|interieur)|roi[-_ ]conseil|elections?|imperiali/.test(text))return 'navigation_ou_reglement_hors_collecte';
 if(/plan[-_ ]strategique|pst[-_ ]20/.test(text)&&!/(?:etude|services?|auteur|geometre|cahier|mode[-_ ]de[-_ ]passation)/.test(text))return 'programme_general_sans_publication_de_mission';
 return null;
}
function trusted(url,base){
 try{const a=new URL(url),b=new URL(base),host=x=>x.hostname.toLowerCase().replace(/^www\./,'');return /^https?:$/.test(a.protocol)&&(host(a)===host(b)||host(a).endsWith('.'+host(b))||host(a)==='deliberations.be'||host(a).endsWith('.deliberations.be'))}catch(e){return false}
}
module.exports={excluded,trusted};
