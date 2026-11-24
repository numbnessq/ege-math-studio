"""Import printable clips from public, watermarked Math100 previews."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import io
import json
import re

import pymupdf as fitz
import requests
from PIL import Image, ImageChops

DEST = Path('data/statgrad-img')
EXPECTED = list(range(1, 20))


def answer_table(page, label):
    if page is None:
        return {}
    for block in page.get_text('blocks'):
        lines = block[4].splitlines()
        for i, line in enumerate(lines):
            if line.strip().split()[:1] != [label]:
                continue
            cells = line.split()[1:]
            for more in lines[i+1:]:
                if re.fullmatch(r'\d{7}', more.strip()):
                    break
                cells.extend(more.split())
                if len(cells) >= 12:
                    break
            if len(cells) == 12 and all(re.fullmatch(r'-?|[-−]?\d+(?:[.,]\d+)?', x) for x in cells):
                return {i+1: x for i, x in enumerate(cells) if x not in ('','-')}
    # Some PDFs store each cell as its own block. Read the aligned row by coordinates.
    words = page.get_text('words')
    for label_word in (w for w in words if w[4] == label):
        cells = sorted((w for w in words if w[0]>label_word[2] and abs(w[1]-label_word[1]) < 2), key=lambda w:w[0])
        if len(cells)==12 and all(re.fullmatch(r'-|[-−]?\d+(?:[.,]\d+)?', w[4]) for w in cells):
            return {i+1: w[4] for i,w in enumerate(cells) if w[4]!='-'}
    return {}


def column_bounds(page, col):
    offset = page.rect.width * col / 2
    return offset


def extract(row):
    response = requests.get(row['viewer'], timeout=(12,25))
    response.raise_for_status()
    with fitz.open(stream=response.content, filetype='pdf') as doc:
        table = next((pg for pg in doc if 'Ответы на ' in pg.get_text()), None)
        end_page = table.number if table is not None else min(4,len(doc))
        markers = []
        columns = {}
        for page in list(doc)[:end_page]:
            if not 820 < page.rect.width < 860:
                raise ValueError('ожидалось два столбца формата A4')
            for col in (0,1):
                offset = column_bounds(page,col)
                key = (page.number,col)
                blocks = [b for b in page.get_text('blocks')
                          if 45 < b[1] < 542 and offset+44 < b[0] < offset+395]
                columns[key] = blocks
                candidates = (b for b in page.get_text('blocks')
                              if offset+12 < b[0] < offset+39 and 53 < b[1] < 540)
                for x,y,_,_,st,*_ in sorted(candidates,key=lambda b:b[1]):
                    if re.fullmatch(r'\d{1,2}[.]?',st.strip()):
                        num = int(st.strip().rstrip('.'))
                        if num == len(markers)+1:
                            markers.append((key,y,num))
                            if num==19:
                                break
                if len(markers)==19:
                    break
            if len(markers)==19:
                break
        if [m[2] for m in markers] != EXPECTED:
            raise ValueError(f'опознано {len(markers)} заданий')
        answers = answer_table(table,row['label'])
        results = []
        for i,(key,y,num) in enumerate(markers):
            next_key,next_y,_ = markers[i+1] if i+1<len(markers) else (key,542,0)
            clips = [(key,y-6,next_y-6 if next_key==key else 541)]
            if next_key!=key:
                # Include a continuation only when that column starts with condition text.
                continuation = [b for b in columns[next_key] if 52<b[1]<next_y-9]
                if continuation and not any('задани' in b[4][:150].lower() and ('ответ' in b[4][:150].lower() or 'лист' in b[4][:150].lower()) for b in continuation):
                    clips.append((next_key,54,next_y-6))
            html = []
            condition = []
            for part,((page_no,col),top,bottom) in enumerate(clips):
                page = doc[page_no]
                offset = column_bounds(page,col)
                relevant = [b for b in columns[page_no,col] if top<=b[1]<bottom]
                if not relevant:
                    continue
                if bottom-top < 18:
                    raise ValueError(f'пустая область № {num}')
                path = DEST / f"{row['label']}-{num}-{part}.jpg"
                rect = fitz.Rect(offset+49,top,offset+397,bottom)
                pix = page.get_pixmap(matrix=fitz.Matrix(2,2),clip=rect,alpha=False)
                picture = Image.frombytes('RGB',(pix.width,pix.height),pix.samples)
                mask = ImageChops.difference(picture,Image.new('RGB',picture.size,'white'))
                bounds = mask.getbbox()
                if bounds:
                    picture = picture.crop((0,0,pix.width,min(pix.height,bounds[3]+10)))
                encoded = io.BytesIO()
                picture.save(encoded,format='JPEG',quality=89,optimize=True)
                html.append((path,encoded.getvalue()))
                condition.extend(b[4] for b in relevant if b[1]<bottom and not b[4].lstrip().startswith('Ответ:'))
            if not html:
                raise ValueError(f'пустое условие № {num}')
            plain = ' '.join(re.sub(r'[\x00-\x1f]+',' ',s).strip() for s in condition)
            task = dict(id=f"{row['label']}-{num}", type=num, work=row['label'],
                        source=row['url'], answer=answers.get(num), text=plain,
                        html=''.join(f'<img src="{p.as_posix()}" alt="Условие № {num}, СтатГрад {row["label"]}">' for p,_ in html))
            results.append((task,html))
        return results


def main():
    raw = Path('data/statgrad.js').read_text(encoding='utf8')
    catalog = json.loads(raw.split('=',1)[1].strip().rstrip(';'))
    rows = [r for r in catalog if '2025-09-01'<=r['date']<'2026-07-01' and r.get('viewer')]
    DEST.mkdir(exist_ok=True)
    tasks = []
    def collect(row):
        try:
            result=extract(row)
            print(row['label'],len(result),'заданий,',sum(t['answer'] is not None for t,_ in result),'ответов')
            return result
        except Exception as error:
            print(row['label'],error)
            return []
    with ThreadPoolExecutor(max_workers=4) as pool:
        for result in pool.map(collect,rows):
            for task,images in result:
                for path,content in images:
                    path.write_bytes(content)
                tasks.append(task)
    if len(tasks)<19*4:
        raise SystemExit('Недостаточно полных работ')
    Path('data/statgrad-tasks.js').write_text('globalThis.statgradTasks = '+json.dumps(tasks,ensure_ascii=False)+';\n',encoding='utf8')
    print('Импортировано:',len(tasks))


if __name__ == '__main__':
    main()
