'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const api=require('../tools/communes-documents.cjs'),detail=require('../detail-phase2.js');
const url='https://www.commune-test.be/conseil/pv.pdf';
const pdf={url,title:'PV public'};
const commune={ins:'62001',name:'Test',readDocuments:[],documentsRead:0,opportunities:0,deliberationSources:[{url:'https://www.commune-test.be/conseil/',status:'page_accessible'}]};
const quote='Le conseil decide de lancer un marche de services pour un bureau d etudes avec leves topographiques de la place communale.';
const other='Le conseil approuve une mission de bornage et division parcellaire avec designation du geometre pour les terrains communaux.';
const now='2026-10-28T10:00:00Z';
function file(text,etag='"v1"'){return {bytes:Buffer.from('%PDF-1.7\n'+text),finalUrl:url,etag,lastModified:'Wed, 28 Oct 2026 10:00:00 GMT'}}
const extract=bytes=>bytes.toString().split('\n').slice(1).join('\n');
function first(){return api.processDocument([],commune,pdf,file(quote),now,extract)}
test('première lecture : ID historique, extrait paginé et empreinte liés au même document',()=>{
 const a=first();assert.equal(a.created,1);assert.equal(a.items[0].sourceEvidencePage,1);assert.equal(a.items[0].evidence,quote);
 assert.equal(a.items[0].sourceEvidenceStatus,'found');assert.equal(a.items[0].sourceDocumentVersion.sha256.length,64);
 assert.equal(a.commune.readDocuments.length,1);assert.equal(a.commune.documentsRead,1);
});
test('même URL, nouveaux octets : ne pas ressusciter un dossier classé ; conserver l’extrait historique',()=>{
 const a=first(),savedStatuses={[a.items[0].id]:'irrelevant'};
 const b=api.processDocument(a.items,a.commune,pdf,file(other,'"v2"'),'2026-10-29T10:00:00Z',extract);
 assert.equal(b.changed,true);assert.equal(b.items.length,1);assert.equal(b.created,0);
 assert.equal(b.items[0].id,a.items[0].id);assert.equal(savedStatuses[b.items[0].id],'irrelevant');
 assert.equal(b.items[0].evidence,quote);assert.equal(b.items[0].sourceEvidenceStatus,'not_found');
 assert.equal(b.items[0].sourceDocumentReview.candidates[0].excerpt,other);
 const check=b.commune.documentChecks[api.documentId(url)];
 assert.equal(check.history[0].sha256,a.items[0].sourceDocumentVersion.sha256);
 assert.equal(check.sha256,b.items[0].sourceDocumentVersion.sha256);assert.equal(b.commune.documentsRead,1);
 assert.equal(a.items[0].sourceEvidenceStatus,'found','Ne pas muter la version précédente');
});
test('document enrichi : signaler les passages nouveaux sans les attribuer au dossier existant',()=>{
 const a=first(),b=api.processDocument(a.items,a.commune,pdf,file(quote+'\f'+other),'2026-10-29T10:00:00Z',extract);
 assert.equal(b.items[0].sourceEvidenceStatus,'found');assert.equal(b.items.length,1);assert.equal(b.reviewCandidates,1);
 assert.equal(b.items[0].sourceDocumentReview.candidates[0].page,2);
 const html=detail.municipalDocumentTrace(b.items[0]);assert.match(html,/rattachement à ce marché n’est pas confirmé/);
 assert.match(html,/ne constitue pas, à elle seule, un rectificatif officiel/);
});
test('relecture des fichiers hérités : readDocuments seul ne bloque pas le contrôle de version',()=>{
 const a=first(),legacy={...a.commune,documentChecks:undefined};
 const old={...a.items[0]};delete old.sourceDocumentVersion;
 const b=api.processDocument([old],legacy,pdf,file(quote),now,extract);
 assert.equal(b.items.length,1);assert.equal(b.created,0);assert.equal(b.changed,false);assert.equal(b.parsed,true);
 assert.equal(b.items[0].id,old.id);assert.equal(b.commune.documentsRead,1);
});
test('PDF identique : pas de nouvelle extraction, pas de faux changement ni de doublon',()=>{
 const a=first();let calls=0;
 const b=api.processDocument(a.items,a.commune,pdf,file(quote),'2026-10-29T10:00:00Z',()=>{calls++;throw Error('Ne doit pas relire');});
 assert.equal(calls,0);assert.equal(b.unchanged,true);assert.equal(b.changed,false);assert.equal(b.items.length,1);
 assert.equal(b.commune.documentChecks[api.documentId(url)].history,undefined);
});
test('PDF absent ou illisible : ne pas remplacer la dernière version exploitable',()=>{
 const a=first(),before=JSON.stringify(a);
 assert.throws(()=>api.processDocument(a.items,a.commune,pdf,{bytes:Buffer.from('<html>Erreur</html>')},now,extract),/pas un PDF/);
 assert.throws(()=>api.processDocument(a.items,a.commune,pdf,file('document scanne'),now,()=>''),/sans texte/);
 assert.equal(JSON.stringify(a),before);
});
test('requête conditionnelle et contrôle complet périodique, même si l’URL est constante',async()=>{
 const a=first(),previous=a.commune.documentChecks[api.documentId(url)];let headers;
 const fetchFn=async(u,o)=>{headers=o.headers;return new Response(null,{status:304})};
 const unchanged=await api.download(url,'application/pdf',9000000,{previous,now:'2026-10-29T10:00:00Z',fetchFn});
 assert.equal(headers['If-None-Match'],'"v1"');assert.equal(unchanged.notModified,true);
 await api.download(url,'application/pdf',9000000,{previous,now:'2026-11-06T10:00:00Z',fetchFn:async(u,o)=>{headers=o.headers;return new Response(file(quote).bytes)}});
 assert.equal(headers['If-None-Match'],undefined);assert.equal(headers['If-Modified-Since'],undefined);
 await assert.rejects(()=>api.download(url,'application/pdf',9000000,{fetchFn}),/304 sans version/);
});
test('refuser un téléchargement trop volumineux pendant la lecture',async()=>{
 await assert.rejects(()=>api.download(url,'application/pdf',20,{fetchFn:async()=>new Response(Buffer.alloc(21))}),/supérieur/);
});
test('collecte intégrée : modification, réponse 304 et panne conservent les dossiers et la dernière preuve',async()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'mr-versions-'));
 const inventoryPath=path.join(temp,'communes.json'),dataPath=path.join(temp,'data.json');
 fs.writeFileSync(inventoryPath,JSON.stringify({communes:[commune]}));fs.writeFileSync(dataPath,JSON.stringify({items:[],sources:{}}));
 let version=1,extractions=0;
 const fetchFn=async(u,o)=>{
  if(u.endsWith('/conseil/'))return new Response('<a href="/conseil/pv.pdf">PV public</a>');
  if(version===3)return new Response(null,{status:503});
  if(version===4){assert.equal(o.headers['If-None-Match'],'"v2"');return new Response(null,{status:304});}
  return new Response(file(version===1?quote:other).bytes,{headers:{etag:'"v'+version+'"'}});
 };
 const options={inventoryPath,dataPath,fetchFn,extract:b=>{extractions++;return extract(b)},quiet:true};
 try{
  await api.run({...options,now});const before=JSON.parse(fs.readFileSync(dataPath));
  version=2;const changed=await api.run({...options,now:'2026-10-29T10:00:00Z'});
  const after=JSON.parse(fs.readFileSync(dataPath));assert.equal(after.items.length,1);assert.equal(after.items[0].id,before.items[0].id);assert.equal(changed.modified,1);
  version=3;const failed=await api.run({...options,now:'2026-10-30T10:00:00Z'});
  assert.equal(failed.errors,1);assert.deepEqual(JSON.parse(fs.readFileSync(dataPath)).items,after.items);
  const reg=JSON.parse(fs.readFileSync(inventoryPath)).communes[0].documentChecks[api.documentId(url)];
  assert.equal(reg.lastSuccess,'2026-10-29T10:00:00Z');assert.match(reg.lastError,/503/);
  version=4;const identical=await api.run({...options,now:'2026-10-31T10:00:00Z'});
  assert.equal(identical.unchanged,1);assert.equal(identical.documents,0);assert.equal(extractions,2);
  assert.equal(JSON.parse(fs.readFileSync(inventoryPath)).communes[0].documentChecks[api.documentId(url)].lastError,null);
 }finally{fs.rmSync(temp,{recursive:true,force:true})}
});
test('la trace documentaire échappe les extraits et ne montre pas une analyse d’une autre empreinte',()=>{
 const a=first(),m={...a.items[0],sourceDocumentReview:{sha256:a.items[0].sourceDocumentVersion.sha256,candidates:[{page:1,excerpt:'<img src=x onerror=alert(1)>'}]}};
 assert(!detail.municipalDocumentTrace(m).includes('<img'));
 assert(detail.municipalDocumentTrace(m).includes('&lt;img'));
 m.sourceDocumentReview.sha256='ancienne';assert(!detail.municipalDocumentTrace(m).includes('&lt;img'));
});
