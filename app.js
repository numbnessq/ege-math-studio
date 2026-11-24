'use strict';
const $=id=>document.getElementById(id);
const {topics,records,official}=mathBank;
const families=[...new Map(records.map(t=>[t.family,t])).values()];
let count=1, active=0, sheets=[], currentMode='series', packetKeysOnly=false, packetSubtype='';
function node(tag,text){const el=document.createElement(tag);if(text!==undefined)el.textContent=text;return el}
function button(text,act){const b=node('button',text);b.onclick=act;return b}
function options(el,items){el.replaceChildren(...items.map(([v,label])=>new Option(label,v)))}
const originalTasks = globalThis.fipiBank?.tasks || [];
const officialIndex = makeOfficialIndex(originalTasks, globalThis.examNumbers);
const statgradIndex=makeOfficialIndex(globalThis.statgradTasks || []);
const isExam = () => ['exam','fipi-exam','statgrad'].includes(currentMode);
const bankMode = mode => ['fipi','fipi-exam','statgrad'].includes(mode);
const topicName = n => topics[n-1] || 'Вне текущей нумерации';
const bankFor = mode => mode==='statgrad'?statgradIndex:officialIndex;
const modes = [
 ['fipi-exam','ЕГЭ из банка ФИПИ','19 заданий, случайный выбор по каждому номеру'],
 ['statgrad','Микс СтатГрада','19 заданий из разных диагностик и тренировок'],
 ['exam','ЕГЭ с новыми числами','19 заданий. В параллельных вариантах меняются числа'],
 ['fipi','Тренировка по теме','Отдельные задания ФИПИ по номеру и подтипу'],
 ['series','Однотипные задачи','Одна тема, до четырёх задач с разными числами'],
 ['official','Разборы ФИПИ','Примеры из методических рекомендаций']
];
function taskLabel(t){
 const subject=t.subtype==='Другие задачи'?topicName(t.type):t.subtype;
 const text=(t.text || '').replace(/\s+/g,' ').trim();
 return text ? subject+' · '+text.slice(0,83)+(text.length>83?'…':'') : subject;
}
function keysOnly(){return $('mode').value!=='statgrad' && $('keys-only').checked}
function available(n, keys=keysOnly(), mode=$('mode').value) {
 return (bankFor(mode).get(n)||[]).filter(t=>!keys || hasOfficialAnswer(t));
}
function subtypeOptions(select, pool, previous=select.value){
 const totals=new Map();
 for(const task of pool)totals.set(task.subtype,(totals.get(task.subtype)||0)+1);
 const choices=[...totals].sort(([a],[b])=>a.localeCompare(b,'ru'));
 options(select,[['','Все подтипы'],...choices.map(([name,n])=>[name,name+' ('+n+')'])]);
 select.value=totals.has(previous)?previous:'';
}
function configuredCards(){
 const subtype=$('subtype').value;
 return available(Number($('type').value)).filter(t=>!subtype || t.subtype===subtype);
}
function chooseOriginal(){
 const group=configuredCards();
 const topicLink=$('math100-topics');
 const math100Topic=Number($('type').value)===1 ? math100PlanarTopics.indexOf($('subtype').value)+1 : 0;
 topicLink.href=math100Topic?'https://math100.ru/prof-ege_2023_1-'+math100Topic+'/':'https://math100.ru/ege-profil2024/';
 topicLink.textContent=math100Topic?'Этот подтип на Math100 ↗':'Темы и задачи на Math100 ↗';
 options($('original-choice'),group.map(t=>[t.id,taskLabel(t)]));
 $('generate').disabled=!group.length;
}
function configureExamSubtypes(){
 const list=$('exam-subtype-list');
 const prior=new Map([...list.querySelectorAll('select')].map(s=>[s.dataset.number,s.value]));
 const rows=[];
 for(let n=1;n<=19;n++){
   const label=node('label','№ '+n+' · '+topicName(n));
   const select=node('select');select.dataset.number=n;
   subtypeOptions(select,available(n),prior.get(String(n)));
   label.append(select);rows.push(label);
 }
 list.replaceChildren(...rows);
}
function configureOriginalSubtype(previous){
 subtypeOptions($('subtype'),available(Number($('type').value)),previous);
 chooseOriginal();
}
function configureTypes(){
 const mode=$('mode').value,original=mode==='official';
 for(const btn of $('mode-cards').children)btn.setAttribute('aria-pressed',String(btn.dataset.mode===mode));
 const isBank=bankMode(mode),full=['fipi-exam','exam','statgrad'].includes(mode);
 $('bank-settings').hidden=!isBank;$('keys-only').parentElement.hidden=mode==='statgrad';$('original-picker').hidden=mode!=='fipi';$('exam-subtypes').hidden=mode==='fipi';
 $('generate').disabled=false;
 $('typeBox').hidden=full;$('familyBox').hidden=mode!=='series';$('copies').hidden=original||mode==='fipi';
 if(isBank){
   const prev=$('type').value;
   const numbers=[...bankFor(mode).keys()].sort((a,b)=>(a||99)-(b||99));
   options($('type'),numbers.map(n=>[n,(n?'№ '+n+' · ':'')+topicName(n)+' ('+available(n).length+')']));
   if(prev!=='' && numbers.includes(Number(prev))) $('type').value=prev;
   if(mode==='fipi')configureOriginalSubtype();
   if(full){
     configureExamSubtypes();
     $('math100-topics').href='https://math100.ru/ege-profil2024/';
     $('math100-topics').textContent='Темы и задачи на Math100 ↗';
   }
   $('help').textContent=mode==='statgrad'?'Для каждого номера выбирается задача из доступных работ СтатГрада. Работа и критерии указаны под заданием.':full?'Подберём 19 заданий. При желании укажите темы по номерам.':'Выберите номер, подтип и задание.';
   $('generate').textContent=full?'Собрать варианты':'Открыть задачу';
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
     const task=configuredCards().find(t=>String(t.id)===$('original-choice').value);
     if(!task)throw Error('В этой подборке нет заданий.');
     next=[[task]];
   }else if(bankMode(mode)){
     const selection=new Map([...$('exam-subtype-list').querySelectorAll('select')].map(s=>[Number(s.dataset.number),s.value]));
     next=officialSheets(bankFor(mode),count,keysOnly(),Math.random,selection,mode===currentMode?sheets:[]);
   }
   else next=mode==='official'?[[official.find(t=>t.type===Number($('type').value))]]:buildSheets(mathBank,mode,Number($('family').value),count);
 }catch(error){$('help').textContent=error.message;return}
 sheets=next;currentMode=mode;packetKeysOnly=keysOnly();packetSubtype=$('subtype').value;
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
     const entry=node('div'),answer=node('dd');
     if(t.work && !hasOfficialAnswer(t)){
       const link=node('a',formatAnswer(t));link.href=t.source;answer.append(link);
     }else answer.textContent=formatAnswer(t);
     entry.append(node('dt','№ '+(isExam()?p+1:(t.type||'—'))),answer);list.append(entry);
   });
   group.append(list);key.append(group);
 });
 return key;
}
function formatAnswer(t){if(!hasOfficialAnswer(t))return t.work?'См. критерии СтатГрад '+t.work:'Ответ не загружен · '+officialCode(t);return String(t.answer).replace(/(\d)\.(\d)/g,'$1,$2')}
function bankEditor(t,position){
 const edit=node('details');edit.className='task-editor';edit.append(node('summary','Заменить задание'));
 edit.ontoggle=()=>{
   if(!edit.open || edit.children.length>1)return;
   const controls=node('div');controls.className='edit-controls';
   const subtype=node('select'),card=node('select');
   const number=position+1;
   const used=new Set(sheets.flat().map(item=>item.id));
   const keys=packetKeysOnly;
   let pool;
   function refresh(){
     pool=available(number,keys,currentMode).filter(item=>!used.has(item.id) && (!subtype.value || item.subtype===subtype.value));
     options(card,pool.map(item=>[item.id,taskLabel(item)]));apply.disabled=!pool.length;
   }
   const apply=button('Применить к этому варианту',()=>{
     const chosen=pool.find(item=>String(item.id)===card.value);if(!chosen)return;
     sheets[active][position]=chosen;topicFilter.value='all';render();
     $('message').textContent='Задание и ключ обновлены в варианте '+(active+1)+'.';
   });
   for(const [caption,select] of [['Подтип замены',subtype],['Задание',card]]){
     const label=node('label',caption);label.append(select);controls.append(label);
   }
   function refreshSubtypes(previous){
     subtypeOptions(subtype,available(number,keys,currentMode).filter(item=>!used.has(item.id)),previous);
     refresh();
   }
   subtype.onchange=refresh;
   refreshSubtypes(t.subtype);
   controls.append(apply);edit.append(controls);
 };
 return edit;
}
function taskView(t,position){
 const article=node('article');const heading=node('div');heading.className='taskhead';const number=isExam()?position+1:t.type;
 article.dataset.position=position;article.dataset.type=t.type;
 heading.append(node('b',number?'№ '+number:'Архив'),node('span',(number!==t.type?'Тип № '+t.type+' · ':'')+topicName(t.type)));
 if(bankMode(currentMode)){
   if(isExam())heading.append(bankEditor(t,position));
   article.dataset.taskId=t.id;
   const body=originalBody(t);
   if(t.work)body.classList.add('statgrad-crop');
   article.append(heading,Object.assign(node('div',t.subtype),{className:'subtype-caption'}),body);
   const a=node('a',t.work?'СтатГрад '+t.work+' · работа и критерии ↗':'Оригинал в банке ФИПИ ↗');a.href=t.source;a.target='_blank';a.rel='noreferrer';article.append(a);
   if(hasOfficialAnswer(t)){
     const d=node('details');d.append(node('summary','Ответ'),node('strong','Ответ: '+formatAnswer(t)));
     if(t.answerSource){const ref=node('a','Источник ответа ↗');ref.href=t.answerSource;ref.target='_blank';ref.rel='noreferrer';d.append(node('br'),ref)}
     article.append(d);
   }else article.append(node('small',' · Ответ не загружен'));
   if(currentMode==='fipi'){
     const list=available(t.type,packetKeysOnly).filter(x=>!packetSubtype || x.subtype===packetSubtype), pos=list.indexOf(t);
     const nav=node('div');nav.className='analog browse';
     for(const [direction,label] of [[-1,'← Предыдущее'],[1,'Следующее →']]){
       const next=list[pos+direction];
       const b=button(label,()=>{
         $('mode').value='fipi';$('keys-only').checked=packetKeysOnly;configureTypes();
         $('type').value=String(t.type);configureOriginalSubtype(packetSubtype);$('original-choice').value=String(next.id);generate();
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
 $('title').textContent=isExam()?modes.find(([id])=>id===currentMode)[1]:currentMode==='fipi'?topicName(tasks[0].type):tasks[0].title;
 $('meta').textContent=currentMode==='statgrad'?'СтатГрад · сборка по номерам':bankMode(currentMode)?'Открытый банк ФИПИ':currentMode==='official'?'Материалы ФИПИ · адаптация условия':'Авторские аналоги · '+(currentMode==='exam'?'19 заданий':'задание № '+tasks[0].type);
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
 const jump=$('jump-list');jump.hidden=!isExam();
 jump.replaceChildren(...(isExam()?tasks.map((_,i)=>button(i+1,()=>{
   topicFilter.value='all';applyFilter();
   $('tasks').querySelector('.sheet:not([hidden]) [data-position="'+i+'"]').scrollIntoView({block:'start',behavior:'smooth'});
 })):[]));
 $('message').textContent='Открыт вариант '+(active+1)+' из '+sheets.length;
}
$('mode').onchange=configureTypes;$('type').onchange=()=>{$('mode').value==='fipi'?configureOriginalSubtype(''):configureFamily()};$('keys-only').onchange=configureTypes;$('subtype').onchange=chooseOriginal;$('generate').onclick=generate;$('print').onclick=()=>print();
for(const [id,title,description] of modes){
 const tab=button('',()=>{$('mode').value=id;configureTypes()});
 tab.dataset.mode=id;tab.append(node('strong',title),node('span',description));
 $('mode-cards').append(tab);
}
$('mode').value=officialIndex.size?'fipi-exam':'series';
configureTypes();counts();generate();
