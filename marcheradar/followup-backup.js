/* Sauvegarde locale du suivi Marché Radar. Aucun appel réseau. */
(function(root,factory){
 'use strict';
 var api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.MRBackup=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 var FORMAT='kdrix.marcheRadar.followup',VERSION=1,MAX_BYTES=5*1024*1024;
 var MAPS=['statuses','notes','favorites','hiddenSectors'];
 var STAGES=['inbox','maybe','answer','await','won','lost','discarded','irrelevant'];
 var OLD={'À analyser':'maybe','Intéressant':'maybe','Offre en préparation':'answer','Offre déposée':'await','Attribué':'won','Écarté':'discarded','Hors sujet':'irrelevant','':'inbox'};
 function own(o,k){return Object.prototype.hasOwnProperty.call(o,k)}
 function record(x){return !!x&&typeof x==='object'&&!Array.isArray(x)&&(Object.getPrototypeOf(x)===Object.prototype||Object.getPrototypeOf(x)===null)}
 function normalizeState(raw){
  if(!record(raw))throw Error('Le suivi doit être un objet JSON.');
  var out={};
  MAPS.forEach(function(map){
   if(!record(raw[map]))throw Error('Rubrique absente ou invalide : '+map+'.');
   out[map]={};
   Object.keys(raw[map]).forEach(function(key){
    if(!key||key.length>500||['__proto__','prototype','constructor'].includes(key))throw Error('Identifiant de suivi invalide.');
    var value=raw[map][key];
    if(map==='statuses'){
     if(typeof value!=='string')throw Error('Classement invalide.');
     if(own(OLD,value))value=OLD[value];
     if(!STAGES.includes(value))throw Error('Classement inconnu : '+value+'.');
    }else if(map==='notes'){
     if(typeof value!=='string'||value.length>100000)throw Error('Note invalide ou trop longue.');
    }else if(typeof value!=='boolean')throw Error('Préférence invalide : '+map+'.');
    out[map][key]=value;
   });
  });
  return out;
 }
 function create(state,createdAt){return {format:FORMAT,version:VERSION,createdAt:createdAt||new Date().toISOString(),state:normalizeState(state)}}
 function serialize(state,createdAt){
  var text=JSON.stringify(create(state,createdAt),null,2);
  if(new TextEncoder().encode(text).length>MAX_BYTES)throw Error('Sauvegarde supérieure à 5 Mo.');
  return text;
 }
 function parse(text){
  if(typeof text!=='string'||new TextEncoder().encode(text).length>MAX_BYTES)throw Error('Fichier invalide ou supérieur à 5 Mo.');
  var value;try{value=JSON.parse(text.replace(/^\uFEFF/,''))}catch(e){throw Error('Le fichier ne contient pas un JSON valide.');}
  if(!record(value)||value.format!==FORMAT||value.version!==VERSION)throw Error('Format de sauvegarde Marché Radar non reconnu.');
  if(typeof value.createdAt!=='string'||!Number.isFinite(Date.parse(value.createdAt)))throw Error('Date de sauvegarde invalide.');
  return {format:FORMAT,version:VERSION,createdAt:value.createdAt,state:normalizeState(value.state)};
 }
 function summary(state){
  var s=normalizeState(state),ids=new Set();
  ['statuses','notes','favorites'].forEach(function(k){Object.keys(s[k]).forEach(function(id){ids.add(id)})});
  return {markets:ids.size,classified:Object.values(s.statuses).filter(function(x){return x!=='inbox'}).length,
   notes:Object.values(s.notes).filter(function(x){return x.trim()!==''}).length,
   favorites:Object.values(s.favorites).filter(Boolean).length,preferences:Object.keys(s.hiddenSectors).length};
 }
 function merge(current,incoming,mode){
  if(mode!=='keep'&&mode!=='incoming')throw Error('Choix de restauration invalide.');
  var local=normalizeState(current),other=normalizeState(incoming),out=Object.assign({},current);
  var report={added:0,conflicts:0,identical:0,replaced:0};
  MAPS.forEach(function(map){
   out[map]=Object.assign({},local[map]);
   Object.keys(other[map]).forEach(function(key){
    if(!own(local[map],key)){out[map][key]=other[map][key];report.added++;}
    else if(local[map][key]===other[map][key])report.identical++;
    else {report.conflicts++;if(mode==='incoming'){out[map][key]=other[map][key];report.replaced++;}}
   });
  });
  return {state:out,report:report};
 }
 // setItem est atomique : ne publier l'état en mémoire qu'après son succès.
 // Le snapshot antérieur est enregistré d'abord ; toute erreur interrompt l'import.
 function apply(storage,key,current,incoming,mode){
  var stored=storage.getItem(key);
  if(stored!==null&&JSON.stringify(normalizeState(JSON.parse(stored)))!==JSON.stringify(normalizeState(current)))throw Error('Le suivi a changé dans un autre onglet. Rechargez la page avant de réessayer.');
  var result=merge(current,incoming,mode);
  var before=serialize(current),next=JSON.stringify(result.state);
  storage.setItem(key+'.beforeImport',before);
  storage.setItem(key,next);
  return result;
 }
 return {FORMAT:FORMAT,VERSION:VERSION,MAX_BYTES:MAX_BYTES,normalizeState:normalizeState,create:create,serialize:serialize,parse:parse,summary:summary,merge:merge,apply:apply};
});
