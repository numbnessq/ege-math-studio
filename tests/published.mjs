import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';

const browser=await chromium.launch({channel:'chrome'});
try {
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const errors=[];
  page.on('pageerror', e=>errors.push(e.message));
  for(let attempt=0;attempt<6;attempt++){
    await page.goto('https://numbnessq.github.io/ege-math-studio/?rev=shuffle1&attempt='+attempt);
    try { await page.locator('[data-mode="fipi-exam"]').waitFor({timeout:6500}); break; }
    catch (error) {
      console.log('Не загружены режимы',attempt,errors,await page.locator('script').evaluateAll(s=>s.map(x=>x.getAttribute('src'))));
      if(attempt===5)throw error;
    }
  }
  const mode=label=>page.getByRole('button',{name:new RegExp('^'+label)}).click();
  const tasks=()=>page.locator('.sheet:not([hidden]) article');
  const ids=()=>tasks().evaluateAll(nodes=>nodes.map(node=>node.dataset.taskId));
  const generate=()=>page.getByRole('button',{name:'Собрать варианты',exact:true}).click();
  await mode('ЕГЭ из банка ФИПИ');
  const initial=await ids();
  assert.equal(initial.length,19);
  await generate();
  assert.ok(initial.every(id=>typeof id==='string'));
  assert.notDeepEqual(await ids(),initial);
  await page.getByRole('button',{name:'1',exact:true}).last().click();
  const first=tasks().first();
  await first.getByText('Заменить задание').click();
  const choices=first.getByLabel('Задание',{exact:true});
  assert.ok((await choices.locator('option').allTextContents()).every(s=>s.includes(' · ')&&!/^[a-f0-9]{6}$/i.test(s)));
  const replacement=await choices.inputValue();
  await first.getByRole('button',{name:'Применить к этому варианту'}).click();
  assert.equal((await ids())[0],replacement);
  await mode('Микс СтатГрада');
  await page.locator('#counts button').filter({hasText:/^2$/}).click();
  await generate();
  assert.equal((await ids()).length,19);
  const sources=await tasks().locator('a').allTextContents();
  assert.ok(new Set(sources.filter(s=>s.startsWith('СтатГрад '))).size>=2);
  assert.ok(await tasks().first().locator('img').evaluate(img=>img.complete?img.naturalWidth>0:new Promise(resolve=>{img.onload=()=>resolve(img.naturalWidth>0);img.onerror=()=>resolve(false)})));
  const allIds=await page.locator('.sheet article').evaluateAll(nodes=>nodes.map(n=>n.dataset.taskId));
  assert.equal(new Set(allIds).size,38);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.emulateMedia({media:'print'});
  assert.equal(await page.locator('.sheet article:visible').count(),38);
  assert.equal(await page.locator('#answer-key section:visible').count(),2);
  await page.pdf({format:'A4',path:'statgrad-print.pdf'});
  const printed=execFileSync('python',['-c','import pymupdf; d=pymupdf.open("statgrad-print.pdf"); print(sum(len(p.get_images()) for p in d)); print(len(d))'],{encoding:'utf8'});
  assert.ok(Number(printed.split(/\s/)[0])>=38);
  assert.deepEqual(errors,[]);
  console.log('Проверены названия задач, замены, смешивание двух работ и PDF с изображениями.');
} finally { await browser.close(); }
