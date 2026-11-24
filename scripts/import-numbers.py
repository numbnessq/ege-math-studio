import requests,concurrent.futures
host='https://ege.kowalt.ru/data/'
def peek(path):
 try:
  r=requests.get(host+path,timeout=12); data=r.json()
  if isinstance(data,dict):
   print(path,list(data)[:30],[(k,str(v)[:450]) for k,v in list(data.items())[:15]])
  else: print(path,len(data),str(data[:1])[:2000])
 except Exception as e:print(path,str(e))
list(concurrent.futures.ThreadPoolExecutor(3).map(peek,['matematika-profil.json','catalog/matematika-profil/1.json','worksheets/matematika-profil/1.json','matematika-profil/40b442.json','catalog/matematika-profil/19.json']))
