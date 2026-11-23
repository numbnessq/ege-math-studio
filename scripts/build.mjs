import {DatabaseSync} from 'node:sqlite';
import {writeFileSync} from 'node:fs';
import {templates,topics,originals} from './templates.mjs';
const db=new DatabaseSync(new URL('../data/bank.sqlite',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1'));
db.exec('BEGIN; CREATE TABLE IF NOT EXISTS tasks (family INTEGER, k INTEGER, exam_type INTEGER, title TEXT, statement TEXT, answer TEXT, solution TEXT, source TEXT, PRIMARY KEY(family,k)); DELETE FROM tasks;');
const insert=db.prepare('INSERT INTO tasks VALUES (?,?,?,?,?,?,?,?)');
templates.forEach((t,i)=>{
 for(let k=1;k<=16;k++){
   const task=t.make(k);
   insert.run(i,k,t.type,t.title,task.text,task.answer,task.solution,t.source?.url??null);
 }
});
db.exec('CREATE TABLE IF NOT EXISTS official (exam_type INTEGER,title TEXT,statement TEXT,answer TEXT,solution TEXT,source TEXT,reference TEXT); DELETE FROM official;');
const add=db.prepare('INSERT INTO official VALUES (?,?,?,?,?,?,?)');
for(const t of originals)add.run(t.type,t.title,t.text,t.answer,t.solution,t.url,t.ref);
db.exec('COMMIT;');
const records=db.prepare('SELECT family,k,exam_type AS type,title,statement AS text,answer,solution,source FROM tasks ORDER BY family,k').all();
const official=db.prepare('SELECT exam_type AS type,title,statement AS text,answer,solution,source,reference FROM official ORDER BY exam_type').all();
writeFileSync(new URL('../data/bank.js',import.meta.url),'globalThis.mathBank='+JSON.stringify({topics,records,official})+';\n');
db.close();
console.log(records.length+' числовых версий, '+official.length+' примера ФИПИ');
