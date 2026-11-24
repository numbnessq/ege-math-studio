import json, requests, pymupdf as pdf
from pathlib import Path
catalog=json.loads(Path('data/statgrad.js').read_text().split('=',1)[1].strip().rstrip(';'))
for row in [catalog[0],catalog[4]]:
 try:
  response=requests.get(row['viewer'],timeout=12); response.raise_for_status()
  doc=pdf.open(stream=response.content)
  print(row['label'],len(doc))
  for page in doc:
   print('PAGE',page.number,[(round(b[0]),round(b[1]),' '.join(b[4].split())[:85]) for b in page.get_text('blocks')][:30])
 except Exception as e: print(type(e).__name__,e)
