/* Une redirection de page communale ne donne pas accès à un site tiers. */
'use strict';
const policy=require('./communal-source-policy.cjs');
async function fetchPublic(url,options={},fetchFn=fetch){
 let current=url;
 for(let hop=0;hop<6;hop++){
  const r=await fetchFn(current,{...options,redirect:'manual'});
  if([301,302,303,307,308].includes(r.status)){
   const location=r.headers.get('location');if(!location)throw Error('Redirection sans destination');
   const next=new URL(location,current).href;if(!policy.trusted(next,url))throw Error('Redirection externe hors collecte communale');current=next;continue;
  }
  if(r.url&&!policy.trusted(r.url,url))throw Error('Réponse externe hors collecte communale');
  return r;
 }
 throw Error('Trop de redirections');
}
module.exports={fetchPublic};
