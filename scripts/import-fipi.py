"""Снимок официального банка. pip install requests beautifulsoup4"""
import json
import math
import re
import time
from pathlib import Path
from urllib.parse import urljoin
import requests
from bs4 import BeautifulSoup

PROJECT = 'AC437B34557F88EA4115D2F374B0A07B'
BASE = 'https://ege.fipi.ru/'
BANK = BASE + 'bank/index.php?proj=' + PROJECT
QUESTION_PAGE = BASE + 'bank/questions.php'
SESSION = requests.Session()

def task_from_block(block, soup):
    qid = block['id'][1:].upper()
    cell = block.select_one('td.cell_0')
    guid = block.select_one('input[name="guid"]')
    if not re.fullmatch('[A-F0-9]{6}', qid) or cell is None:
        raise ValueError('Неизвестный формат карточки ' + qid)
    for tag in cell.find_all(True):
        if tag.name.startswith('m:'):
            tag.name = tag.name[2:]
        if tag.name == 'script':
            match = re.search(r"ShowPictureQ\w*\(\s*['\"]([^'\"]+)", tag.get_text(), re.I)
            if match:
                img = soup.new_tag('img', src=urljoin(BASE,match[1]), alt='Рисунок к заданию '+qid)
                tag.replace_with(img)
            else:
                tag.decompose()
            continue
        if tag.name == 'img' and tag.get('src'):
            tag['src'] = urljoin(BASE, tag['src'])
        for name in list(tag.attrs):
            if name not in {'src','alt','width','height','rowspan','colspan','display','displaystyle','linethickness','mathvariant','accent','stretchy','notation','open','close','separators','fence'}:
                del tag[name]
    info = soup.find(id='i'+block['id'][1:])
    codes = []
    if info:
        for row in info.select('tr'):
            label = row.select_one('.param-name')
            if label and 'КЭС' in label.get_text():
                codes = [d.get_text(' ',strip=True) for d in row.find_all('td')[-1].find_all('div')]
    return dict(id=guid['value'] if guid else qid, qid=qid, type=0,
                html=cell.decode_contents().strip(), text=cell.get_text(' ',strip=True),
                kes_codes=codes, answer=None, source=BANK+'&qid='+qid)

def collect():
    rows = {}
    total = None
    page = 0
    while True:
        response = SESSION.get(QUESTION_PAGE, params=dict(proj=PROJECT,page=page,pagesize=100), timeout=(10,40))
        response.raise_for_status()
        html = response.content.decode('cp1251', errors='replace')
        hit = re.search(r'setQCount\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)', html)
        if not hit:
            raise RuntimeError('В ответе ФИПИ отсутствует счётчик заданий: '+str(response.status_code))
        count, _, size = map(int, hit.groups())
        if size < 1 or count < 1 or total not in (None,count):
            raise RuntimeError('Изменился счётчик ФИПИ во время импорта')
        total = count
        soup = BeautifulSoup(html,'html.parser')
        for block in soup.select('div.qblock[id^=q]'):
            task = task_from_block(block, soup)
            if task['qid'] in rows:
                raise ValueError('Повторный QID '+task['qid'])
            rows[task['qid']] = task
        print('Страница',page+1,'получено',len(rows),'из',total)
        if page+1 >= math.ceil(total/size): break
        time.sleep(.6)
        page += 1
    if len(rows) != total: raise ValueError('Счётчик не совпал с числом уникальных карточек')
    return {'source':BANK,'total':total,'tasks':list(rows.values())}

if __name__ == '__main__':
    bank=collect()
    output=Path('data/fipi.js')
    tmp=output.with_suffix('.tmp')
    tmp.write_text('globalThis.fipiBank='+json.dumps(bank,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf8')
    tmp.replace(output)
