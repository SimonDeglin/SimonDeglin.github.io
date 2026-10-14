'use strict';
const assert=require('node:assert/strict');
const {txt,classify,normalize,combine,codes,earliestDate}=require('./collect-ted.cjs');

const multi=classify('Levés topographiques et bathymétriques','Relevé des profils de cours d’eau', ['71353100']);
assert.ok(multi&&multi.sectors.includes('Topo')&&multi.sectors.includes('Hydro'),'Un marché doit pouvoir relever de plusieurs métiers');
assert.equal(classify('Achat de matériel scolaire','Fourniture de cahiers et stylos',[]),null,'Écarter les marchés sans signal métier');
assert.equal(classify('Médicaments divers','Perceel 1: médicaments ; Perceel 2: denosumab',['33690000']),null,'Perceel signifie lot, pas parcelle cadastrale');
assert.equal(txt({nld:['Nederlandse titel'],fra:['Titre français']}),'Titre français');
assert.deepEqual(codes(['71353100','71353100','71355000']),['71353100','71355000']);
assert.equal(earliestDate(['2026-11-20','2026-11-08']), '2026-11-08');

const raw={
 'publication-number':'123456-2026',
 'notice-title':{fra:['Levés topographiques et bathymétriques'],nld:['Topografische opmetingen']},
 'buyer-name':{fra:['Commune d’exemple']},
 'classification-cpv':['71353100'],
 'notice-type':'cn-standard',
 'publication-date':'2026-10-14+02:00',
 'deadline-receipt-tender-date-lot':['2026-11-05+01:00'],
 'description-proc':{fra:['Étude topographique des ouvrages hydrauliques']},
 'procedure-identifier':'procedure-identifiant-stable'
};
const notice=normalize(raw);
assert.ok(notice,'Un avis pertinent doit être retenu');
assert.equal(notice.id,'ted:123456-2026');
assert.equal(notice.buyer,'Commune d’exemple');
assert.equal(notice.deadline,'2026-11-05');
assert.equal(notice.region,'Belgique');
assert.deepEqual(notice.sectors.includes('Topo'),true);
assert.equal(normalize({...raw,'notice-type':'can-standard'}),null,'Ne pas confondre les attributions et les nouveaux marchés');
assert.equal(normalize({...raw,'notice-title':{fra:['Acquisition de cahiers']},'classification-cpv':[],'description-proc':{fra:['Fournitures']} }),null);

const seed={id:'ted:111-2026',publicationNumber:'111-2026',relatedNoticeNumbers:['222-2026'],
 title:'Relevé topographique',sector:'Topo',sectors:['Topo'],score:80,
 publication:'2026-07-01',deadline:'2026-09-01',source:'TED'};
const replacement={id:'ted:222-2026',publicationNumber:'222-2026',procedureIdentifier:'test',
 title:'Relevé topographique — rectificatif',sector:'Hydro',sectors:['Hydro'],
 score:89,publication:'2026-09-20',deadline:'2026-11-01',source:'TED'};
const {cleanPrevious}=require('./collect-ted.cjs');
assert.equal(cleanPrevious([{id:'medical',title:'Fourniture de médicaments',description:'Perceel 1: denosumab',cpv:['33690000'],source:'TED'}]).items[0].screening,'excluded','Préserver la fiche historique mais masquer le faux positif');
const merged=combine([seed],[replacement]);
assert.equal(merged.length,1,'Un rectificatif ne doit pas créer de doublon');
assert.equal(merged[0].id,'ted:111-2026','Conserver la clé associée au suivi utilisateur');
assert.ok(merged[0].sectors.includes('Topo'),'Un rectificatif conserve les métiers réellement identifiés');
assert.equal(merged[0].deadline,'2026-11-01');
assert.equal(combine([seed],[{...replacement,publicationNumber:'333-2026',procedureIdentifier:''}]).length,2);

const {region:regionOf,worksScope}=require('./collect-ted.cjs');
const smallWorkTitle='Marché de travaux pour la réalisation d’aménagements permettant un accès sécurisé au cours d’eau au droit des stations limnimétriques';
const smallWork=classify(smallWorkTitle,'Accès sécurisés et petites réparations aux stations limnimétriques en Wallonie',['45000000']);
assert.ok(smallWork&&smallWork.sectors.includes('PetitsTravaux'),'Repérer le marché 03.06.04-26-2843 malgré le CPV générique 45000000');
assert.equal(classify('Curage et entretien de cours d’eau','Travaux de curage',['45240000']),null,'Écarter le curage');
assert.equal(classify('Travaux de construction de voirie','Réalisation de chaussées, réseaux et égouttage',['45233120']),null,'Ne pas retenir des travaux routiers en tant qu’entrepreneur');
assert.equal(classify('Travaux d’équipement électrique dans un bâtiment','Fourniture et installation de systèmes techniques',['45310000']),null,'Exclure les gros travaux techniques de construction');
assert.ok(classify('Mission d’auteur de projet pour aménagement de voirie','Étude et conception des voiries',['71311210'])?.sectors.includes('VRD'),'Conserver les missions d’auteur de projet');
assert.ok(!classify('Étude et dimensionnement d’un aménagement d’accès aux stations limnimétriques','Plans de conceptions',['71300000'])?.sectors.includes('PetitsTravaux'),'Ne pas classer les études seules comme travaux');
assert.equal(regionOf({'place-of-performance-subdiv-lot':['BE331'],'buyer-city':'Gent'}),'Wallonie','Le lieu d’exécution prime sur le siège du pouvoir adjudicateur');
assert.equal(regionOf({'place-of-performance-subdiv-lot':['BE211'],'buyer-city':'Bruxelles'}),'Flandre');
assert.equal(regionOf({'place-of-performance-subdiv-lot':['BEZZZ'],'buyer-city':'Gent'}),'Belgique','Les marchés sans région précise restent à vérifier');
const flanders=normalize({...raw,'publication-number':'765432-2026','place-of-performance-subdiv-lot':['BE211']});
assert.equal(flanders,null,'Ne jamais recommander une exécution en Flandre');
assert.equal(cleanPrevious([{...seed,region:'Flandre'}]).items[0].screening,'excluded','Préserver les ID historiques flamands en dehors du listing');
assert.deepEqual(worksScope('Curage des cours d’eau','Curage',['45240000']).rejected,'curage');

// Cas réels de bruit détecté dans MarchéRadar en octobre 2026.
const profile=require('./kdrix-profile.cjs');
assert.equal(classify("Acquisition d'une balayeuse compacte pour le service voirie",'Équipement des services techniques',['34144431']),null);
assert.equal(classify('Renouvellement du portefeuille d’assurances de la Commune','Assurance des bâtiments communaux',['66510000']),null);
assert.equal(classify("Fourniture d'une camionnette de chantier",'Utilisation en voirie',['34144700']),null);
assert.equal(classify("Achat de livres imprimés",'Pour les implantations de l’université',['22110000']),null);
assert.ok(classify('Levé des cours d’eau couverts en province de Liège','Marché de levés hydrographiques',['71353100'])?.sectors.includes('Hydro'));
assert.ok(classify('Entretien et contrôle par jaugeages de sections de mesures hydrologiques','Jaugeages de cours d’eau',['71300000'])?.sectors.includes('Hydraulique'));
assert.ok(classify('Prestations de géomètre pour bornage contradictoire','Mesurage de propriétés',['71355000'])?.sectors.includes('Foncier'));
assert.ok(classify('Vectorisation des plans des réseaux de distribution électrique et gaz','Cartographie numérique',['71354100'])?.sectors.includes('Carto'));
assert.equal(profile.excluded({buyer:'Vlaamse Overheid',region:'Bruxelles',title:'Prestations de géomètre',description:'Relevés'}),'acheteur_flamand');
assert.equal(profile.excluded({buyer:'SPW',region:'Wallonie',title:'Relevé topo',description:'en français'}),null);
assert.ok(profile.classify('Études techniques de métros','La prestation comprend des relevés topographiques',['71000000'])?.screening==='review','Signaler les mentions indirectes sans envahir le listing');

// Attributions : aucune identité ou prix inventé lorsqu'une source ne l'indique pas.
const awards=require('./awards-ted.cjs');
const awardRaw={
 'notice-type':'can-standard',
 'procedure-identifier':'procedure-identifiant-stable',
 'publication-number':'987654-2026',
 'publication-date':'2026-10-14',
 'winner-name':{fra:['Bureau GEOSONDE']},
 'winner-identifier':['BE0777000000'],
 'tendering-party-name':['Bureau GEOSONDE'],
 'winner-decision-date':'2026-10-13',
 'received-submissions-type-code':['tenders'],
 'received-submissions-type-val':['4'],
 'tender-value':['95000.50'],
 'tender-value-cur':['EUR'],
 'result-lot-identifier':['LOT-0001','LOT-0002']
};
const award=awards.parse(awardRaw);
assert.equal(award.winners[0],'Bureau GEOSONDE');
assert.equal(award.offerCount,4);
assert.equal(award.tenderValues[0].amount,95000.50);
assert.equal(award.totalAwardValues.length,0,'Le montant de l’offre ne doit pas devenir un montant contractuel fictif');
assert.equal(award.lotIdentifiers.length,2);
assert.equal(awards.parse({...awardRaw,'notice-type':'cn-standard'}),null);
const awarded=awards.attach([{id:'ted:123456-2026',procedureIdentifier:'procedure-identifiant-stable',title:'Topographie'}],[awardRaw]);
assert.equal(awarded.marketMatches,1);
assert.equal(awarded.items[0].id,'ted:123456-2026','Le suivi utilisateur reste lié au même dossier');
assert.equal(awards.attach(awarded.items,[awardRaw]).items[0].awards.length,1,'Pas de doublons d’avis d’attribution');
assert.equal(awards.attach([{id:'x',procedureIdentifier:'autre-procedure'}],[awardRaw]).marketMatches,0,'Pas de fausse correspondance entre des marchés différents');

console.log('MARCHERADAR_TEST_OK — classification, dates, traductions, attributions et dédoublonnage');
