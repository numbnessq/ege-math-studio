import requests,bs4,json,re
base='https://ege.kowalt.ru'
for url in ['/matematika-profil/zadanie-1/','/js/ege-catalog.js','/js/ege.js','/matematika-profil/problem/40b442/reshenie/','/matematika-profil/bank/']:
 r=requests.get(base+url,timeout=16);r.encoding='utf-8'
 soup=bs4.BeautifulSoup(r.text,'html.parser')
 print(url,r.status_code,[(p[:350]) for p in re.findall(r'[^<>\n]{0,85}(?:\.json\b|\.json\?|data-ege|data-src|data-api|data-bank)[^<>\n]{0,140}',r.text)][:45])
 if 'reshenie' in url:print([(str(x)[:500]) for x in soup.select('[class*=answer], [class*=result],script[type="application/ld+json"]')][:10])
 if 'bank/' in url:print([(x.get('href'),x.get_text(' ',strip=True)) for x in soup.select('a[href]')][-20:])
