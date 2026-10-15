'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const c=require('../tools/phase3a-core.cjs');
test('liens officiels sécurisés, URL source BOSA déterministe',()=>{
 assert.equal(c.bosaDocuments('0765b50e-85f5-4aae-b2ca-2ed66c14e354'),'https://www.publicprocurement.be/publication-workspaces/0765b50e-85f5-4aae-b2ca-2ed66c14e354/documents');
 assert.equal(c.bosaDocuments('bad-id'),'');
 assert.equal(c.safeURL('javascript:alert(1)'),'');
 assert.equal(c.safeURL('https://127.0.0.1/internal'),'');
 assert.equal(c.safeURL('https://u:p@cloud.3p.eu/private'),'');
 assert.equal(c.safeURL('https://cloud.3p.eu/Downloads/1/2570/MS/2026'),'https://cloud.3p.eu/Downloads/1/2570/MS/2026');
});
test('dates eForms avec fuseau - pas de fuseau inventé',()=>{
 assert.deepEqual(c.combineDateTime('2026-11-05+01:00','11:00:00+01:00'),{value:'2026-11-05T11:00:00+01:00',precision:'datetime'});
 assert.equal(c.combineDateTime('2026-11-05','11:00:00').precision,'date');
 assert.equal(c.combineDateTime('2026-11-05+01:00','11:00:00+02:00').warning,'fuseau_incoherent');
 assert.equal(c.combineDateTime('2026-02-31+01:00','11:00:00+01:00').precision,'unknown');
 assert.equal(c.oneDeadline(['2026-10-20+02:00','2026-11-05+01:00'],['10:00:00+02:00','11:00:00+01:00']).precision,'conflict');
});
test('TED: publication correspondante et distinction avis/document',()=>{
 const notice='682034-2026';
 const raw={notices:[{
  'publication-number':notice,
  'deadline-receipt-tender-date-lot':['2026-11-05+01:00'],
  'deadline-receipt-tender-time-lot':['11:00:00+01:00'],
  links:{pdf:{FRA:'https://ted.europa.eu/fr/notice/682034-2026/pdf'}}
 }]};
 const parsed=c.parseTedAPI(raw,notice);
 assert.equal(parsed.matched,true);
 assert.equal(parsed.deadline.value,'2026-11-05T11:00:00+01:00');
 assert.equal(parsed.officialPdf,'https://ted.europa.eu/fr/notice/682034-2026/pdf');
 assert.equal(c.parseTedAPI(raw,'999999-2026').matched,false);
});
test('TED XML: documents listés seulement si URI dans la référence documentaire et dates cohérentes',()=>{
 const xml='<?xml version="1.0" encoding="UTF-8"?>'+
  '<ContractNotice xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">'+
  '<cac:CallForTendersDocumentReference><cac:Attachment><cac:ExternalReference><cbc:URI>https://www.publicprocurement.be/publication-workspaces/f3981a2f-a3f4-4d65-a293-2643b8ee0311/documents</cbc:URI></cac:ExternalReference></cac:Attachment></cac:CallForTendersDocumentReference>'+
  '<cac:TenderSubmissionDeadlinePeriod><cbc:EndDate>2026-11-05+01:00</cbc:EndDate><cbc:EndTime>11:00:00+01:00</cbc:EndTime></cac:TenderSubmissionDeadlinePeriod>'+
  '</ContractNotice>';
 const res=c.parseTedXML(xml);
 assert.equal(res.valid,true);
 assert.equal(res.links.length,1);
 assert.equal(res.deadline.value,'2026-11-05T11:00:00+01:00');
 assert.equal(c.parseTedXML('<html><body>not xml</body></html>').valid,false);
});
test('BOSA: inventorier sans fabriquer des liens individuels',()=>{
 const m={id:'bosa:0765b50e-85f5-4aae-b2ca-2ed66c14e354',publicationWorkspaceId:'0765b50e-85f5-4aae-b2ca-2ed66c14e354'};
 const page=c.bosaDocuments(m.publicationWorkspaceId);
 const rows=[
 {cells:["2026B0173_CCH - Bathymetrie Modele 3P_FR_F.pdf","FR","1","13/10/2026"]},
 {cells:["02_2026B0173_xxxx_Inventaire.xlsx","FR","1","13/10/2026"]},
 {cells:["Annexe_F_Code de conduite EEE - Biosecurite FR.pdf","FR","1","13/10/2026"]},
 {cells:["https://cloud.3p.eu/Downloads/1/1234/AA/2026","13/10/2026"]},
 {cells:["https://cloud.3p.eu/Downloads/1/1234/AA/2026","13/10/2026"]}
 ];
 const x=c.parseDocumentRows(rows,m,page,'2026-10-15T12:00:00Z');
 assert.equal(x.documents.length,3);
 assert.equal(x.external.length,1);
 assert.equal(x.documents[0].type,'csc');
 assert.equal(x.documents[1].type,'bordereau');
 assert.equal(x.documents[2].type,'annexe');
 assert.equal(x.documents[0].publicationDate,'2026-10-13');
 assert.equal(x.documents[0].accessPageUrl,page);
 assert.equal(x.documents[0].url,'');
 assert.equal(x.documents[0].accessibility,'listed_public');
 assert.equal(c.parseDocumentRows(rows,m,'https://example.org/fake',null).documents.length,0);
});
test('Fusion conserve ID, suivi et date vérifiée lors dune collecte moins précise',()=>{
 const m={id:'ted:682034-2026',source:'TED',publicationNumber:'682034-2026',
  deadline:'2026-11-05',score:95,notes:'local-only-not-here',documents:[]};
 const updated=c.mergeRecords(m,{
  checkedAt:'2026-10-15T12:00:00Z',deadline:{value:'2026-11-05T11:00:00+01:00',precision:'datetime'},
  deadlineVerified:true,deadlineSource:'TED API BT-131',deadlineSourceUrl:'https://ted.europa.eu/fr/notice/-/detail/682034-2026',
  deadlinePublicationNumber:'682034-2026',sources:[{source:'TED',url:'https://ted.europa.eu/fr/notice/-/detail/682034-2026'}]});
 assert.equal(updated.id,m.id);assert.equal(updated.deadline,'2026-11-05T11:00:00+01:00');
 assert.equal(updated.deadlineEvidence.verified,true);assert.equal(updated.deadlineHistory.length,1);
 const noChange=c.mergeRecords(updated,{deadline:{value:'2026-11-05',precision:'date'},deadlineVerified:false});
 assert.equal(noChange.deadline,updated.deadline);
 const conflicting=c.mergeRecords(updated,{checkedAt:'2026-10-15T13:00:00Z',
  deadline:{value:'2026-11-12T11:00:00+01:00',precision:'datetime'},
  deadlineVerified:true,deadlineSource:'TED XML',deadlinePublicationNumber:'701111-2026'});
 assert.equal(conflicting.deadline,updated.deadline);assert.equal(conflicting.deadlineReview.reason,'notice_distinct');
});
