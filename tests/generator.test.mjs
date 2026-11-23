import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import '../engine.js';
import '../data/bank.js';
const bank=globalThis.mathBank;
test('Каждый из 19 номеров присутствует в каждой из четырёх работ',()=>{
 const sheets=buildSheets(bank,'exam',0,4);
 for(const sheet of sheets)assert.deepEqual(sheet.map(t=>t.type),Array.from({length:19},(_,i)=>i+1));
 for(let i=0;i<19;i++){assert.equal(new Set(sheets.map(s=>s[i].family)).size,1);assert.equal(new Set(sheets.map(s=>s[i].text)).size,4);}
});
test('В серии меняются только числа, каждая задача имеет решение',()=>{
 for(const family of new Set(bank.records.map(r=>r.family))){
  for(let run=0;run<20;run++){
   const copies=buildSheets(bank,'series',family,4).flat();
   assert.equal(new Set(copies.map(t=>t.text)).size,4);
   assert.equal(new Set(copies.map(t=>t.text.replace(/[\d.,]+/g,'#'))).size,1);
   for(const t of copies)assert.ok(t.answer&&t.solution&&!/undefined|NaN/.test(t.text+t.answer));
  }
 }
});
test('Снимок для сайта соответствует SQLite и исходным числам ФИПИ',()=>{
 const db=new DatabaseSync('data/bank.sqlite',{readOnly:true});
 assert.equal(db.prepare('SELECT count(*) AS n FROM tasks').get().n,bank.records.length);
 assert.deepEqual(bank.official.map(t=>Number(t.answer)),[.35,2,12]);
 db.close();
});
