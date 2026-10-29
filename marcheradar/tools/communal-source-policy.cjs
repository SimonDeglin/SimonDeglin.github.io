'use strict';
const fold=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
function excluded(source){
 const text=fold((source.title||'')+' '+(source.url||''));
 if(/conseil.{0,35}(?:des[ /_-]+enfants|des[ /_-]+jeunes|consultatif)|interpellation[ /_-]+citoyenne|demande.{0,15}interpellation/.test(text))return 'instance_ou_demande_hors_collecte';
 return null;
}
function trusted(url,base){
 try{const a=new URL(url),b=new URL(base),host=x=>x.hostname.toLowerCase().replace(/^www\./,'');return /^https?:$/.test(a.protocol)&&(host(a)===host(b)||host(a).endsWith('.'+host(b))||host(a)==='deliberations.be'||host(a).endsWith('.deliberations.be'))}catch(e){return false}
}
module.exports={excluded,trusted};
