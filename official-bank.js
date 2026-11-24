'use strict';
// Финальный номер в подборке и шестизначный код карточки ФИПИ — разные поля.
// Резервная классификация по условию и КЭС для нумерации из 19 заданий.
function classifyFipi(text, codes = []) {
  const s = text.toLowerCase().replace(/ё/g, 'е');
  const kes = codes.map(c => String(c).trim().split(/\s/)[0]);
  const has = prefix => kes.some(c => c === prefix || c.startsWith(prefix + '.'));
  const multiple = /б\s*\)/.test(s);
  if (has('2.10') || /найдите все значения.{0,18}(при|кажд|котор|параметр)/.test(s)) return 18;
  if (/решите (?:систему )?неравенств/.test(s)) return 15;
  if (/решите уравнение/.test(s) && multiple) return 13;
  if (/кредит|вклад планируется|погашен|ценными бумагами|строительство нового завода/.test(s)) return 16;
  if (has('7.5') || /вектора|векторы|векторов/.test(s)) return 2;
  if (has('7') || /треугольник|трапеци|окружност|параллелограмм|пирамид|призм|цилиндр|конус|шар |куб[аеу]? |параллелепипед|тетраэдр|многогранник|четырехугольник/.test(s) && !/вероятност|по формуле/.test(s)) {
    const solid = has('7.2') || has('7.3') || has('7.4') || /пирамид|призм|цилиндр|конус|многогранник|параллелепипед|куб[аеу]? |тетраэдр|шар |сфер/.test(s);
    return solid ? (multiple ? 14 : 3) : (multiple ? 17 : 1);
  }
  if (multiple) return 19;
  if (has('6') || /найдите вероятность/.test(s)) {
    return /два одинаковых автомата|контрольное взвешивание|стрелок|фломастер|при этом условии|изготавливает батарейки|лампами|больше четырех задач|температура тела|ежедневно ходит автобус/.test(s) ? 5 : 4;
  }
  if (/найдите корень|решите уравнение/.test(s)) return 6;
  if (/найдите значение выражения|вычислите/.test(s) || has('1.8') || has('1.5')) return 7;
  if (has('4') || /производн|касательн|точку (?:максимума|минимума)|наи(?:меньшее|большее) значение функции|оси абсцисс отмечен/.test(s)) return /на рисунке|изображен/.test(s) ? 8 : 12;
  if (has('3.1') || has('3.3') || has('3.5') || /изображен.{0,6}график/.test(s)) return 11;
  if (/при адиабатическом|закон стефана|начал торможение|по формуле|по закону|выражается|описывается|определяется (?:из |уравнением|соотношением)|сопротивлени|теплоемкост/.test(s) || has('2.5')) return 9;
  if (/производительност|скорост|работ|сплав|раствор|теплоход|велосипедист|пешеход|километр|детал|турист|первая труба пропускает/.test(s)) return 10;
  return 0;
}

function makeOfficialIndex(rows, mapping = {}) {
  const byType = new Map();
  for (const item of rows) {
    const ref = mapping[String(item.qid).toUpperCase()] || {};
    const reviewed = { '4B912B':7, 'E9862E':12, '7CC260':18, 'BE1DDB':8 };
    const type = ref.type || item.type || reviewed[item.qid] || classifyFipi(item.text || '', item.kes_codes || []);
    const task = {...item, type, answer: ref.answer ?? item.answer ?? null,
      answerSource: ref.answerSource || ref.source || item.answerSource, original: true};
    task.subtype = taskSubtype(task, ref.subtopic);
    if (!byType.has(type)) byType.set(type, []);
    byType.get(type).push(task);
  }
  return byType;
}

function officialSheets(byType, count, keysOnly, random = Math.random, subtypes = new Map()) {
  const result = Array.from({length: count}, () => []);
  for (let n = 1; n <= 19; n++) {
    const pool = (byType.get(n) || []).filter(t => !keysOnly || hasOfficialAnswer(t));
    const subtype = subtypes.get(n);
    if (subtype) pool.splice(0, pool.length, ...pool.filter(t => t.subtype === subtype));
    if (pool.length < count) throw Error('Для № ' + n + ' доступно ' + pool.length +
      ' заданий. Измените подтип, число вариантов или фильтр ответов.');
    for (const sheet of result) {
      sheet.push(pool.splice(Math.floor(random() * pool.length), 1)[0]);
    }
  }
  return result;
}

function hasOfficialAnswer(task) {
  return task.answer != null && String(task.answer).trim() !== '';
}

function officialCode(t) { return t.qid || t.id; }

function originalBody(t) {
  const body = document.createElement('div');
  body.className = 'original-body';
  const source = document.createElement('template');
  source.innerHTML = t.html || '';
  const htmlTags = new Set('p div span b strong i em u br sub sup ul ol li table tbody thead tr td th img'.split(' '));
  const mathTags = new Set('math semantics mrow mi mn mo mtext mfrac msqrt mroot msub msup msubsup munder mover munderover mtable mtr mtd mstyle mfenced menclose mpadded mspace mmultiscripts mprescripts none'.split(' '));
  function append(parent, child) {
    if (child.nodeType === 3) { parent.append(child.textContent); return; }
    if (child.nodeType !== 1) return;
    const tag = child.localName.toLowerCase();
    if (['script','style','annotation','annotation-xml'].includes(tag)) return;
    let el = parent;
    if (mathTags.has(tag) || htmlTags.has(tag)) {
      el = mathTags.has(tag) ? document.createElementNS('http://www.w3.org/1998/Math/MathML',tag) : document.createElement(tag);
      for (const attr of ['rowspan','colspan','mathvariant','displaystyle','stretchy','accent','fence','open','close','separators','notation','linethickness','width','height']) {
        if (child.hasAttribute(attr)) el.setAttribute(attr,child.getAttribute(attr));
      }
      if (tag === 'img') {
        const raw = child.getAttribute('src') || '';
        if (!raw || !(/^(?:\.\/)?data\/[\w./%()-]+$/i.test(raw) || /^https:\/\//i.test(raw))) return;
        el.src = raw;
        el.alt = child.getAttribute('alt') || 'Рисунок к заданию ' + officialCode(t);
        el.addEventListener('error',()=>{el.replaceWith(document.createTextNode('Рисунок недоступен. Откройте оригинал задания.'));},{once:true});
      }
      parent.append(el);
    }
    for (const part of child.childNodes) append(el, part);
  }
  for (const child of source.content.childNodes) append(body, child);
  if (!body.hasChildNodes()) body.textContent = t.text || '';
  return body;
}
