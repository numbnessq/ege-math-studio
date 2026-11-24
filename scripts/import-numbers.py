import requests,bs4,concurrent.futures,urllib.parse
def probe(url):
 try:
  r=requests.get(url,timeout=15); soup=bs4.BeautifulSoup(r.content,'html.parser')
  return (url,r.status_code,len(r.content),[str(s)[:300] for s in soup.find_all('script')][:30],[(a.get_text(' ',strip=True)[:50],a.get('href')) for a in soup.find_all('a',href=True) if '40b442' in str(a).lower() or 'все задания №' in a.get_text(' ',strip=True).lower()][:10],[(c.get('class'),c.get_text(' ',strip=True)[:160]) for c in soup.select('[class*=answer], [class*=pagination], [id*=load]')][:10])
 except Exception as e:return str(e)
for r in concurrent.futures.ThreadPoolExecutor(3).map(probe,['https://ege.kowalt.ru/matematika-profil/','https://ege.kowalt.ru/matematika-profil/problem/40b442/','https://ege.kowalt.ru/matematika-profil/zadanie-1/']):print(r)
