/* Rattacher une décision au dossier officiel uniquement sur une référence
   explicite et un acheteur identique. Aucun rapprochement flou de titres. */
'use strict';
const fold=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[’']/g,' ').replace(/\b(?:administration|communale|commune|ville|de|d|du)\b/g,' ').replace(/[^a-z0-9]/g,' ').replace(/\s+/g,' ').trim();
const refs=s=>[...new Set([...String(s||'').matchAll(/\b(20\d{2})[./-](\d{2,6})\b/g)].map(m=>m[1]+'.'+m[2]))];
function insert(items,notice){
 const leading=String(notice.title||'').match(/^(20\d{2}[./]\d{2,6})\b/);const reference=refs(notice.municipalReference||leading?.[1]||notice.title);if(reference.length!==1)return {items:[...items,notice],linked:false};
 const targets=items.filter(m=>['TED','BOSA'].includes(m.source)&&fold(m.buyer)===fold(notice.buyer)&&refs([m.internalReference,m.bdaReference,m.title].join(' ')).includes(reference[0]));
 if(targets.length!==1)return {items:[...items,notice],linked:false};
 const target=targets[0];return {items:items.map(m=>m.id!==target.id?m:{...m,municipalNotices:[...(m.municipalNotices||[]).filter(n=>n.sourceDocument!==notice.sourceDocument),notice]}),linked:true};
}
module.exports={insert};
