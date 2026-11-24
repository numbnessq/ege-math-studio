import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const app=vm.createContext({});
for(const file of ['data/fipi.js','data/exam-numbers.js','official-bank.js','data/statgrad.js']){
  vm.runInContext(readFileSync(new URL('../'+file,import.meta.url),'utf8'),app);
}
const bank=app.fipiBank;
const index=app.makeOfficialIndex(bank.tasks,app.examNumbers);

test('В срезе нет повторов, доступны обе части и четыре варианта',()=>{
  assert.equal(bank.total,bank.tasks.length);
  assert.equal(new Set(bank.tasks.map(t=>t.id)).size,bank.total);
  assert.ok(bank.tasks.every(t=>t.html?.trim() || t.text?.trim()));
  const sheets=app.officialSheets(index,4,false);
  assert.equal(sheets.flat().length,76);
  assert.equal(new Set(sheets.flat().map(t=>t.id)).size,76);
  for(const sheet of sheets)assert.deepEqual(Array.from(sheet,t=>t.type),Array.from({length:19},(_,i)=>i+1));
});

test('Фильтр допускает нулевой ответ и сообщает о нехватке ключей',()=>{
  assert.equal(app.hasOfficialAnswer({answer:'0'}),true);
  assert.equal(app.hasOfficialAnswer({answer:null}),false);
  assert.throws(()=>app.officialSheets(new Map(),1,true),/№ 1/);
});

test('Архив СтатГрада сохраняет адрес и дату каждой работы',()=>{
  const works=app.statgradArchive;
  assert.equal(new Set(works.map(w=>w.url)).size,works.length);
  assert.ok(works.length>=246);
  assert.ok(works.every(w=>new URL(w.url).host==='math100.ru' && /^\d{4}-\d{2}-\d{2}$/.test(w.date)));
});
