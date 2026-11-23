// Колода каждой семьи перемешивается один раз на комплект.
function buildSheets(bank,mode,family,count,rng=Math.random){
 if(!Number.isInteger(count)||count<1||count>4)throw Error('Допустимо от 1 до 4 вариантов.');
 const families=new Map();
 for(const row of bank.records){
   if(!families.has(row.family))families.set(row.family,[]);
   families.get(row.family).push(row);
 }
 const all=[...families.values()];
 function pick(list){return list[Math.floor(rng()*list.length)]}
 const chosen=mode==='exam'?bank.topics.map((_,i)=>pick(all.filter(list=>list[0].type===i+1))):[families.get(family)];
 const sheets=Array.from({length:count},()=>[]);
 for(const group of chosen){
   const deck=group.slice();
   for(const sheet of sheets){
     const i=Math.floor(rng()*deck.length);
     sheet.push(deck.splice(i,1)[0]);
   }
 }
 return sheets;
}
globalThis.buildSheets=buildSheets;
