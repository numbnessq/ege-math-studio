import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const browser = await chromium.launch({channel:'chrome'});
try {
  const page = await browser.newPage({viewport:{width:390,height:844}});
  const errors=[];
  page.on('pageerror', e=>errors.push(e.message));
  const response=await page.goto('https://numbnessq.github.io/ege-math-studio/');
  assert.equal(response.status(),200);
  await page.getByRole('heading',{name:'Конструктор вариантов'}).waitFor();
  await page.getByLabel('Что собрать').selectOption('official');
  await page.getByLabel('Номер задания').selectOption('10');
  await page.getByRole('button',{name:'Открыть задачу'}).click();
  await page.getByRole('button',{name:'Собрать 4 аналога'}).click();
  const prompts=[];
  for(let i=1;i<=4;i++){
    await page.getByRole('button',{name:'Вариант '+i,exact:true}).click();
    prompts.push(await page.locator('.sheet:visible article>p').innerText());
  }
  assert.equal(new Set(prompts).size,4);
  assert.equal(new Set(prompts.map(text=>text.replace(/\d+/g,'#'))).size,1);
  await page.getByLabel('Что собрать').selectOption('exam');
  await page.getByRole('button',{name:'Собрать комплект'}).click();
  const byPosition = Array.from({length:19},()=>[]);
  for(let i=1;i<=4;i++){
    await page.getByRole('button',{name:'Вариант '+i,exact:true}).click();
    const sheet=page.locator('.sheet:visible');
    assert.equal(await sheet.locator('h3').count(),2);
    assert.deepEqual(await sheet.locator('.taskhead b').allTextContents(),Array.from({length:19},(_,j)=>'№ '+(j+1)));
    (await sheet.locator('article>p').allTextContents()).forEach((t,j)=>byPosition[j].push(t));
    await sheet.locator('summary').last().click();
    assert.ok(await sheet.locator('details[open] strong').isVisible());
  }
  for(const group of byPosition){
    assert.equal(new Set(group).size,4);
    assert.equal(new Set(group.map(t=>t.replace(/[\d.,]+/g,'#'))).size,1);
  }
  const snapshot=()=>page.locator('.sheet').evaluateAll(sheets=>sheets.map(sheet=>
    Array.from(sheet.querySelectorAll('article'),a=>a.querySelector(':scope > p').textContent)));
  const before=await snapshot();
  const sheet=page.locator('.sheet:visible');
  const first=sheet.locator('article').first();
  assert.ok(await first.getByRole('img').isVisible());
  await first.getByText('Заменить задание').click();
  await first.getByLabel('Тема замены').selectOption('2');
  await first.getByRole('button',{name:'Применить к этому варианту'}).click();
  const after=await snapshot();
  assert.deepEqual(after.slice(0,3),before.slice(0,3));
  assert.deepEqual(after[3].slice(1),before[3].slice(1));
  assert.notEqual(after[3][0],before[3][0]);
  await page.locator('#topic-filter').selectOption('2');
  assert.equal(await sheet.locator('article:visible').count(),2);
  assert.equal(await page.locator('#answer-key').isVisible(),false);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  const expected=await page.locator('.sheet').evaluateAll(sheets=>sheets.map(sheet=>
    Array.from(sheet.querySelectorAll('article'),a=>[
      a.querySelector('.taskhead b').textContent,
      a.querySelector('details strong').textContent.replace(/^Ответ: /,'')
    ])));
  await page.emulateMedia({media:'print'});
  assert.equal(await page.locator('.sheet:visible article:visible').count(),76);
  assert.equal(await page.locator('article details:visible').count(),0);
  assert.ok(await page.locator('#tasks > :last-child#answer-key').isVisible());
  const keys=page.locator('#answer-key section');
  assert.equal(await keys.count(),4);
  for(let i=0;i<4;i++){
    assert.equal(await keys.nth(i).locator('h3').innerText(),'Вариант '+(i+1));
    assert.deepEqual(await keys.nth(i).locator('dl>div').evaluateAll(rows=>rows.map(row=>
      [row.querySelector('dt').innerText,row.querySelector('dd').innerText])),expected[i]);
  }
  await page.pdf({path:'teacher-print.pdf',format:'A4',margin:{top:'10mm',bottom:'10mm',left:'12mm',right:'12mm'}});
  const pdfPages=JSON.parse(execFileSync('python',['-c',
    'import pymupdf,json; print(json.dumps([p.get_text() for p in pymupdf.open("teacher-print.pdf")]))'
  ],{encoding:'utf8'}));
  const compact=s=>s.normalize('NFKC').replace(/\s+/gu,'');
  const tail=pdfPages.slice(-4);
  for(let i=0;i<4;i++){
    const expectedPage=(i===0?'Ответы для учителя':'')+'Вариант '+(i+1)+expected[i].flat().join('');
    assert.equal(compact(tail[i]),compact(expectedPage),'Содержимое страницы ключа '+(i+1));
  }
  await page.emulateMedia({media:'screen'});
  await page.locator('#mode').selectOption('fipi');
  await page.locator('#type').selectOption('2');
  await page.locator('#generate').click();
  const code=()=>page.locator('.sheet:visible .taskhead small').innerText();
  const firstId=await code();
  await page.getByRole('button',{name:'Следующее →'}).click();
  assert.notEqual(await code(),firstId);
  await page.locator('#mode').selectOption('fipi-exam');
  await page.locator('#keys-only').check();
  await page.locator('#generate').click();
  assert.equal(new Set(await page.locator('.sheet .taskhead small').allTextContents()).size,76);
  assert.ok((await page.locator('#answer-key dd').allTextContents()).every(s=>s.trim() && !s.startsWith('Ответ не загружен')));
  await page.emulateMedia({media:'print'});
  assert.equal(await page.locator('.original-body:visible').count(),76);
  assert.equal(await page.locator('#answer-key section:visible').count(),4);
  await page.pdf({format:'A4',path:'bank.pdf'});
  await page.emulateMedia({media:'screen'});
  await page.locator('#mode').selectOption('fipi');
  await page.locator('#type').selectOption('1');
  assert.equal(await page.locator('#subtype option').count(),10);
  await page.locator('#subtype').selectOption('Трапеция');
  assert.match(await page.locator('#math100-topics').getAttribute('href'),/1-5/);
  await page.locator('#generate').click();
  assert.equal(await page.locator('.sheet:visible .subtype-caption').innerText(),'Трапеция');
  await page.locator('#mode').selectOption('fipi-exam');
  await page.locator('#counts button').first().click();
  await page.locator('#exam-subtypes summary').click();
  await page.locator('#exam-subtype-list select[data-number="1"]').selectOption('Трапеция');
  await page.locator('#generate').click();
  assert.equal(await page.locator('.sheet:visible article').count(),19);
  assert.equal(await page.locator('.sheet:visible .subtype-caption').first().innerText(),'Трапеция');
  const originalTask=page.locator('.sheet:visible article').first();
  await originalTask.getByText('Заменить задание').click();
  await originalTask.getByLabel('Подтип замены').selectOption('Касательные и хорды');
  await originalTask.getByRole('button',{name:'Применить к этому варианту'}).click();
  assert.equal(await page.locator('.sheet:visible .subtype-caption').first().innerText(),'Касательные и хорды');
  await page.getByRole('link',{name:/Архив СтатГрада/}).click();
  await page.locator('#archive-year').selectOption('all');
  assert.equal(await page.locator('#archive-list li').count(),246);
  assert.deepEqual(errors,[]);
  console.log('Проверены замена темы, чертёж и 76 ответов на последних четырёх страницах PDF.');
} finally { await browser.close(); }
