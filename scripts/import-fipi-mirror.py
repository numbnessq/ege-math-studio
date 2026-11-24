"""Импорт всех публичных карточек снимка ФИПИ на KOWALT, без разбора решений."""
import concurrent.futures
import json
import re
import threading
from datetime import date
from pathlib import Path
from urllib.parse import urljoin, urlparse
import requests
from bs4 import BeautifulSoup
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

HOST = 'https://ege.kowalt.ru'
SUBJECT = '/matematika-profil/'
OFFICIAL = 'https://ege.fipi.ru/bank/index.php?proj=AC437B34557F88EA4115D2F374B0A07B'
DATA = '/data/matematika-profil/'
local = threading.local()

def get(path, optional=False):
    if not hasattr(local, 'session'):
        local.session = requests.Session()
        local.session.mount('https://', HTTPAdapter(max_retries=Retry(total=3, backoff_factor=.5,status_forcelist=[429,500,502,503,504])))
    url = urljoin(HOST,path)
    if urlparse(url).netloc != urlparse(HOST).netloc: raise ValueError('Некорректный хост источника')
    response = local.session.get(url, timeout=(12,30))
    if optional and response.status_code==404: return None
    response.raise_for_status()
    return response

def page_urls():
    page=SUBJECT+'bank/'
    expected=None
    found={}
    visited=set()
    while page and page not in visited:
        visited.add(page)
        soup=BeautifulSoup(get(page).content,'html.parser')
        if expected is None:
            expected=int(re.search(r'(\d+)\s+задани',soup.select_one('main').get_text(' ',strip=True))[1])
        page=None
        for link in soup.select('main a[href]'):
            u=link['href']
            hit=re.fullmatch(SUBJECT+r'problem/([0-9a-fA-F]{6})/',u)
            if hit: found[hit[1].upper()] = u
            if 'Далее' in link.get_text(): page=u
    assert expected==len(found), (expected,len(found))
    return found

def tidy(fragment, qid):
    soup=BeautifulSoup(fragment,'html.parser')
    for tag in soup.find_all(['script','style','source','annotation','annotation-xml']): tag.decompose()
    for tag in soup.find_all(True):
        for name in list(tag.attrs):
            if name not in {'src','alt','width','height','rowspan','colspan','display','displaystyle','linethickness','mathvariant','accent','stretchy','notation','open','close','separators','fence'}:
                del tag.attrs[name]
    assets={}
    for img in soup.select('img'):
        u=urljoin(HOST,img.get('src',''))
        path=urlparse(u).path
        if urlparse(u).netloc!=urlparse(HOST).netloc or not re.fullmatch(r'/img/[\w.-]+',path):
            raise ValueError('Неизвестный рисунок '+u)
        dest='data/fipi-img/'+path.rsplit('/',1)[1]
        img['src']=dest
        img['alt']='Рисунок к заданию '+qid
        assets[dest]=u
    return str(soup),soup.get_text(' ', strip=True),assets

def extra(qid_url):
    qid,url=qid_url
    res=get(DATA+qid.lower()+'.json',optional=True)
    if res is not None:
        j=res.json()
        if j.get('statement'):
            return {'id':qid,'statement':j['statement'],'slot':j.get('slot') or 0}
    soup=BeautifulSoup(get(url).content,'html.parser')
    stmt=soup.select_one('article.task .sheet, .statement, .task__statement, .task-body, [itemprop="text"]')
    if not stmt:
        raise ValueError('Не найден блок условия '+qid+' | '+str([(e.name,e.attrs) for e in soup.select('main div,main article,main section')][:22]))
    return {'id':qid,'statement':stmt.decode_contents(),'slot':0}

def download_asset(entry):
    dest,url=entry
    res=get(url)
    if not res.headers.get('Content-Type','').startswith('image/'): raise ValueError('Нет изображения '+url)
    Path(dest).write_bytes(res.content)

def main():
    urls=page_urls()
    print('Уникальных QID в каталоге',len(urls))
    source={}
    for n in range(1,20):
        group=get('/data/worksheets/matematika-profil/'+str(n)+'.json').json()
        for task in group: source[task['id'].upper()]=task
    print('Нумерованных условий',len(source))
    missing=[item for item in urls.items() if item[0] not in source]
    with concurrent.futures.ThreadPoolExecutor(5) as pool:
        for i,item in enumerate(pool.map(extra,missing)):
            source[item['id'].upper()]=item
            if i%50==0: print('Добавлено',i+1,'из',len(missing))
    if set(source)!=set(urls): raise ValueError('Состав каталога изменился при загрузке')
    tasks=[]
    assets={}
    for qid in urls:
        row=source[qid]
        html,text,images=tidy(row['statement'],qid)
        assert text or images, qid
        assets.update(images)
        tasks.append(dict(id=qid,qid=qid,type=int(row.get('slot') or 0),html=html,text=text,kes_codes=[],answer=None,source=OFFICIAL+'&qid='+qid))
    img=Path('data/fipi-img')
    img.mkdir(exist_ok=True)
    with concurrent.futures.ThreadPoolExecutor(5) as pool:
        list(pool.map(download_asset,assets.items()))
    packet=dict(total=len(tasks),source=OFFICIAL,mirror=urljoin(HOST,SUBJECT+'bank/'),date=str(date.today()),tasks=tasks)
    dest=Path('data/fipi.js')
    tmp=dest.with_suffix('.tmp')
    tmp.write_text('globalThis.fipiBank='+json.dumps(packet,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf8')
    tmp.replace(dest)
    print('Готово:',len(tasks),'карточек,',len(assets),'уникальных рисунков')

if __name__=='__main__': main()
