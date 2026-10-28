/* Marché Radar : preuve des dates limites e-Procurement.
 * N'accepte qu'une concordance entre la page publique et l'API officielle
 * de la MEME publication et le bon fuseau horaire Europe/Brussels.
 * Aucun mot-clé de CSC, aucune date déduite sans source explicite.
 */
'use strict';
const PUBLIC_ROOT='https://www.publicprocurement.be/publication-workspaces/';
const DATE_RE=/\bDate\s+limite\s+de\s+soumission\s+(\d{2})\/(\d{2})\/(20\d{2})\s+(\d{2}):(\d{2})\s+(CET|CEST)\b/i;
const JSON_RE=/^(20\d{2}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/;
function parsePage(text){
 const x=DATE_RE.exec(String(text||''));
 if(!x)return null;
 const date=x[3]+'-'+x[2]+'-'+x[1];
 const time=x[4]+':'+x[5];
 const zone=x[6];
 return {date,time,zone,visiblePhrase:x[0]};
}
function validate(raw,workspace,body){
 if(!/^[a-f0-9-]{36}$/i.test(workspace))return {ok:false,why:'invalid_workspace'};
 if(!raw||typeof raw!=='object'||raw.id!==workspace)return {ok:false,why:'workspace_mismatch'};
 const display=parsePage(body);
 if(!display)return {ok:false,why:'no_explicit_submission_deadline_on_page'};
 const api=String(raw.vault?.submissionDeadline||'');
 const match=JSON_RE.exec(api);
 if(!match)return {ok:false,why:'no_current_vault_deadline'};
 const isoDate=match[1],time=match[2]+':'+match[3];
 if(isoDate!==display.date||time!==display.time)return {ok:false,why:'official_page_api_disagreement'};
 // Vault is the active value. Explicitly refuse a payload whose latest revision contradicts it.
 const versions=Array.isArray(raw.versions)?raw.versions:[];
 const last=versions.at(-1);
 if(last?.submissionDeadline&&String(last.submissionDeadline).slice(0,16)!==api.slice(0,16))
  return {ok:false,why:'version_disagreement'};
 const offset=display.zone==='CET'?'+01:00':'+02:00';
 const iso=isoDate+'T'+time+':00'+offset;
 const instant=new Date(iso);
 if(!Number.isFinite(instant.getTime()))return {ok:false,why:'invalid_datetime'};
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Brussels',hourCycle:'h23',
  year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}).formatToParts(instant);
 const get=k=>parts.find(x=>x.type===k)?.value||'';
 const expected=get('year')+'-'+get('month')+'-'+get('day')+'T'+get('hour')+':'+get('minute');
 if(expected!==isoDate+'T'+time)return {ok:false,why:'incorrect_brussels_offset'};
 return {ok:true,dateTime:iso,date:isoDate,time,zone:display.zone,
  sourceUrl:PUBLIC_ROOT+workspace+'/general',
  evidence:display.visiblePhrase,
  versions:versions.length};
}
function updateMarket(m,result,at){
 if(!m||m.source!=='BOSA'||m.noticeKind!=='competition'||!result?.ok)return {market:m,changed:false,why:'unsupported_notice_or_invalid_evidence'};
 const current=String(m.deadline||'');
 if(current===result.dateTime&&m.deadlineSourceKind==='bosa_verified_public'){
  return {market:m,changed:false,why:'unchanged'};
 }
 // Do not overwrite a conflicting user/collector deadline with unknown provenance.
 if(current&&current.slice(0,10)!==result.date&&m.deadlineSourceKind!=='bosa_verified_public')
  return {market:m,changed:false,why:'existing_conflicting_date_requires_review'};
 const next={...m};
 const former=String(m.deadline||'');
 if(former&&former!==result.dateTime&&m.deadlineSourceKind==='bosa_verified_public'){
  const prev=Array.isArray(m.deadlineHistory)?m.deadlineHistory.slice():[];
  if(!prev.some(x=>x.value===former))prev.push({value:former,sourceUrl:m.deadlineSourceUrl||'',notedAt:m.deadlineVerifiedAt||''});
  next.deadlineHistory=prev;
 }
 next.deadline=result.dateTime;
 next.deadlineTime=result.time;
 next.deadlineTimeZone='Europe/Brussels';
 next.deadlineSourceKind='bosa_verified_public';
 next.deadlineSourceUrl=result.sourceUrl;
 next.deadlineSourceEvidence=result.evidence;
 next.deadlineVerifiedAt=at||new Date().toISOString();
 return {market:next,changed:true,why:former?'precised_or_revised':'new_verified_deadline'};
}
module.exports={parsePage,validate,updateMarket,PUBLIC_ROOT};
