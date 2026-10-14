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
assert.equal(cleanPrevious([{id:'medical',title:'Fourniture de médicaments',description:'Perceel 1: denosumab',cpv:['33690000'],source:'TED'}]).items.length,0,'Purger les faux positifs anciens');
const merged=combine([seed],[replacement]);
assert.equal(merged.length,1,'Un rectificatif ne doit pas créer de doublon');
assert.equal(merged[0].id,'ted:111-2026','Conserver la clé associée au suivi utilisateur');
assert.deepEqual(merged[0].sectors,['Topo','Hydro']);
assert.equal(merged[0].deadline,'2026-11-01');
assert.equal(combine([seed],[{...replacement,publicationNumber:'333-2026',procedureIdentifier:''}]).length,2);
console.log('MARCHERADAR_TEST_OK — classification, dates, traductions, attributions et dédoublonnage');
