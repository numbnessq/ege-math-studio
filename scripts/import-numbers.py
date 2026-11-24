"""Обновляет номера и ответы по открытым карточкам каталога KOWALT.

Запуск: python scripts/import-numbers.py (требуется requests).
Ответы к развёрнутым задачам являются ключами KOWALT. В банк записывается
только итог, без текстов решения. Прерванный импорт сохраняет старый файл.
"""
from concurrent.futures import ThreadPoolExecutor
from collections import Counter
from pathlib import Path
import json
import re
import threading
import time

import requests

BASE = 'https://ege.kowalt.ru'
SUBJECT = 'matematika-profil'
sessions = threading.local()


def get_json(path):
    if not hasattr(sessions, 'http'):
        sessions.http = requests.Session()
        sessions.http.headers['User-Agent'] = 'ege-math-studio/1.0 (public exam index)'
    for attempt in range(3):
        try:
            response = sessions.http.get(BASE + path, timeout=20)
            response.raise_for_status()
            return response.json()
        except requests.RequestException:
            if attempt == 2:
                raise
            time.sleep(2 ** attempt)


def catalog(slot):
    rows = get_json(f'/data/catalog/{SUBJECT}/{slot}.json')
    assert rows and all(row['slot'] == slot for row in rows), slot
    return rows


def answer_for(row):
    slug = row['slug']
    assert re.fullmatch('[a-fA-F0-9]{6}', slug)
    obj = get_json(f'/data/{SUBJECT}/{slug}.json')
    assert obj['id'].upper() == row['id'].upper() and obj['slot'] == row['slot']
    answer = obj.get('answer')
    if answer is None or answer == '':
        answer = obj.get('final')
    if not isinstance(answer, (str, float, int)):
        answer = None
    else:
        answer = str(answer).strip() or None
    entry = {'type': row['slot'], 'subtopic': row['title']}
    if answer is not None:
        entry.update(answer=answer, answerSource=f'{BASE}/{SUBJECT}/problem/{slug}/reshenie/')
    return row['id'].upper(), entry


def main():
    with ThreadPoolExecutor(max_workers=4) as pool:
        rows = [row for group in pool.map(catalog, range(1, 20)) for row in group]
        entries = dict(pool.map(answer_for, rows))
    assert len(entries) == len(rows) and set(v['type'] for v in entries.values()) == set(range(1,20))
    result = Path('data/exam-numbers.js')
    tmp = result.with_suffix('.tmp')
    lines = [json.dumps(k) + ':' + json.dumps(v, ensure_ascii=False, separators=(',', ':')) for k,v in sorted(entries.items())]
    tmp.write_text('globalThis.examNumbers = {\n' + ',\n'.join(lines) + '\n};\n', encoding='utf-8')
    tmp.replace(result)
    print('Всего:',len(entries),'с ответами:',sum('answer' in v for v in entries.values()))
    print('Ответов по номерам:', sorted(Counter(v['type'] for v in entries.values() if 'answer' in v).items()))
    print('Образцы части 2:',[(k,v['answer'][:110]) for k,v in entries.items() if v['type']>=13 and 'answer' in v][:4])


if __name__ == '__main__':
    main()
