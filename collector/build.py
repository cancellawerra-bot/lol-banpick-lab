"""모은 경기(데이터/matches.jsonl) + 챔피언 특성(champs.json) → 사이트용 matchups.json.

사용: py -3 build.py [--patches 2] [--min 30] [--out matchups.json]
- 같은 라인에서 맞붙은 두 챔피언의 승·판 수·15분 골드 차이를 센다 (숫자, 1번 방법).
- 챔피언 특성으로 왜 유리·불리한지 초보용 한 줄 이유를 붙인다 (유형 상성, 4번 방법).
- 판 수가 --min 미만이면 숫자 판정 대신 특성으로 본 '예상'만 준다.
"""
import argparse, json, time
from collections import defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parent
LANES = 'TJMAS'
LANE_KO = {'T': '탑', 'J': '정글', 'M': '미드', 'A': '원딜', 'S': '서포터'}

# 유형 상성 이유. 코드 → 초보용 문장 (내 챔피언 입장). +는 유리, -는 불리.
REASONS = {
    'range+': '내가 원거리라 라인전 초반에 상대를 견제하기 좋아요.',
    'range-': '상대가 원거리라 라인전 초반에 견제를 받기 쉬워요. 무리하게 다가가지 말고 미니언을 챙기세요.',
    'poke-': '상대가 멀리서 체력을 깎는 챔피언이에요. 스킬을 피하고 체력이 낮으면 일찍 귀환하세요.',
    'poke+': '내가 멀리서 체력을 깎는 챔피언이라, 상대가 다가오기 전에 먼저 깎아 둘 수 있어요.',
    'cc-': '상대에게 묶거나 기절시키는 기술이 많아요. 깊이 들어가면 잡히기 쉬우니 그 기술이 빠졌을 때 싸우세요.',
    'cc+': '내 묶기·기절 기술로 상대의 돌진을 끊을 수 있어요.',
    'squishy+': '상대가 도망 기술이 적고 몸이 약해서, 기습하면 잡기 좋아요.',
    'squishy-': '내가 도망 기술이 적고 몸이 약해요. 상대 기습을 조심하고 시야(와드)를 먼저 확보하세요.',
    'tank-': '상대가 아주 단단해서 라인전에서 쓰러뜨리기 어려워요. 무리한 싸움보다 미니언 챙기기에 집중하세요.',
    'tank+': '내가 단단해서 상대 공격을 버티기 쉬워요.',
    'engage+': '상대 서포터가 약해서 내가 먼저 싸움을 걸기 좋아요.',
    'engage-': '상대 서포터가 먼저 싸움을 걸어오는 유형이에요. 원딜과 함께 상대 기술을 피하는 데 집중하세요.',
}


def melee(c):
    return not c['ranged']


def type_reasons(a, b, lane):
    """내 챔피언 a가 상대 b를 lane에서 만났을 때의 유형 이유 코드 목록 (최대 3개)."""
    r = []
    if lane in 'TMS':
        if melee(a) and b['ranged']:
            r.append('range-')
        elif a['ranged'] and melee(b):
            r.append('range+')
    ga, gb = a.get('groups', []), b.get('groups', [])
    if 'poke' in gb and 'poke' not in ga and melee(a):
        r.append('poke-')
    if 'poke' in ga and 'poke' not in gb and melee(b):
        r.append('poke+')
    if b['c'] >= 3 and a['m'] >= 3 and melee(a):
        r.append('cc-')
    if a['c'] >= 3 and b['m'] >= 3 and melee(b):
        r.append('cc+')
    if ('A' in a['tags'] or a['m'] >= 3) and a['d'] >= 3 and b['u'] <= 1 and b['m'] <= 1:
        r.append('squishy+')
    if ('A' in b['tags'] or b['m'] >= 3) and b['d'] >= 3 and a['u'] <= 1 and a['m'] <= 1:
        r.append('squishy-')
    if lane in 'TJ' and b['u'] >= 3 and a['d'] <= 2 and a['u'] <= 2:
        r.append('tank-')
    if lane in 'TJ' and a['u'] >= 3 and b['d'] <= 2 and b['u'] <= 2:
        r.append('tank+')
    if lane == 'S':
        if a['c'] >= 3 and b['u'] <= 1 and b['ut'] >= 3:
            r.append('engage+')
        if b['c'] >= 3 and a['u'] <= 1 and a['ut'] >= 3:
            r.append('engage-')
    # 유리·불리가 서로 상쇄되지 않도록 강한 것부터, 3개까지
    return r[:3]


def type_guess(codes):
    # 암살자가 도망 못 가는 상대를 만나는 건 사거리 불리보다 크게 친다
    s = sum((2 if c.startswith('squishy') else 1) * (1 if c.endswith('+') else -1) for c in codes)
    return '유리' if s >= 1 else '불리' if s <= -1 else '비슷'


def norm_map(champs):
    low = {k.lower(): k for k in champs}
    return lambda n: n if n in champs else low.get(n.lower(), n)


def count(rows, fix):
    # stat[lane][a][b] = [승, 판, 골드차 합, 골드차 판]
    stat = {l: defaultdict(lambda: defaultdict(lambda: [0, 0, 0, 0])) for l in LANES}
    for m in rows:
        side = defaultdict(dict)
        for x in m['p']:
            team, pos, ch, win, gold = x[:5]
            side[pos][team] = (fix(ch), win, gold)
        for pos, t in side.items():
            if 100 not in t or 200 not in t:
                continue
            for (x, wx, gx), (y, _, gy) in ((t[100], t[200]), (t[200], t[100])):
                s = stat[pos][x][y]
                s[0] += wx
                s[1] += 1
                if gx is not None and gy is not None:
                    s[2] += gx - gy
                    s[3] += 1
    return stat


def judge(w, n, gd, min_n):
    if n < min_n:
        return None
    wr = (w + 3) / (n + 6)  # 사이트와 같은 소표본 보정
    if wr >= 0.53 or (wr >= 0.51 and gd is not None and gd >= 250):
        return '유리'
    if wr <= 0.47 or (wr <= 0.49 and gd is not None and gd <= -250):
        return '불리'
    return '비슷'


def build(rows, champs, min_n=30):
    fix = norm_map(champs)
    stat = count(rows, fix)
    lanes = {}
    for l in LANES:
        lanes[l] = {}
        for a, opp in stat[l].items():
            row = {}
            for b, (w, n, gs, gn) in opp.items():
                gd = round(gs / gn) if gn else None
                codes = type_reasons(champs[a], champs[b], l) if a in champs and b in champs else []
                v = judge(w, n, gd, min_n)
                e = {'w': w, 'n': n}
                if gd is not None:
                    e['gd15'] = gd
                if v:
                    e['v'] = v
                else:
                    e['guess'] = type_guess(codes)
                if codes:
                    e['why'] = codes
                row[b] = e
            lanes[l][a] = dict(sorted(row.items(), key=lambda kv: -kv[1]['n']))
    return lanes


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--data', default=str(HERE / '데이터' / 'matches.jsonl'))
    ap.add_argument('--patches', type=int, default=2, help='최근 몇 개 패치만 쓸지')
    ap.add_argument('--min', type=int, default=30, help='숫자로 판정할 최소 판 수')
    ap.add_argument('--out', default=str(HERE / 'matchups.json'))
    a = ap.parse_args()
    champs = json.loads((HERE / 'champs.json').read_text(encoding='utf-8'))
    rows = list({r['id']: r for r in (json.loads(x) for x in open(a.data, encoding='utf-8'))}.values())  # 같은 경기 두 번 저장된 것은 하나만
    vers = sorted({r['v'] for r in rows}, key=lambda v: tuple(map(int, v.split('.'))))[-a.patches:]
    rows = [r for r in rows if r['v'] in vers]
    if not rows:
        raise SystemExit('경기 데이터가 없습니다. 먼저 데이터_모으기를 실행하세요.')
    lanes = build(rows, champs, a.min)
    shown = lambda v: f'{int(v.split(".")[0]) + 10}.{v.split(".")[1]}'  # 게임 버전 16.22 = 패치 26.22
    out = {
        'meta': {
            'source': 'Riot Games API (match-v5), 한국 서버 솔로 랭크',
            'tiers': sorted({r['t'] for r in rows}),
            'patches': [shown(v) for v in vers],
            'games': len(rows),
            'min_n': a.min,
            'made': time.strftime('%Y-%m-%d'),
            'lanes': LANE_KO,
            'note': 'w/n = 내 챔피언 승/판, gd15 = 15분 골드 차이(나-상대), v = 숫자 판정, guess = 표본 부족 시 특성으로 본 예상, why = 이유 코드',
        },
        'reasons': REASONS,
        'lanes': lanes,
    }
    Path(a.out).write_text(json.dumps(out, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    pairs = sum(len(o) for l in lanes.values() for o in l.values())
    judged = sum(1 for l in lanes.values() for o in l.values() for e in o.values() if 'v' in e)
    kb = Path(a.out).stat().st_size // 1024
    print(f'{len(rows)}판, 패치 {", ".join(out["meta"]["patches"])} → 맞대결 {pairs}쌍 중 숫자 판정 {judged}쌍, {a.out} ({kb}KB)')


if __name__ == '__main__':
    main()
