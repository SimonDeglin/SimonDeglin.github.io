/* MarchéRadar KDRIX : filtrer selon les prestations réelles, non les mots isolés.
   Les avis à pertinence indirecte passent en "review", consultables séparément. */
'use strict';
const fold=v=>String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[’‘]/g,"'").replace(/\s+/g,' ').trim();
function subjectOf(title){const p=String(title||'').split(/\s+[–—]\s+/);return p.length>=3?p.slice(2).join(' – ').trim():String(title||'').trim()}
function flemishBuyer(buyer){
 const s=fold(buyer);
 return /\bvlaams(?:e)?\b|\bvlaanderen\b|\bflanders\b|\baquafin\b|\bfluvius\b|openbare vlaamse|eigen vermogen digitaal|digitaal vlaanderen|vlaamse waterweg|vlaamse landmaatschappij|agentschap wegen en verkeer|agentschap natuur en bos|\bde lijn\b|stad (?:gent|leuven|antwerpen|brugge|hasselt|oostende|kortrijk|roeselare|sint-niklaas)|provincie (?:limburg|antwerpen|oost-vlaanderen|west-vlaanderen|vlaams-brabant)/.test(s);
}
function dutchOnly(title,desc){
 const head=fold(subjectOf(title)),body=fold(String(desc||'').slice(0,1700));
 const nl=/\b(?:het|deze|een|voor|opdracht|raamovereenkomst|betreft|van|wordt|volgende|aanbestedende|uitvoeren|uitvoering|studieopdracht|aannemer|werken|werd|overheidsopdracht|opmaak|doelstelling|binnen|waarbij|klanten|uitgevoerd|gemeenten)\b/g;
 const fr=/\b(?:les|des|une|pour|avec|dans|present|marche|relatif|objet|comprend|realisation|etude|cahier|travaux|prestation|lors|notamment|concernant|porte|cadastre)\b/g;
 const n=(body.match(nl)||[]).length,f=(body.match(fr)||[]).length,tn=(head.match(/\b(?:raamovereenkomst|opdracht|studie|aanstelling|voor|van|het|een|opmeting|wegenis|ontwerp|onderzoek|onderhoud|uitbreiding|werkwijze)\b/g)||[]).length,tf=(head.match(fr)||[]).length;
 return n>=8&&n>=2*f+3&&tf===0||tn>=3&&n>=6&&n>=2*f+2;
}
function excluded(m){
 if(!m)return 'invalid';
 if(m.region==='Flandre')return 'lieu_flandre';
 if(flemishBuyer(m.buyer))return 'acheteur_flamand';
 if(dutchOnly(m.title,m.description))return 'avis_neerlandais';
 return null;
}
const SIGNALS={
 Topo:/(?:topograph|topometr|landmeet|landmeter|geometre|geodes|arpentage|mesurage (?:de |des )?terrains?|leve(?:s)? (?:topographique|planimetrique|altimetrique)|releve(?:s)? (?:topographique|terrain)|quantity survey|releve(?:s)? (?:de |des )?profils? en travers)/,
 Scan:/(?:scanner.{0,15}3d|scan.{0,15}laser|laser.{0,15}3d|nuage de points|releve(?:s)? (?:au )?laser|3d scanning|lidar terrestre)/,
 Drone:/(?:drone|photogrammetr|orthophot|lidar aerien|prises? de vues aeriennes?|uav surveys?)/,
 Hydro:/(?:bathymetr|hydrograph|sonar|leve(?:s)? (?:de |des )?cours d.eau|releve(?:s)? (?:de |des )?cours d.eau|releve(?:s)? (?:du fond|sous.marin|subaquatique)|mesures? bathymetriques?)/,
 VRD:/(?:(?:etude|conception|auteur de projet|maitrise d.oeuvre|mission d.ingenierie|etudes? techniques?).{0,110}(?:voirie|chaussees|amenagement routier|route|vrd|infrastructure routiere)|(?:voirie|chaussees|route|amenagement routier|vrd|infrastructure routiere).{0,110}(?:etude|conception|auteur de projet|mission de services|maitrise d.oeuvre))/,
 Reseaux:/(?:releve(?:s)? (?:de |des |d.)?(?:reseaux|canalisations|egouts|ouvrages d.egouttage)|cadastre (?:des )?reseaux|cartograph(?:ie|ier) (?:des )?reseaux|georeferen(?:cement|cer) (?:des )?reseaux|detection (?:des )?reseaux|localisation (?:des )?impetrants|plans? (?:de |des )?reseaux enterres|vectorisation des plans (?:des )?reseaux)/,
 Hydraulique:/(?:jaugeag|modele hydraulique|modelisation hydraulique|etude hydraulique|etude hydrologique|etude hydrometrique|mesure (?:de |des )?debits?|etude (?:de |des )?cours d.eau|profils? hydrauliques?|etude (?:des )?inondations?)/,
 Foncier:/(?:bornage|division parcellaire|plans? de division|mesurage cadastral|plans? cadastraux|expert(?:ise)? de parcelles?|limites? de proprietes?|releve foncier|etudes? foncieres?|missions? de geometre)/,
 Implant:/(?:implantation topographique|implantation (?:de |des )?(?:batiments|ouvrages|axes|voiries)|piquetage topographique|recolement (?:topographique|de voiries)|plans? as.built (?:topographiques?|de voirie|des reseaux))/,
 Expert:/(?:expertise immobiliere|expertise judiciaire|expertises? (?:foncieres?|de terrains?|de batiments)|evaluations? immobilieres?|estimations? (?:immobilieres?|de terrains?|foncieres?)|valeur venale|valeur locative|expropriation immobiliere)/,
 PEB:/(?:certificats? (?:de )?performance energetique|certification energetique (?:des )?(?:batiments|logements|habitations)|certificateurs? peb|\bpeb\b|diagnostics? de performance energetique (?:des )?batiments)/,
 Carto:/(?:systeme d.information geographique|geographique.*(?:sig|gis)|\bgis\b|\bsig\b|georeferencement|vectorisation (?:de |des )?plans?|cartographie (?:numerique|des reseaux|topographique|geographique)|geodonnees|orthophotoplan|cadastre geospatial)/,
 PetitsTravaux:/(?:stations? limnimetriques?|amenagements? (?:ponctuels?|techniques?)?.{0,40}acces.{0,25}(?:cours d.eau|station)|travaux?.{0,60}stations? (?:de mesure|de jaugeage))/
};
const CPV={
 Topo:['71351810','71351800','71353000','71355000','71354300','71352000'],
 Hydro:['71353100','71354500','71354400'],Scan:['71353000'],
 Reseaux:['71354300','71354100'],Foncier:['71355000','71354300'],
 Carto:['71354100'],VRD:['71311210','71322000','71322100','71322200'],
 Hydraulique:['71351920','71351400'],PEB:['71314300','71314200']
};
function classify(title,description,cpvs){
 const subject=fold(subjectOf(title)),desc=fold(String(description||'').slice(0,2500)),cpv=Array.isArray(cpvs)?cpvs:[];
 if(!subject)return null;
 const isSmallWorks=SIGNALS.PetitsTravaux.test(subject)&&
   (/(travaux|amenagement|acces securise|reparation|construction)/.test(subject)||cpv.some(c=>/^45/.test(c)));
 const forbidden=/(?:achat|acquisition|fourniture|livraison|leasing|location|approvisionnement|assuranc|vehicules?|balayeuses?|camion(?:nettes?)?|tracteurs?|pelles? mecaniques?|nettoyage|debouchage|curage|dragage|desenvas|transport|evacuation|enlevement|entretien|depannage|maintenance|reparations? (?:de machines|des installations)|services? bancaires?|credit|financement|pharmac|recrutement|assessment center|cybersecurite|developpement (?:de )?logiciel|fouille archeologique|desamiantage|exploitation de parkings?)/;
 const gauge=/jaugeag|mesure (?:de |des )?debits?/.test(subject)&&!/curage|dragage|desenvas/.test(subject);
 if(forbidden.test(subject)&&!isSmallWorks&&!gauge)return null;
 if(cpv.length&&cpv.every(c=>/^(0\d|[1-4]\d)/.test(c))&&!isSmallWorks)return null;
 if(cpv.some(c=>/^665|^909/.test(c)))return null;
 if(cpv.some(c=>/^45/.test(c))&&!isSmallWorks)return null;
 const found=[];
 for(const [id,pattern] of Object.entries(SIGNALS)){
  if(id==='PetitsTravaux'&&!isSmallWorks)continue;
  const a=pattern.test(subject),b=pattern.test(desc);
  if(a||b)found.push({id,titleHit:a,descHit:b});
 }
 if(isSmallWorks&&!found.some(x=>x.id==='PetitsTravaux'))found.push({id:'PetitsTravaux',titleHit:true,descHit:false});
 if(!found.length)return null;
 const ranked=found.map(x=>{
  let score=x.titleHit?77:55;
  if(x.titleHit&&x.descHit)score+=6;
  if((CPV[x.id]||[]).some(c=>cpv.includes(c)))score+=12;
  if(x.id==='PetitsTravaux')score=Math.max(95,score);
  return {...x,score:Math.min(score,99)};
 }).sort((a,b)=>b.score-a.score);
 return {sector:ranked[0].id,sectors:ranked.map(x=>x.id),score:ranked[0].score,screening:ranked[0].titleHit?'main':'review'};
}
function screen(m){
 const why=excluded(m);
 if(why)return {reason:why,classification:null};
 const classification=classify(m.title,m.description,m.cpv||[]);
 return classification?{reason:null,classification}:{reason:'hors_metier',classification:null};
}
module.exports={fold,subjectOf,flemishBuyer,dutchOnly,excluded,classify,screen};
