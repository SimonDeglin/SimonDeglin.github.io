/* Regrouper seulement des passages du même document partageant une référence
   explicite ou le titre exact d'un marché. Aucun rapprochement flou entre avis. */
'use strict';
const fold=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[’‘]/g,"'").replace(/[^a-z0-9]/g,' ').replace(/\s+/g,' ').trim();
function reference(text){
 const matches=[...String(text||'').matchAll(/(?:cahier(?:\s+sp[eé]cial)?\s+des?\s+charges|\bCSC)\s*(?:n[°o.]?\s*)?([12]\d{3}[\s/-]?\d{2,6})/gi)].map(x=>x[1].replace(/\s/g,'').toUpperCase());
 const unique=[...new Set(matches)];return unique.length===1?unique[0]:null;
}
function title(text){
 const m=String(text||'').match(/march[eé]\s*[“«"]([^”»"]{40,550})[”»"]/i);return m?m[1].trim():null;
}
function group(passages){
 const titles=new Map();
 for(const p of passages){const t=title(p.excerpt),r=reference(p.excerpt);if(t&&r){const k=fold(t);if(!titles.has(k))titles.set(k,new Set());titles.get(k).add(r)}}
 const out=[],groups=new Map();
 for(const p of passages){
  let ref=reference(p.excerpt);const normalized=fold(p.excerpt);
  if(!ref){const found=new Set();for(const [t,refs] of titles)if(normalized.includes(t))for(const r of refs)found.add(r);if(found.size===1)ref=[...found][0]}
  const t=title(p.excerpt),key=ref?'reference:'+ref:t?'title:'+fold(t):p.sectionHeading?'section:'+fold(p.sectionHeading):'excerpt:'+normalized;
  const prior=groups.get(key);
  if(prior){if(prior.relatedPassages.length<6&&!prior.relatedPassages.some(x=>x.page===p.page&&x.excerpt===p.excerpt))prior.relatedPassages.push({page:p.page,excerpt:p.excerpt});continue}
  const entry={...p,explicitReference:ref,relatedPassages:[{page:p.page,excerpt:p.excerpt}]};groups.set(key,entry);out.push(entry);
 }
 return out;
}
module.exports={group,reference,title};
