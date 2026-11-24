import concurrent.futures
import json
import re
import time
from pathlib import Path
from urllib.parse import urlsplit
from urllib.request import Request, urlopen
from html.parser import HTMLParser

class ViewerParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.viewer = None
    def handle_starttag(self, tag, attrs):
        if tag not in {'iframe', 'a', 'object', 'embed'}: return
        for name, value in attrs:
            if name not in {'src', 'href', 'data', 'data-src'} or not value: continue
            url = urlsplit(value)
            if url.scheme == 'https' and url.hostname == 'pdf.math100.ru' and re.fullmatch(r'/pdf/[0-9a-fA-F-]{36}/wm\.pdf',url.path):
                self.viewer = value

def inspect(row):
    try:
        request = Request(row['url'], headers={'User-Agent':'EGE Math Studio public catalog (+https://github.com/numbnessq/ege-math-studio)'})
        with urlopen(request, timeout=10) as result:
            page = result.read().decode('utf-8','replace')
        parser = ViewerParser()
        parser.feed(page)
        if parser.viewer: row['viewer']=parser.viewer
        time.sleep(.3)
        return row, 'ok'
    except Exception as err:
        return row, str(err)[:100]

path = Path('data/statgrad.js')
rows = json.loads(path.read_text().split('globalThis.statgradArchive = ',1)[1].strip().removesuffix(';'))
first,status=inspect(rows[0])
print('First article',status,first.get('viewer','none'),flush=True)
if status!='ok': raise SystemExit('Source unreachable')
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
    results = list(pool.map(inspect, rows[1:]))
rows = [first]+[row for row,_ in results]
errors = [err for _,err in results if err!='ok']
print('Works:',len(rows),'preview links:',sum('viewer' in row for row in rows),'errors:',len(errors),errors[:3],flush=True)
assert len(rows)==len(set(r['url'] for r in rows))
path.write_text('// Метаданные публичного архива https://math100.ru/egeprofil-statgrad/\nglobalThis.statgradArchive = [\n  '+',\n  '.join(json.dumps(row,ensure_ascii=False,separators=(',',':')) for row in rows)+'\n];\n')
