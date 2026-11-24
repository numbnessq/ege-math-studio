import requests,bs4,json,collections
from urllib.parse import urljoin
u='https://webege.io/bank/ege-matematika-profil/2';r=requests.get(u,timeout=20);print('webege',r.status_code,len(r.content)); soup=bs4.BeautifulSoup(r.content,'html.parser')
for a in soup.find_all('a',href=True):
 if a.get_text(strip=True).lower().endswith('1c7454'):
  for p in list(a.parents)[:5]:
   print('node',p.name,p.attrs,'children',[(i.name,i.attrs) for i in p.find_all(recursive=False)][:10])
   if p.name=='article':print('end',str(p)[-2700:]);break
print('links',[(a.get_text(' ',strip=True)[:35],a.get('href')) for a in soup.select('a[href]')][-40:])
u='https://ege.kowalt.ru/data/matematika-profil/0448f1.json';o=requests.get(u,timeout=20).json(); print('double',str(o.get('answer'))[:500],str(o.get('final'))[:500])
