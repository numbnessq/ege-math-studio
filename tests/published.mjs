import { chromium } from 'playwright';
import assert from 'node:assert/strict';

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
  assert.deepEqual(errors,[]);
  console.log('Проверены 4 аналога и 4 варианта по 19 заданий на опубликованном сайте.');
} finally { await browser.close(); }
