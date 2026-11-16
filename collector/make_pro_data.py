"""Oracle's Elixir 경기 표(csv) → 밴픽 사이트용 리그별 프로 데이터(banpick-web/src/pro.ts).

사이트가 예전에 App.tsx 안에 직접 넣어 두던 프로 데이터(LeagueLab LCK+월즈)와 같은 모양을 리그마다 만든다.
챔피언 번호(인덱스)는 App.tsx 의 DATA 순서를 그대로 쓴다.
선수 이름·팀 이름은 넣지 않는다(챔피언 통계만).
사용: py -3 -I make_pro_data.py [csv 경로]
"""
import csv, json, re, sys, time
from collections import Counter, defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parent
APP = HERE.parent / '밴픽_사이트' / 'banpick-web' / 'src' / 'App.tsx'
OUT = HERE.parent / '밴픽_사이트' / 'banpick-web' / 'src' / 'pro.ts'
CSV = HERE / '데이터' / 'oracles_elixir' / '2026_LoL_esports_match_data_from_OraclesElixir.csv'
POS = {'top': 0, 'jng': 1, 'mid': 2, 'bot': 3, 'sup': 4}
GROUPS = [  # (키, 버튼 이름, 설명용 이름, 리그 코드)
    ('ALL', '전체', 'LCK·LPL·LEC·LCS·국제대회', ['LCK', 'LPL', 'LEC', 'LCS', 'WLDs', 'MSI', 'FST']),
    ('LCK', 'LCK', 'LCK', ['LCK']),
    ('LPL', 'LPL', 'LPL(중국)', ['LPL']),
    ('LEC', 'LEC', 'LEC(유럽)', ['LEC']),
    ('LCS', 'LCS', 'LCS(북미)', ['LCS']),
    ('INTL', '국제대회', '월즈·MSI·퍼스트 스탠드', ['WLDs', 'MSI', 'FST']),
]
SPECIAL = {'wukong': 'MonkeyKing', 'nunuwillump': 'Nunu', 'renataglasc': 'Renata'}


def champ_order():
    s = APP.read_text(encoding='utf-8')
    data = re.search(r'const DATA = `([^`]*)`', s).group(1)
    ids = [r.split('|')[0] for r in data.split(';')]
    low = {i.lower(): n for n, i in enumerate(ids)}
    return ids, low


def main():
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else CSV
    ids, low = champ_order()
    miss = Counter()

    def idx(name):
        if not name:
            return None
        k = re.sub(r'[^a-z]', '', name.lower())
        k = SPECIAL.get(k, k)
        k = k.lower()
        if k in low:
            return low[k]
        miss[name] += 1
        return None

    games = defaultdict(lambda: {'team': {}, 'pl': defaultdict(dict)})
    with open(path, encoding='utf-8', newline='') as fh:
        for row in csv.DictReader(fh):
            g = games[row['gameid']]
            side = row['side']
            if row['position'] == 'team':
                g['team'][side] = row
            elif row['position'] in POS:
                g['pl'][side][POS[row['position']]] = row
    out = {}
    for key, label, desc, leagues in GROUPS:
        gs = [g for g in games.values() if 'Blue' in g['team'] and g['team']['Blue']['league'] in leagues
              and len(g['pl']['Blue']) == 5 and len(g['pl']['Red']) == 5]
        pats = sorted({g['team']['Blue']['patch'] for g in gs}, key=lambda p: tuple(map(int, p.split('.'))))
        recent = set(pats[-6:])
        NG = len(gs)
        NR = sum(1 for g in gs if g['team']['Blue']['patch'] in recent)
        blue_w = sum(1 for g in gs if g['team']['Blue']['result'] == '1')
        fp_w = sum(1 for g in gs for s in ('Blue', 'Red') if g['team'][s]['firstPick'] == '1' and g['team'][s]['result'] == '1')
        fp_n = sum(1 for g in gs for s in ('Blue', 'Red') if g['team'][s]['firstPick'] == '1')
        P = Counter(); W = Counter(); B = Counter(); posc = defaultdict(lambda: [0] * 5); posw = defaultdict(lambda: [0] * 5)
        b1 = Counter(); b2 = Counter(); rp = Counter(); rb = Counter(); fpd = Counter()
        gd = defaultdict(list)
        mu = defaultdict(lambda: [0, 0]); sy = defaultdict(lambda: [0, 0]); xm = defaultdict(lambda: [0, 0])
        jg = defaultdict(lambda: {'n': 0, 'fb': 0, 'fd': 0, 'fh': 0, 'fv': 0, 'gd': [], 'xd': []})
        dates = []
        for g in gs:
            T = g['team']
            dates.append(T['Blue']['date'][:10])
            isr = T['Blue']['patch'] in recent
            for s, o in (('Blue', 'Red'), ('Red', 'Blue')):
                t = T[s]
                win = 1 if t['result'] == '1' else 0
                for k in range(1, 6):
                    c = idx(t.get(f'ban{k}'))
                    if c is None:
                        continue
                    B[c] += 1
                    (b1 if k <= 3 else b2)[c] += 1
                    if isr:
                        rb[c] += 1
                c1 = idx(t.get('pick1'))
                if c1 is not None:
                    fpd[c1] += 1
                pl = g['pl'][s]; op = g['pl'][o]
                ci = {p: idx(pl[p]['champion']) for p in range(5)}
                oi = {p: idx(op[p]['champion']) for p in range(5)}
                for p in range(5):
                    c = ci[p]
                    if c is None:
                        continue
                    P[c] += 1; W[c] += win; posc[c][p] += 1; posw[c][p] += win
                    if isr:
                        rp[c] += 1
                    v = pl[p].get('golddiffat15', '')
                    if v not in ('', None):
                        gd[c].append(float(v))
                    if oi[p] is not None and s == 'Blue':
                        mu[(p, c, oi[p])][0] += 1; mu[(p, c, oi[p])][1] += win
                for a in range(5):
                    for b in range(a + 1, 5):
                        if ci[a] is not None and ci[b] is not None:
                            k = (f'{a}{b}', ci[a], ci[b]); sy[k][0] += 1; sy[k][1] += win
                j = ci[1]
                if j is not None:
                    J = jg[j]; J['n'] += 1
                    J['fb'] += t.get('firstblood') == '1'
                    J['fd'] += t.get('firstdragon') == '1'
                    J['fh'] += t.get('firstherald') == '1'
                    try:
                        J['fv'] += float(t.get('void_grubs') or 0) > float(t.get('opp_void_grubs') or 0)
                    except ValueError:
                        pass
                    if pl[1].get('golddiffat15') not in ('', None):
                        J['gd'].append(float(pl[1]['golddiffat15']))
                        J['xd'].append(float(pl[1].get('xpdiffat15') or 0))
                    for q in (0, 2, 3, 4):
                        if oi[q] is not None:
                            xm[(q, j, oi[q])][0] += 1; xm[(q, j, oi[q])][1] += win
        pro = []
        for c in range(len(ids)):
            if P[c] or B[c]:
                pc = posc[c]
                g_ = gd.get(c, [])
                pro.append(f"{c}:{P[c]},{W[c]},{B[c]},{','.join(map(str, pc))},{fpd[c]},{b1[c]},{b2[c]},{rp[c]},{rb[c]}" + (f"|{len(g_)},{round(sum(g_) / len(g_))}" if g_ else ''))
        out[key] = {
            'label': label, 'desc': desc, 'leagues': leagues, 'ng': NG, 'nr': NR, 'blueW': blue_w, 'fpW': fp_w, 'fpN': fp_n,
            'patches': f"{int(pats[0].split('.')[0]) + 10}.{pats[0].split('.')[1]}–{int(pats[-1].split('.')[0]) + 10}.{pats[-1].split('.')[1]}" if pats else '',
            'recent': f"{int(sorted(recent)[0].split('.')[0]) + 10}.{sorted(recent)[0].split('.')[1]}–{int(pats[-1].split('.')[0]) + 10}.{pats[-1].split('.')[1]}" if pats else '',
            'from': min(dates) if dates else '', 'to': max(dates) if dates else '',
            'pro': ';'.join(pro),
            'mud': ';'.join(f'{p},{a},{b},{n},{w}' for (p, a, b), (n, w) in mu.items() if n >= 3),
            'syd': ';'.join(f'{pp},{a},{b},{n},{w}' for (pp, a, b), (n, w) in sy.items() if n >= 3),
            'pwd': ';'.join(f"{c},{','.join(map(str, posw[c]))}" for c in posw),
            'jgd': ';'.join(f"{c},{J['n']},{J['fb']},{J['fd']},{J['fh']},{J['fv']},{len(J['gd'])},{round(sum(J['gd']) / len(J['gd'])) if J['gd'] else ''},{round(sum(J['xd']) / len(J['xd'])) if J['xd'] else ''}" for c, J in jg.items()),
            'xmd': ';'.join(f'{q},{j},{l},{n},{w}' for (q, j, l), (n, w) in xm.items() if n >= 3),
            'fpd': ';'.join(f'{ids[c]},{n}' for c, n in fpd.most_common()),
        }
        print(f"{label:6} {NG:4}경기 (최근 6패치 {NR}) 블루 승 {blue_w} · 선픽 팀 {fp_w}/{fp_n} · 패치 {out[key]['patches']} · {out[key]['from']}~{out[key]['to']}")
    head = ("// 프로 경기 데이터: Oracle's Elixir 2026 경기 표(oracleselixir.com, 경기 통계는 Riot Games 소유)를 make_pro_data.py가 리그별로 집계.\n"
            "// 손으로 고치지 말 것. 챔피언 번호는 App.tsx DATA 순서. 선수·팀 이름 없음.\n"
            "export interface ProLeague { label: string; desc: string; leagues: string[]; ng: number; nr: number; blueW: number; fpW: number; fpN: number; patches: string; recent: string; from: string; to: string; pro: string; mud: string; syd: string; pwd: string; jgd: string; xmd: string; fpd: string }\n"
            f"export const PRO_MADE = {json.dumps(time.strftime('%Y-%m-%d'))};\n")
    OUT.write_text(head + 'export const PRO: Record<string, ProLeague> = ' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';\n', encoding='utf-8')
    print(f'→ {OUT} ({OUT.stat().st_size // 1024}KB)')
    if miss:
        print('이름을 못 맞춘 챔피언:', dict(miss.most_common(10)))


if __name__ == '__main__':
    main()
