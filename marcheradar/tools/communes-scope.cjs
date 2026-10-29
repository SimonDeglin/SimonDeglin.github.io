'use strict';
const {provinces,provinceOf}=require('../source-health.js');
function selection(records,options={}){
 const province=String(options.province??process.env.COMMUNES_PROVINCE??'all').trim()||'all';
 const ins=String(options.ins??process.env.COMMUNES_INS??'').trim();
 if(province!=='all'&&!Object.hasOwn(provinces,province))throw Error('Province inconnue : '+province);
 if(ins&&!/^\d{5}$/.test(ins))throw Error('Le code INS doit comporter cinq chiffres');
 const list=records.filter(c=>(province==='all'||provinceOf(c)===province)&&(!ins||String(c.ins)===ins));
 if(ins&&!list.length)throw Error('Commune absente de la sélection : '+ins);
 return list;
}
module.exports={selection};
