"""밴픽 사이트 완성본(js)에서 챔피언 표와 조합 유형 목록을 꺼내 champs.json으로 저장.

사용: py -3 champs.py <index-xxxx.js 경로>
사이트의 챔피언 특성(Community Dragon 기반)을 그대로 써서 사이트와 같은 기준으로 상성 설명을 만든다.
"""
import json, re, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent


def parse(js):
    i = js.find('Aatrox|')
    st = js.rfind('"', 0, i)
    en = js.find('"', i)
    out = {}
    for row in js[st + 1:en].split(';'):
        t = row.split('|')
        if len(t) < 6:
            continue
        r = t[5]
        out[t[0]] = {
            'name': t[1], 'tags': t[2], 'pos': list(t[3].replace('*', '')),
            'dmg': t[4][0], 'ranged': t[4][1] == 'R',
            'd': int(r[0]), 'u': int(r[1]), 'c': int(r[2]), 'm': int(r[3]), 'ut': int(r[4]),
        }
    groups = {}
    for k in ('engage', 'teamfight', 'dive', 'pick', 'poke', 'split', 'protect'):
        m = re.search(k + r':\[((?:"[A-Za-z]+",?)+)\]', js)
        if m:
            groups[k] = re.findall(r'"([A-Za-z]+)"', m.group(1))
    return out, groups


def main():
    js = Path(sys.argv[1]).read_text(encoding='utf-8')
    champs, groups = parse(js)
    if len(champs) < 100:
        raise SystemExit('champion table not found')
    for k, ids in groups.items():
        for c in ids:
            if c in champs:
                champs[c].setdefault('groups', []).append(k)
    (HERE / 'champs.json').write_text(json.dumps(champs, ensure_ascii=False, indent=0), encoding='utf-8')
    print(len(champs), 'champions,', ', '.join(f'{k} {len(v)}' for k, v in groups.items()))


if __name__ == '__main__':
    main()
