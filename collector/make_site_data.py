"""모은 경기(데이터/matches.jsonl) → 밴픽 사이트용 랭크 상성 파일(banpick-web/src/ranked.ts).

사이트가 예전에 읽던 lol.ps 파일과 같은 모양(LP_METAS, LPS, LP_LANES)으로 만들어 화면 코드는 거의 그대로 쓴다.
- 티어 3 = 마스터 +  (챌린저·그랜드마스터·마스터 선수를 통해 찾은 경기)
- 티어 2 = 에메랄드 + (모은 경기 전체) — 다이아·에메랄드 경기가 충분히 모였을 때만 넣음
- 맞대결은 5판 이상만 넣음(그 아래는 의미 없음). 30판 미만 숨김·100판 미만 '표본 부족'은 화면이 판단.
사용: py -3 make_site_data.py [--min-emerald 3000]
"""
import argparse, json, time
from collections import defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE.parent / '밴픽_사이트' / 'banpick-web' / 'src' / 'ranked.ts'
LANES = 'TJMAS'
MASTER = {'CHALLENGER', 'GRANDMASTER', 'MASTER'}


def shown(v):
    a, b = v.split('.')
    return f'{int(a) + 10}.{b}'  # 게임 버전 16.22 = 패치 26.22


def build(rows):
    lane_n = defaultdict(lambda: [0, 0])          # (lane, champ) -> [승, 판]
    champ_n = defaultdict(int)                    # champ -> 전체 판
    mu = defaultdict(lambda: [0, 0])              # (lane, a, b) -> [a 승, 판]
    for r in rows:
        side = defaultdict(dict)
        for p in r['p']:
            team, pos, ch, win = p[0], p[1], p[2], p[3]
            side[pos][team] = (ch, win)
            lane_n[(pos, ch)][0] += win
            lane_n[(pos, ch)][1] += 1
            champ_n[ch] += 1
        for pos, t in side.items():
            if 100 in t and 200 in t:
                (a, wa), (b, wb) = t[100], t[200]
                for x, wx, y in ((a, wa, b), (b, wb, a)):
                    mu[(pos, x, y)][0] += wx
                    mu[(pos, x, y)][1] += 1
    opp = defaultdict(list)
    for (pos, a, b), (w, n) in mu.items():
        if n >= 5:
            opp[(pos, a)].append([b, round(w / n * 100, 2), n])
    lps, lanes = {}, defaultdict(list)
    for (pos, ch), (w, n) in lane_n.items():
        ratio = round(n / champ_n[ch] * 100, 2)
        if n < 20 or ratio < 5:
            continue
        li = LANES.index(pos)
        lanes[ch].append([li, ratio])
        os_ = opp.get((pos, ch), [])
        lps[f'{li}|{ch}'] = {
            'h': sorted([x for x in os_ if x[1] < 50], key=lambda x: x[1]),
            'e': sorted([x for x in os_ if x[1] >= 50], key=lambda x: -x[1]),
            'n': n, 'wr': round(w / n * 100, 2), 'r': ratio,
        }
    for ch in lanes:
        lanes[ch].sort(key=lambda x: -x[1])
    pairs = [x for k in lps.values() for x in k['h'] + k['e']]
    return lps, dict(lanes), {
        'champions': len(lanes), 'entries': len(lps), 'listed': len(pairs),
        'n30': sum(1 for x in pairs if x[2] >= 30), 'n100': sum(1 for x in pairs if x[2] >= 100),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--data', default=str(HERE / '데이터' / 'matches.jsonl'))
    ap.add_argument('--min-emerald', type=int, default=3000, help='다이아·에메랄드 경기가 이만큼 있어야 에메랄드+ 티어를 넣음')
    a = ap.parse_args()
    rows = list({r['id']: r for r in (json.loads(x) for x in open(a.data, encoding='utf-8'))}.values())  # 같은 경기 두 번 저장된 것은 하나만
    vers = sorted({r['v'] for r in rows}, key=lambda v: tuple(map(int, v.split('.'))))
    sets = {3: ('마스터 +', [r for r in rows if r['t'] in MASTER])}
    low = [r for r in rows if r['t'] not in MASTER]
    if len(low) >= a.min_emerald:
        sets[2] = ('에메랄드 +', rows)
    metas, lpss, lanes_all = {}, {}, {}
    for tid, (label, rs) in sets.items():
        lps, lanes, st = build(rs)
        vs = sorted({r['v'] for r in rs}, key=lambda v: tuple(map(int, v.split('.'))))
        metas[tid] = {'patch': '–'.join(dict.fromkeys([shown(vs[0]), shown(vs[-1])])), 'tierId': tid, 'tierLabel': label,
                      'regionLabel': '한국', 'collectedAt': time.strftime('%Y-%m-%d'), 'games': len(rs), **st}
        lpss[tid] = lps
        for ch, ls in lanes.items():
            lanes_all.setdefault(ch, ls)
    head = ('// 랭크 상성: Riot Games API(MATCH-V5)로 직접 모은 한국 서버 솔로 랭크 경기 (make_site_data.py가 만듦, 손으로 고치지 말 것)\n'
            '// 티어 3 = 마스터 +, 티어 2 = 에메랄드 + · 맞대결은 5판 이상만 · [상대, 내 승률%, 판수]\n'
            'export type LpRow = [string, number, number];\n'
            'export type LpSet = Record<string, { h: LpRow[]; e: LpRow[]; n: number; wr: number | null; r: number | null }>;\n'
            'export type LpMeta = { patch: string; tierId: number; tierLabel: string; regionLabel: string; collectedAt: string; games: number; champions: number; entries: number; listed: number; n30: number; n100: number };\n')
    body = (f'export const LP_METAS: Record<number, LpMeta> = {json.dumps(metas, ensure_ascii=False)};\n'
            f'export const LPS: Record<number, LpSet> = {json.dumps(lpss, ensure_ascii=False, separators=(",", ":"))};\n'
            f'export const LP_LANES: Record<string, [number, number | null][]> = {json.dumps(lanes_all, separators=(",", ":"))};\n')
    OUT.write_text(head + body, encoding='utf-8')
    for tid, m in metas.items():
        print(f"티어 {m['tierLabel']}: {m['games']}판 · 챔피언-라인 {m['entries']} · 맞대결 {m['listed']}쌍(30판+ {m['n30']}, 100판+ {m['n100']}) · 패치 {m['patch']}")
    print(f'→ {OUT} ({OUT.stat().st_size // 1024}KB), 버전 {vers}')


if __name__ == '__main__':
    main()
