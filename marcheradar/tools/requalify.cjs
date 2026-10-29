/* Requalification seule : ne jamais restaurer une ancienne base ni toucher aux
   identifiants, pièces, échéances ou décisions enregistrées dans le navigateur. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),profile=require('./kdrix-profile.cjs');
function requalify(data){
 if(!Array.isArray(data.items))throw Error('Historique invalide');
 const ids=data.items.map(m=>m.id);if(new Set(ids).size!==ids.length)throw Error('Identifiants dupliqués');
 const changes=[];
 const items=data.items.map(m=>{
  if(m.source==='LOCALE'&&String(m.screeningReason||'').startsWith('verification_locale_'))return m;
  const result=profile.screen(m);let next;
  if(result.classification)next={...m,...result.classification,screeningReason:null};
  else{next={...m,screening:'excluded',screeningReason:result.reason};delete next.qualification;}
  if(JSON.stringify(next)!==JSON.stringify(m))changes.push({id:m.id,before:m.screening,after:next.screening,sector:next.sector,reason:next.matchReason||next.screeningReason});
  return next;
 });
 return {data:{...data,items},changes};
}
if(require.main===module){
 const file=path.resolve(__dirname,'../data.json'),result=requalify(JSON.parse(fs.readFileSync(file,'utf8')));
 if(process.argv.includes('--write'))fs.writeFileSync(file,JSON.stringify(result.data,null,2)+'\n');
 console.log(JSON.stringify({preserved:result.data.items.length,changed:result.changes.length,main:result.data.items.filter(m=>m.screening==='main').length,review:result.data.items.filter(m=>m.screening==='review').length,excluded:result.data.items.filter(m=>m.screening==='excluded').length}));
}
module.exports={requalify};
