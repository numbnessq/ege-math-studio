'use strict';
const $=id=>document.getElementById(id);
const {topics,records,official}=mathBank;
const families=[...new Map(records.map(t=>[t.family,t])).values()];
let count=4, active=0, sheets=[], currentMode='series', packetKeysOnly=false;
function node(tag,text){const el=document.createElement(tag);if(text!==undefined)el.textContent=text;return el}
function button(text,act){const b=node('button',text);b.onclick=act;return b}
function options(el,items){el.replaceChildren(...items.map(([v,label])=>new Option(label,v)))}
const originalTasks = globalThis.fipiBank?.tasks || [];
const officialIndex = makeOfficialIndex(originalTasks, globalThis.examNumbers);
const isExam = () => currentMode==='exam' || currentMode==='fipi-exam';
const bankMode = mode => mode==='fipi' || mode==='fipi-exam';
const topicName = n => topics[n-1] || 'Вне текущей нумерации';
function available(n, keys=$('keys-only').checked) {
 return (officialIndex.get(n)||[]).filter(t=>!keys || hasOfficialAnswer(t));
}
function chooseOriginal(){
 const group=available(Number($('type').value));
 options($('original-choice'),group.map((t,i)=>[t.id,(i+1)+' · '+officialCode(t)+' · '+(t.text || t.html.replace(/<[^>]*>/g,' ')).replace(/\s+/g,' ').trim().slice(0,90)]));
 $('generate').disabled=!group.length;
}
function configureTypes(){
 const mode=$('mode').value,original=mode==='official';
 const isBank=bankMode(mode),full=mode==='fipi-exam'||mode==='exam';
 $('bank-settings').hidden=!isBank;$('original-picker').hidden=mode!=='fipi';
 $('generate').disabled=false;
 $('typeBox').hidden=full;$('familyBox').hidden=mode!=='series';$('copies').hidden=original||mode==='fipi';
 if(isBank){
   const prev=$('type').value;
   const numbers=[...officialIndex.keys()].sort((a,b)=>(a||99)-(b||99));
   options($('type'),numbers.map(n=>[n,(n?'№ '+n+' · ':'')+topicName(n)+' ('+available(n).length+')']));
   if(prev!=='' && numbers.includes(Number(prev))) $('type').value=prev;
   if(mode==='fipi')chooseOriginal();
   $('help').textContent=originalTasks.length+' карточек в загруженном банке. '+(full?'Для каждого номера случайно выбирается оригинальное задание.':'Выберите экзаменационный номер и код карточки.');
   $('generate').textContent=full?'Собрать комплект':'Открыть задачу';
   return;
 }
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
 const mode=$('mode').value;
 let next;
 try {
   if(mode==='fipi'){
     const task=available(Number($('type').value)).find(t=>String(t.id)===$('original-choice').value);
     if(!task)throw Error('В этой подборке нет заданий.');
     next=[[task]];
   }else if(mode==='fipi-exam')next=officialSheets(officialIndex,count,$('keys-only').checked);
   else next=mode==='official'?[[official.find(t=>t.type===Number($('type').value))]]:buildSheets(mathBank,mode,Number($('family').value),count);
 }catch(error){$('help').textContent=error.message;return}
 sheets=next;currentMode=mode;packetKeysOnly=$('keys-only').checked;
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
 const key=node('section');key.id='answer-key';key.classList.toggle('full-exam',isExam());key.append(node('h2','Ответы для учителя'));
 sheets.forEach((sheet,i)=>{
   const group=node('section');group.append(node('h3','Вариант '+(i+1)));
   const list=node('dl');
   sheet.forEach((t,p)=>{
     const entry=node('div');entry.append(node('dt','№ '+(isExam()?p+1:(t.type||'—'))),node('dd',formatAnswer(t)));list.append(entry);
   });
   group.append(list);key.append(group);
 });
 return key;
}
function formatAnswer(t){if(!hasOfficialAnswer(t))return 'Ответ не загружен · '+officialCode(t);return String(t.answer).replace(/(\d)\.(\d)/g,'$1,$2')}
function bankEditor(t,position){
 const edit=node('details');edit.className='task-editor';edit.append(node('summary','Заменить задание'));
 edit.ontoggle=()=>{
   if(!edit.open || edit.children.length>1)return;
   const controls=node('div');controls.className='edit-controls';
   const topic=node('select'),card=node('select');
   const types=[...officialIndex.keys()].filter(n=>n>0&&(n<=12)===(position<12)).sort((a,b)=>a-b);
   options(topic,types.map(n=>[n,'№ '+n+' · '+topicName(n)]));topic.value=String(t.type);
   const used=new Set(sheets.flat().map(item=>item.id));
   const keys=packetKeysOnly;
   let pool;
   function refresh(){
     pool=available(Number(topic.value),keys).filter(item=>!used.has(item.id));
     options(card,pool.map(item=>[item.id,officialCode(item)]));apply.disabled=!pool.length;
   }
   const apply=button('Применить к этому варианту',()=>{
     const chosen=pool.find(item=>String(item.id)===card.value);if(!chosen)return;
     sheets[active][position]=chosen;topicFilter.value='all';render();
     $('message').textContent='Задание и ключ обновлены в варианте '+(active+1)+'.';
   });
   for(const [caption,select] of [['Тема замены',topic],['Карточка ФИПИ',card]]){
     const label=node('label',caption);label.append(select);controls.append(label);
   }
   topic.onchange=refresh;refresh();controls.append(apply);edit.append(controls);
 };
 return edit;
}
function taskView(t,position){
 const article=node('article');const heading=node('div');heading.className='taskhead';const number=isExam()?position+1:t.type;
 article.dataset.position=position;article.dataset.type=t.type;
 heading.append(node('b',number?'№ '+number:'Архив'),node('span',(number!==t.type?'Тип № '+t.type+' · ':'')+topicName(t.type)));
 if(bankMode(currentMode)){
   if(isExam())heading.append(bankEditor(t,position));
   heading.append(node('small',officialCode(t)));article.append(heading,originalBody(t));
   const a=node('a','Оригинал в банке ФИПИ ↗');a.href=t.source;a.target='_blank';a.rel='noreferrer';article.append(a);
   if(hasOfficialAnswer(t)){
     const d=node('details');d.append(node('summary','Ответ'),node('strong','Ответ: '+formatAnswer(t)));
     if(t.answerSource){const ref=node('a','Источник ответа ↗');ref.href=t.answerSource;ref.target='_blank';ref.rel='noreferrer';d.append(node('br'),ref)}
     article.append(d);
   }else article.append(node('small',' · Ответ не загружен'));
   if(currentMode==='fipi'){
     const list=available(t.type,packetKeysOnly), pos=list.indexOf(t);
     const nav=node('div');nav.className='analog browse';
     for(const [direction,label] of [[-1,'← Предыдущее'],[1,'Следующее →']]){
       const next=list[pos+direction];
       const b=button(label,()=>{
         $('mode').value='fipi';$('keys-only').checked=packetKeysOnly;configureTypes();
         $('type').value=String(t.type);chooseOriginal();$('original-choice').value=String(next.id);generate();
       });
       b.disabled=!next;nav.append(b);
     }
     article.append(nav);
   }
   return article;
 }
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
 $('title').textContent=isExam()?'Полный вариант':currentMode==='fipi'?topicName(tasks[0].type):tasks[0].title;
 $('meta').textContent=bankMode(currentMode)?'Открытый банк ФИПИ':currentMode==='official'?'Материалы ФИПИ · адаптация условия':'Авторские аналоги · '+(currentMode==='exam'?'19 заданий':'задание № '+tasks[0].type);
 $('variants').replaceChildren(...sheets.map((_,i)=>{const b=button('Вариант '+(i+1),()=>{active=i;render()});b.setAttribute('aria-pressed',String(i===active));return b}));
 const previous=topicFilter.value;
 $('filter-box').hidden=!isExam();
 const types=[...new Set(tasks.map(t=>t.type))].sort((a,b)=>a-b);
 options(topicFilter,[['all','Все темы'],...types.map(n=>[n,topics[n-1]])]);
 if(isExam()&&types.includes(Number(previous)))topicFilter.value=previous;
 const views=sheets.map((list,i)=>{
   const section=node('section');section.className='sheet';section.hidden=i!==active;
   const printTitle=node('h2','Вариант '+(i+1));printTitle.className='printOnly';section.append(printTitle);
   list.forEach((t,p)=>{
     if(isExam()&&(p===0||p===12)){
       const heading=node('h3',p===0?'Часть 1 · краткий ответ':'Часть 2 · развёрнутое решение');
       heading.dataset.part=p===0?'1':'2';section.append(heading);
     }
     section.append(taskView(t,p));
   });return section;
 });
 $('tasks').replaceChildren(...views,answerKey());applyFilter();
 $('message').textContent='Открыт вариант '+(active+1)+' из '+sheets.length;
}
$('mode').onchange=configureTypes;$('type').onchange=()=>{$('mode').value==='fipi'?chooseOriginal():configureFamily()};$('keys-only').onchange=configureTypes;$('generate').onclick=generate;$('print').onclick=()=>print();
if(!officialIndex.size)$('mode').value='series';
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
