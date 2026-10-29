'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),api=require('../publication-filters.js');
const records=[
 {id:'both',source:'TED',noticeType:'cn-standard',officialSources:[{source:'TED'},{source:'BOSA',noticeKind:'award'}]},
 {id:'local',source:'LOCALE',municipalityINS:'61003',buyer:'Commune d’Amay'},
 {id:'provincial',source:'LOCALE',buyer:'Province de Liège'},
 {id:'bosa',source:'BOSA',noticeKind:'competition'},
 {id:'webAward',source:'LOCALE',webSourceType:'municipal',noticeKind:'award',buyer:'Commune de Test'}
];
test('séparer sources et types : le même dossier reste unique et ne mélange pas les avis',()=>{
 assert(api.matches(records[0],'TED','competition'));assert(api.matches(records[0],'BOSA','result'));
 assert(!api.matches(records[0],'BOSA','competition'));assert(!api.matches(records[0],'TED','result'));
 assert.equal(records.filter(m=>api.matches(m,'BOSA','all')).length,2);
 assert.equal(api.sourceCounts(records).all,5);assert.equal(api.sourceCounts(records).BOSA,2);assert.equal(api.sourceCounts(records).municipal,2);assert.equal(api.sourceCounts(records).other,1);
 assert.equal(api.typeCounts(records,'BOSA').result,1);assert.equal(api.typeCounts(records,'BOSA').competition,1);
 assert.equal(api.typeCounts(records).all,5,'Les compteurs ne dupliquent jamais les dossiers');
});
test('un avis communal explicite peut être une attribution, une consultation ou un autre type',()=>{
 assert.equal(api.kind(records[1]),'prospect');assert.equal(api.kind(records[4]),'result');
 assert.equal(api.kind({...records[1],noticeKind:'competition'}),'competition');
 assert.equal(api.kind({...records[1],noticeKind:'other'}),'unknown');
 const changed={...records[4],webTypeEvidence:{sha256:'old'},sourceDocumentVersion:{sha256:'new'}};
 assert.equal(api.kind(changed),'unknown','Pas de type actuel certifié avec une ancienne preuve');
 assert.equal(api.source(records[2]),'other','Une province n’est pas une commune');
});
test('ne pas attribuer le type de l’avis principal à une source secondaire non documentée',()=>{
 const m={source:'BOSA',noticeKind:'competition',officialSources:[{source:'TED',url:'https://ted.europa.eu/'}]};
 assert(!api.matches(m,'TED','competition'));assert(api.matches(m,'TED','unknown'));
 assert.match(api.labels(records[0]),/TED/);assert.match(api.labels(records[0]),/BOSA/);
});
