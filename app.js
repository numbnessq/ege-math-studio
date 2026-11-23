'use strict';
const $=id=>document.getElementById(id);
const {topics,records,official}=mathBank;
const families=[...new Map(records.map(t=>[t.family,t])).values()];
let count=4, active=0, sheets=[], currentMode='series';
function node(tag,text){const el=document.createElement(tag);if(text!==undefined)el.textContent=text;return el}
function button(text,act){const b=node('button',text);b.onclick=act;return b}
function options(el,items){el.replaceChildren(...items.map(([v,label])=>new Option(label,v)))}
function configureTypes(){
 const mode=$('mode').value,original=mode==='official';
 $('typeBox').hidden=mode==='exam';$('familyBox').hidden=mode!=='series';$('copies').hidden=original;
 const numbers=original?official.map(t=>t.type):topics.map((_,i)=>i+1);
 options($('type'),numbers.map(n=>[n,'№ '+n+' · '+topics[n-1]]));
 configureFamily();
 $('help').textContent=original?'Три задачи по опубликованным разборам ФИПИ с исходными числами и ссылками.':mode==='exam'?'В каждом варианте 12 задач с кратким ответом и 7 с развёрнутым.':'Для каждого варианта берётся свой набор чисел из одного шаблона.';
 $('generate').textContent=original?'Открыть задачу':'Собрать комплект';
}
function configureFamily(){
 options($('family'),families.filter(t=>t.type===Number($('type').value)).map(t=>[t.family,t.title]));
}
function counts(){
 $('counts').replaceChildren(...[1,2,3,4].map(i=>{const b=button(i,()=>{count=i;counts()});b.setAttribute('aria-pressed',String(i===count));return b}));
}
function generate(){
 currentMode=$('mode').value;
 sheets=currentMode==='official'?[[official.find(t=>t.type===Number($('type').value))]]:buildSheets(mathBank,currentMode,Number($('family').value),count);
 active=0;topicFilter.value='all';render();
}
const topicFilter=$('topic-filter');
function editorFor(task,position){
 const edit=node('details');edit.className='task-editor';
 edit.append(node('summary','Заменить задание'));
 const controls=node('div');controls.className='edit-controls';
 const topic=node('select'),family=node('select');
 // В полном варианте сохраняем формат ответа и границу частей.
 const types=topics.map((_,i)=>i+1).filter(n=>currentMode!=='exam'||(position<12)===(n<=12));
 options(topic,types.map(n=>[n,'№ '+n+' · '+topics[n-1]]));topic.value=String(task.type);
 function fillFamilies(){options(family,families.filter(f=>f.type===Number(topic.value)).map(f=>[f.family,f.title]))}
 fillFamilies();family.value=String(task.family);topic.onchange=fillFamilies;
 for(const [caption,select] of [['Тема замены',topic],['Тип задачи',family]]){
   const label=node('label',caption);label.append(select);controls.append(label);
 }
 controls.append(button('Применить к этому варианту',()=>{
   const used=new Set(sheets.flat().map(t=>t.text));
   const pool=records.filter(t=>t.family===Number(family.value)&&!used.has(t.text));
   // При повторении одной темы в большом комплекте допускаем её в других позициях.
   const alternatives=pool.length?pool:records.filter(t=>t.family===Number(family.value)&&!sheets.some(s=>s[position]?.text===t.text));
   sheets[active][position]=alternatives[Math.floor(Math.random()*alternatives.length)];
   topicFilter.value='all';render();
   const updated=$('tasks').querySelector('.sheet:not([hidden])').children;
   const article=[...updated].find(el=>el.dataset.position===String(position));
   article?.querySelector('summary')?.focus({preventScroll:true});
   $('message').textContent='Задание заменено в варианте '+(active+1)+'. Ключ обновлён.';
 }));
 edit.append(controls);return edit;
}
function applyFilter(){
 const chosen=topicFilter.value;
 const current=$('tasks').querySelector('.sheet:not([hidden])');
 for(const article of current.querySelectorAll('article'))article.classList.toggle('filtered',chosen!=='all'&&article.dataset.type!==chosen);
 for(const heading of current.querySelectorAll('h3'))heading.classList.toggle('filtered',chosen!=='all'&&((Number(chosen)<=12)!==(heading.dataset.part==='1')));
}
topicFilter.onchange=applyFilter;
function answerKey(){
 const key=node('section');key.id='answer-key';key.classList.toggle('full-exam',currentMode==='exam');key.append(node('h2','Ответы для учителя'));
 sheets.forEach((sheet,i)=>{
   const group=node('section');group.append(node('h3','Вариант '+(i+1)));
   const list=node('dl');
   sheet.forEach((t,p)=>{
     const entry=node('div');entry.append(node('dt','№ '+(currentMode==='exam'?p+1:t.type)),node('dd',formatAnswer(t)));list.append(entry);
   });
   group.append(list);key.append(group);
 });
 return key;
}
function formatAnswer(t){return t.answer.replace(/(\d)\.(\d)/g,'$1,$2')}
function taskView(t,position){
 const article=node('article');const heading=node('div');heading.className='taskhead';const number=currentMode==='exam'?position+1:t.type;
 article.dataset.position=position;article.dataset.type=t.type;
 heading.append(node('b','№ '+number),node('span',(number!==t.type?'Тип № '+t.type+' · ':'')+topics[t.type-1]));
 if(currentMode!=='official')heading.append(editorFor(t,position));
 article.append(heading,node('p',t.text));
 const figure=taskFigure(t);if(figure)article.append(figure);
 if(currentMode==='official'){const a=node('a','Источник ФИПИ · '+t.reference+' ↗');a.href=t.source;a.target='_blank';a.rel='noreferrer';article.append(a);
   const actions=node('div');actions.className='analog';actions.append(button('Собрать 4 аналога',()=>{
     $('mode').value='series';configureTypes();$('type').value=String(t.type);configureFamily();
     const prototype=families.find(f=>f.type===t.type&&f.source===t.source);
     $('family').value=String(prototype.family);count=4;counts();generate();
   }));article.append(actions)}
 const d=node('details');d.append(node('summary','Ответ и решение'),node('strong','Ответ: '+formatAnswer(t)),node('p',t.solution));article.append(d);
 return article;
}
function render(){
 const tasks=sheets[active];
 $('title').textContent=currentMode==='exam'?'Полный вариант':tasks[0].title;
 $('meta').textContent=currentMode==='official'?'Материалы ФИПИ · адаптация условия':'Авторские аналоги · '+(currentMode==='exam'?'19 заданий':'задание № '+tasks[0].type);
 $('variants').replaceChildren(...sheets.map((_,i)=>{const b=button('Вариант '+(i+1),()=>{active=i;render()});b.setAttribute('aria-pressed',String(i===active));return b}));
 const previous=topicFilter.value;
 $('filter-box').hidden=currentMode!=='exam';
 const types=[...new Set(tasks.map(t=>t.type))].sort((a,b)=>a-b);
 options(topicFilter,[['all','Все темы'],...types.map(n=>[n,topics[n-1]])]);
 if(currentMode==='exam'&&types.includes(Number(previous)))topicFilter.value=previous;
 const views=sheets.map((list,i)=>{
   const section=node('section');section.className='sheet';section.hidden=i!==active;
   const printTitle=node('h2','Вариант '+(i+1));printTitle.className='printOnly';section.append(printTitle);
   list.forEach((t,p)=>{
     if(currentMode==='exam'&&(p===0||p===12)){
       const heading=node('h3',p===0?'Часть 1 · краткий ответ':'Часть 2 · развёрнутое решение');
       heading.dataset.part=p===0?'1':'2';section.append(heading);
     }
     section.append(taskView(t,p));
   });return section;
 });
 $('tasks').replaceChildren(...views,answerKey());applyFilter();
 $('message').textContent='Открыт вариант '+(active+1)+' из '+sheets.length;
}
$('mode').onchange=configureTypes;$('type').onchange=configureFamily;$('generate').onclick=generate;$('print').onclick=()=>print();
configureTypes();counts();generate();
const ctx=$('plot').getContext('2d');
if(ctx){
 ctx.translate(326,200);ctx.lineWidth=1;
 ctx.strokeStyle='#ffffff22';
 for(let x=-340;x<=340;x+=27){ctx.beginPath();ctx.moveTo(x,-210);ctx.lineTo(x,180);ctx.stroke()}
 for(let y=-216;y<180;y+=27){ctx.beginPath();ctx.moveTo(-340,y);ctx.lineTo(340,y);ctx.stroke()}
 ctx.strokeStyle='#ffffff88';ctx.beginPath();ctx.moveTo(-330,0);ctx.lineTo(330,0);ctx.moveTo(0,150);ctx.lineTo(0,-200);ctx.stroke();
 ctx.lineWidth=4;ctx.strokeStyle='#b0ffe1';ctx.beginPath();for(let x=-330;x<=330;x++){let y=45-(x-25)**2/145;if(x===-330)ctx.moveTo(x,y);else ctx.lineTo(x,y)}ctx.stroke();
 ctx.strokeStyle='#ffbc72';ctx.beginPath();ctx.moveTo(-320,135);ctx.lineTo(330,-154);ctx.stroke();
}
