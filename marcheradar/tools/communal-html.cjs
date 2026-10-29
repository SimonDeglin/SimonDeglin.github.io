/* Adaptateur public Délibérations.be : mêmes requêtes GET que l'interface. */
'use strict';
const dates=require('../document-dates.js'),policy=require('./communal-source-policy.cjs');
const business=/topograph|g[eé]om[eè]tr|bornage|parcell|bathy|hydrauli|bureau.{0,12}[eé]tudes|auteur.{0,10}projet|voirie|imp[eé]trant|[eé]tudes?|PEB|acquisition.{0,25}terrain|vente.{0,25}terrain|march[eé].{0,20}services|am[eé]nagement/i;
function decode(s){return String(s||'').replace(/&amp;/g,'&').replace(/&nbsp;|&#160;/g,' ').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Math.min(Number(n),0x10ffff)));}
const plain=s=>decode(String(s||'').replace(/<[^>]+>/g,' ')).replace(/\s+/g,' ').trim();
function core(html){
 const m=String(html).match(/<(div|main|article)\b[^>]*\bid=["'](?:content-core|content|main-content)["'][^>]*>/i);if(!m)return '';
 const from=m.index+m[0].length,rx=new RegExp('</?'+m[1]+'\\b[^>]*>','gi');rx.lastIndex=from;let depth=1,t;
 while((t=rx.exec(html))){depth+=t[0][1]==='/'?-1:1;if(!depth)return html.slice(from,t.index)}return '';
}
function links(html,base,now,context={}){
 let u;try{u=new URL(base)}catch(e){return []}if(!/^(?:www\.)?deliberations\.be$/.test(u.hostname))return [];
 const out=[],select=String(html).match(/<select\b[^>]*name=["']seance["'][^>]*>([\s\S]*?)<\/select>/i);
 if(select){
  const root=u.origin+u.pathname.replace(/\/$/,'')+'/';
  for(const o of select[1].matchAll(/<option\b[^>]*value=["']([a-f0-9]{32})["'][^>]*>([\s\S]*?)<\/option>/gi)){
   const label=plain(o[2]),d=dates.extract({title:label,url:base}),p=d.document;if(!p||p.date<dates.cutoff(now))continue;
   out.push({url:root+'@@faceted_query?seance='+o[1]+'&b_start=0',title:'Décisions du '+label,sessionProof:{...p,kind:'session',confidence:'explicit',source:'html_text',sourceUrl:base,excerpt:'Date de la séance : '+label},depth:1});
  }
 }
 if(u.pathname.endsWith('/@@faceted_query')){
  // Les liens remplissant les cartes sont vides : le titre est un h3 voisin.
  for(const card of String(html).split(/(?=<div\b[^>]*class=["']item-card\b)/i)){
   if(!/^<div\b[^>]*class=["']item-card\b/i.test(card))continue;
   const href=(card.match(/<a\b[^>]*href=["']([^"']+)["']/i)||[])[1],title=plain((card.match(/<h3\b[^>]*class=["']card-title["'][^>]*>([\s\S]*?)<\/h3>/i)||[])[1]);
   if(!href||!business.test(title))continue;let link;try{link=new URL(decode(href),base)}catch(e){continue}
   if(link.origin===u.origin&&link.pathname.startsWith(u.pathname.replace(/@@faceted_query$/,''))&&!policy.excluded({url:link.href,title}))out.push({url:link.href,title,sessionProof:context.sessionProof,depth:(context.depth||1)+1});
  }
  for(const a of String(html).matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)){
   let link;try{link=new URL(decode(a[1]),base)}catch(e){continue}const title=plain(a[2]);
   if(link.origin!==u.origin||!link.pathname.startsWith(u.pathname.replace(/@@faceted_query$/,'')))continue;
   if(link.pathname.endsWith('/@@faceted_query')){if(!/suivants?/i.test(title)||!link.searchParams.get('seance'))continue;out.push({url:link.href,title:'Suite des décisions de la séance',sessionProof:context.sessionProof,depth:context.depth||1});continue;}
   if(business.test(title)&&!policy.excluded({url:link.href,title}))out.push({url:link.href,title,sessionProof:context.sessionProof,depth:(context.depth||1)+1});
  }
 }
 return out;
}
function read(html,url,context={}){
 const title=plain((String(html).match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)||[])[1]||'');
 let body=core(html);if(!body)return null;
 body=body.replace(/<(script|style|nav)\b[^>]*>[\s\S]*?<\/\1>/gi,'').replace(/<\/(?:p|div|li|h[1-6]|dd|dt|tr)>|<br\s*\/?>/gi,'\n');
 const text=decode(body.replace(/<[^>]*>/g,' ')).split('\n').map(s=>s.replace(/\s+/g,' ').trim()).filter(Boolean).join('\n');
 const platform=/^https:\/\/(?:www\.)?deliberations\.be\/[^/]+\/decisions\/[^/]+\/[^/]+/.test(url)&&!url.includes('@@');
 const doc=/ordre.{0,12}jour|proc[eè]s.verbal|compte.rendu|avis.{0,12}march[eé]|appel.d.offres/i.test(title);
 if(!platform&&!doc)return null;
 const result=dates.extract({text,title,url});
 if(platform&&context.sessionProof)result.session={...context.sessionProof};
 // Le contenu est HTML : aucun numéro de page PDF n'est attribué.
 for(const p of [result.session,result.document])if(p&&p.confidence==='explicit'){p.source='html_text';p.page=null;}
 return {text:title+'\n'+text,title,dates:result,platform,project:/projet de d[eé]cision/i.test(text.slice(0,1000))};
}
module.exports={links,read,core,plain,business};
