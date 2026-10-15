/* KDRIX MarchéRadar : profil de veille traçable, mis à jour le 15/10/2026.
 * Le dictionnaire (15 sous-domaines, environ 390 expressions) est modifiable
 * indépendamment des collecteurs. Les scores ne sont pas des garanties.
 */
'use strict';
const WORDS=require('./kdrix-keywords.json');
const fold=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
 .replace(/[’‘]/g,"'").replace(/[–—-]/g,' ').replace(/\s+/g,' ').trim();
function subjectOf(s){
 const p=String(s||'').split(/\s+[–—]\s+/);
 return p.length>=3?p.slice(2).join(' – '):String(s||'');
}
function has(s,term){
 const q=fold(term),n=s.indexOf(q);if(q.length<3||n<0)return false;
 return q.length>5||(/[^a-z0-9]/.test(s[n-1]||' ')&&/[^a-z0-9]/.test(s[n+q.length]||' '));
}
const any=(s,arr)=>(arr||[]).some(term=>has(s,term));
function flemishBuyer(buyer){
 return /\bvlaams(?:e)?\b|\bvlaanderen\b|\bflanders\b|\baquafin\b|\bfluvius\b|openbare vlaamse|eigen vermogen digitaal|digitaal vlaanderen|vlaamse waterweg|vlaamse landmaatschappij|agentschap voor innoveren en ondernemen|agentschap wegen en verkeer|agentschap natuur en bos|\bde lijn\b|stad (?:diest|gent|leuven|antwerpen|brugge|hasselt|oostende|kortrijk|roeselare|sint niklaas)|provincie (?:limburg|antwerpen|oost vlaanderen|west vlaanderen|vlaams brabant)/.test(fold(buyer));
}
function dutchOnly(title,description){
 const h=fold(subjectOf(title)),b=fold(String(description||'').slice(0,1600));
 const nl=/\b(?:het|deze|een|voor|opdracht|raamovereenkomst|betreft|van|wordt|volgende|aanbestedende|uitvoeren|uitvoering|studieopdracht|aannemer|werken|werd|overheidsopdracht|opmaak|doelstelling|binnen|waarbij|klanten|uitgevoerd|gemeenten)\b/g;
 const fr=/\b(?:les|des|une|pour|avec|dans|present|marche|relatif|objet|comprend|realisation|etude|cahier|travaux|prestation|lors|notamment|concernant|porte|cadastre)\b/g;
 const n=(b.match(nl)||[]).length,f=(b.match(fr)||[]).length,t=(h.match(/\b(?:raamovereenkomst|opdracht|studie|aanstelling|voor|van|het|een|opmeting|wegenis|ontwerp|onderzoek|onderhoud|uitbreiding|werkwijze)\b/g)||[]).length;
 return (n>=8&&n>=f*2+3)||(t>=3&&n>=6&&n>=f*2+2);
}
function excluded(m){
 if(!m)return 'invalide';
 if(m.region==='Flandre')return 'execution_flandre';
 if(flemishBuyer(m.buyer))return 'acheteur_flamand';
 if(dutchOnly(m.title,m.description))return 'avis_neerlandais';
 if((m.languages||[]).length&&m.languages.every(x=>String(x).toUpperCase()==='NL'))return 'avis_neerlandais';
 return null;
}
const BAD=/\b(?:balayeuses?|vehicules?|camionnettes?|camions?|tracteurs?|ambulances?|assurances?|polices d'assurance|courtages? d'assurance|produits pharmaceutiques|medicaments?|fournitures scolaires|mobilier|chaussures|ordinateurs|serveurs informatiques|logiciels?|services de nettoyages?|produits de nettoyage|curage|dragage|desenvasement|restauration collective|repas scolaires|services bancaires|catering|gardiennage|materiel medical)\b/;
const SUPPLY=/^(?:achat|acquisition|livraison|fourniture|fournitures|location|leasing|approvisionnement)\b/;
const BUILD=/^(?:travaux|construction|reconstruction|reparation|renovation|refection|execution|realisation|reamenagement|amenagement|pose|installation|creation|terrassements?)\b/;
const STUDY=/\b(?:etude|etudes|diagnostic|conception|avant projet|auteur de projet|ingenierie|releve|leve|mesurage|topograph|plans de l'existant|assistance technique|mission de services|marche de services|metre|dimensionnement|inventaire)\b/;
const TECH=/\b(?:bureau d'etudes|prestations intellectuelles|mission de services|mission complete d'etudes|assistance a maitrise d'ouvrage|prestation de geometre)\b/;
function smallTechnicalWork(title,cpv){
 const h=fold(subjectOf(title));
 const special=/limnimetr|station de jaugeage|station de mesure hydrometrique|acces au cours d'eau|petite passerelle|garde corps d'ouvrage|petite construction metallique/;
 const allowed=any(h,WORDS.PetitsTravaux.direct)||special.test(h);
 const work=/travaux|amenagement|acces securise|reparation|passerelle|construction|echelle|escalier|garde corps|balustrade|pose/;
 const studyOnly=/^(?:etude|diagnostic|conception|dimensionnement|mission de services)\b/.test(h)&&!/\btravaux\b/.test(h);
 return !studyOnly&&allowed&&work.test(h)&&((cpv||[]).some(x=>/^45/.test(x))||/travaux|amenagement|passerelle|pose/.test(h));
}
function screen(m){
 if(!m||!m.title)return {reason:'titre_absent',classification:null};
 const ex=excluded(m);if(ex)return {reason:ex,classification:null};
 const title=fold(subjectOf(m.title)),detail=fold(String(m.description||'').slice(0,14000));
 const cpv=Array.isArray(m.cpv)?m.cpv:[];
 const local=m.source==='LOCALE'||m.opportunityType==='prospection';
 const little=smallTechnicalWork(m.title,cpv);
 if(BAD.test(title)&&!little&&!(/\bjaugeag/.test(title)&&/^entretien/.test(title)))return {reason:'objet_hors_domaine',classification:null};
 if(cpv.some(c=>/^665|^909/.test(c)))return {reason:'assurance_ou_nettoyage',classification:null};
 if(SUPPLY.test(title)&&!little&&!STUDY.test(title))return {reason:'fournitures_et_location',classification:null};
 const hasDirectService=Object.entries(WORDS).some(([id,w])=>id!=='_meta'&&id!=='PetitsTravaux'&&any(title,w.direct));
 if((cpv.some(c=>/^45/.test(c))||BUILD.test(title))&&!little&&!STUDY.test(title)&&!hasDirectService&&!local)return {reason:'travaux_execution',classification:null};
 const hits=[];
 for(const [id,words] of Object.entries(WORDS)){
  if(id==='_meta'||id==='PetitsTravaux')continue;
  const ht=any(title,words.direct),hc=any(title,words.context),bd=any(detail,words.direct),bc=any(detail,words.context);
  if(!ht&&!hc&&!bd&&!bc)continue;
  let score=ht?88:hc?66:bd?71:52;
  if(ht&&bd)score+=7;if(ht&&bc)score+=3;
  if(hc&&STUDY.test(title))score+=8;
  if(bc&&TECH.test(detail))score+=6;
  if(!ht&&!bd&&!STUDY.test(title)&&!local)score=Math.min(score,62);
  hits.push({id,score:Math.min(99,score),explicit:ht||bd,head:ht||hc});
 }
 if(little)hits.push({id:'PetitsTravaux',score:99,explicit:true,head:true});
 if(!hits.length){
  const both=title+' '+detail;
  if(local&&/(reamenagement|rehabilitation|transformation|creation|renovation|investissement|programme)/.test(both)&&
    /(voirie|espace public|place communale|cours d'eau|reseau|terrain communal|batiment communal|bassin d'orage)/.test(both))
   return {reason:null,classification:{sector:'VRD',sectors:['VRD'],score:52,screening:'review',matchReason:'projet_communal_indirect'}};
  if(TECH.test(both)&&/(voirie|ouvrage|terrain|reseau|amenagement|infrastructure|patrimoine|eau)/.test(both))
   return {reason:null,classification:{sector:'VRD',sectors:['VRD'],score:49,screening:'review',matchReason:'mission_technique_generique'}};
  return {reason:'aucun_signal_metier',classification:null};
 }
 hits.sort((a,b)=>b.score-a.score);
 const best=hits[0],clear=best.explicit||STUDY.test(title)||TECH.test(title);
 return {reason:null,classification:{sector:best.id,sectors:[...new Set(hits.map(x=>x.id))],score:best.score,
  screening:local?'review':best.score>=75&&clear?'main':'review',
  matchReason:best.explicit?'prestation_decrite':best.head?'projet_indirect':'description_ou_contexte'}};
}
function classify(title,description,cpv){
 return screen({title,description,cpv:cpv||[],buyer:'',region:'Belgique'}).classification;
}
module.exports={fold,subjectOf,flemishBuyer,dutchOnly,excluded,classify,screen,smallTechnicalWork};
