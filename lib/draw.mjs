import { randomInt } from 'node:crypto';
export const names = Object.freeze(['Sarah','Simon','San','Lola','Giovanni','Sylvie','Thomas','Mimi','Olivia']);
const couples = [['Sarah','Simon'],['San','Lola'],['Giovanni','Sylvie'],['Thomas','Mimi']];
export function forbidden(giver,recipient){
  return giver===recipient || couples.some(c=>c.includes(giver)&&c.includes(recipient)) || (['Thomas','Mimi'].includes(giver)&&recipient==='Olivia') || (giver==='Olivia'&&['Thomas','Mimi'].includes(recipient));
}
export function validate(mapping){
  return mapping && Object.keys(mapping).length===names.length && names.every(n=>names.includes(mapping[n])&&!forbidden(n,mapping[n])) && new Set(Object.values(mapping)).size===names.length && mapping.Giovanni==='Simon';
}
export function makeDraw(){
  const result={Giovanni:'Simon'};
  const givers=names.filter(n=>n!=='Giovanni');
  const targets=names.filter(n=>n!=='Simon');
  function solve(i,remaining){
    if(i===givers.length) return true;
    const giver=givers[i]; const options=remaining.filter(n=>!forbidden(giver,n));
    for(let j=options.length-1;j>0;j--){const k=randomInt(j+1);[options[j],options[k]]=[options[k],options[j]];}
    for(const target of options){result[giver]=target;if(solve(i+1,remaining.filter(n=>n!==target)))return true;delete result[giver];}
    return false;
  }
  if(!solve(0,targets)||!validate(result))throw new Error('Aucun tirage valide');
  return result;
}
