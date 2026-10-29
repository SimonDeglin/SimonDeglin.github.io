/* Dates documentaires : la séance, le document et le contrôle restent distincts. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.MRDocumentDates=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const fold=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const months=['janvier','fevrier','mars','avril','mai','juin','juillet','aout','septembre','octobre','novembre','decembre'];
 const token='(?:\\d{4}[-/]\\d{2}[-/]\\d{2}|\\d{1,2}[./ -]\\d{1,2}[./ -]\\d{4}|\\d{1,2}(?:er)?[ -]+(?:'+months.join('|')+')[ -]+\\d{4})';
 const weekday='(?:(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\\s+)?';
 function iso(y,m,d){y=Number(y);m=Number(m);d=Number(d);const dt=new Date(Date.UTC(y,m-1,d));return y>=1990&&y<=2100&&dt.getUTCFullYear()===y&&dt.getUTCMonth()===m-1&&dt.getUTCDate()===d?[y,String(m).padStart(2,'0'),String(d).padStart(2,'0')].join('-'):null;}
 function parse(s){s=fold(s).trim();let m;if((m=s.match(/^(\d{4})[-/](\d{2})[-/](\d{2})$/)))return iso(m[1],m[2],m[3]);if((m=s.match(/^(\d{1,2})[./ -](\d{1,2})[./ -](\d{4})$/)))return iso(m[3],m[2],m[1]);if((m=s.match(/^(\d{1,2})(?:er)?[ -]+([a-z]+)[ -]+(\d{4})$/)))return iso(m[3],months.indexOf(m[2])+1,m[1]);return null;}
 function evidence(text,pattern,kind,page,source){const m=fold(text).match(pattern);if(!m)return null;const date=parse(m[1]);return date?{date,kind,page,source,excerpt:String(text).slice(m.index,m.index+m[0].length).replace(/\s+/g,' ').trim(),confidence:source==='pdf_text'?'explicit':'inferred'}:null;}
 function extract({text='',title='',url='',sha256=''}={}){
  // Un en-tête suffit ; ne pas retenir une séance précédente citée dans le corps.
  const header=String(text).split('\f')[0].slice(0,1800),lines=header.split('\n').slice(0,26).join('\n');
  const sessionPattern=new RegExp('(?:^|\\n| {3,})\\s*(?:[= *-]+\\s*)?(?:(?:proces[ -]verbal|pv)\\s+de\\s+la\\s+)?(?:seance(?:\\s+(?:publique|ordinaire|extraordinaire))?|conseil(?:\\s+(?:communal|provincial))?)\\s+(?:du|en date du)\\s+'+weekday+'('+token+')','i');
  let session=evidence(lines,sessionPattern,'session',1,'pdf_text');
  if(!session)session=evidence(header,new RegExp('(?:prochain\\s+)?conseil\\s+(?:communal|provincial)\\s+qui\\s+se\\s+deroulera\\s+le\\s+'+weekday+'('+token+')','i'),'session',1,'pdf_text');
  const issued=new RegExp('(?:^|\\n)\\s*(?:(?:fait\\s+a\\s+)?[a-z][a-z .’\x27-]{1,55},\\s*le|date\\s+du\\s+document\\s*[:：]?|publie(?:e)?\\s+le)\\s*('+token+')','i');
  let document=evidence(lines,issued,'document',1,'pdf_text');
  let fallback=null;
  if(!session&&!document){
   const pattern=new RegExp('(?:^|[^0-9])('+token+')(?![0-9])','i');
   fallback=evidence(String(title),pattern,'document',null,'link_title');
   let name='';try{name=decodeURIComponent(new URL(url).pathname.split('/').pop()||'')}catch(e){}
   if(!fallback)fallback=evidence(name,pattern,'document',null,'filename');
   if(!fallback){const m=name.match(/(?:^|[^0-9])((?:19|20)\d{2})(\d{2})(\d{2})(?!\d)/);const date=m&&iso(m[1],m[2],m[3]);if(date)fallback={date,kind:'document',page:null,source:'filename',excerpt:name,confidence:'inferred'};}
  }
  if(!session&&!document&&!fallback){let name='';try{name=decodeURIComponent(new URL(url).pathname.split('/').pop()||'')}catch(e){}const m=name.match(/^(?:pv|cc|oj)[-_]?(\d{2})(\d{2})(\d{2})(?:[^0-9]|$)/i),date=m&&iso(2000+Number(m[1]),m[2],m[3]);if(date)fallback={date,kind:'document',page:null,source:'filename',excerpt:name,confidence:'inferred'};}
  if(fallback)document=fallback;
  return {version:1,sourceUrl:url,sha256:sha256||null,session,document,status:session||document?'identified':'unknown'};
 }
 function format(date){return /^\d{4}-\d{2}-\d{2}$/.test(date||'')&&parse(date)?date.split('-').reverse().join('/'):'Date non identifiée';}
 function view(m,now=new Date()){
  if(!m||m.source!=='LOCALE')return null;
  let d=m.sourceDocumentDates;
  const hash=m.sourceDocumentVersion?.sha256;
  const stale=d&&((d.sha256&&hash&&d.sha256!==hash)||(d.sourceUrl&&d.sourceUrl!==(m.sourceDocument||m.url)));
  if(!d||stale)d=extract({url:m.sourceDocument||m.url});
  const p=d.session||d.document;
  if(!p||!parse(p.date))return {label:'Date du document',value:'Date non identifiée',summary:'Date du document non identifiée',proof:stale?'La preuve de date concerne une ancienne version.':'Aucune date fiable repérée ; la date de collecte ne date pas le document.',date:'',old:false};
  const label=p.kind==='session'?'Séance du':'Document du',inferred=p.confidence!=='explicit';
  const extra=d.session&&d.document&&d.document.date!==d.session.date?' · document du '+format(d.document.date):'';
  const old=Date.parse(now)-Date.parse(p.date)>365*86400000;
  return {label:p.kind==='session'?'Date de séance':'Date du document',value:format(p.date)+(inferred?' · à confirmer':''),summary:label+' '+format(p.date)+(inferred?' · à confirmer':'')+extra+(old?' · plus d’un an':''),date:p.date,old,proof:(inferred?(p.source==='link_title'?'Date déduite du titre du lien':'Date déduite du nom du fichier'):(p.source==='html_text'?'Date lue sur la page officielle':'Date lue dans le PDF')+(p.page?' · page '+p.page:''))+' : '+p.excerpt};
 }
 function cutoff(now=new Date()){
  const day=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Brussels',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));
  const [y,m,d]=day.split('-').map(Number),target=new Date(Date.UTC(y,m-4,1)),last=new Date(Date.UTC(target.getUTCFullYear(),target.getUTCMonth()+1,0)).getUTCDate();
  return iso(target.getUTCFullYear(),target.getUTCMonth()+1,Math.min(d,last));
 }
 function freshness(m,now=new Date()){
  if(!m||m.source!=='LOCALE')return {active:true,reason:'not_local'};
  const v=view(m,now),date=v.date,from=cutoff(now);
  if(!date)return {active:false,reason:'date_unknown',cutoff:from,date:''};
  return {active:date>=from,reason:date>=from?'recent':'older_than_three_months',cutoff:from,date};
 }
 return {parse,extract,view,format,cutoff,freshness};
});
