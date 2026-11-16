"""라이엇 공식 창구(API)에서 한국 서버 솔로 랭크 경기를 모아 데이터/matches.jsonl에 쌓는다.

사용: py -3 collect.py [--target 20000] [--tiers EMERALD,DIAMOND] [--days 14] [--timeline]
- 열쇠는 C:\\Users\\User\\.riot\\api_key.txt 한 줄 (D에 두지 않음). 화면·파일에 열쇠를 쓰지 않는다.
- 저장하는 것: 경기 번호, 버전, 티어, 참가자 10명의 (팀, 라인, 챔피언, 승패, 15분 골드). 소환사 이름·puuid는 저장 안 함.
- 끊겨도 다시 실행하면 이어서 모은다(이미 받은 경기는 건너뜀).
"""
import argparse, json, random, sys, time, urllib.error, urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
KEY_FILE = Path.home() / '.riot' / 'api_key.txt'
DATA = HERE / '데이터'
PLATFORM = 'https://kr.api.riotgames.com'
REGION = 'https://asia.api.riotgames.com'
POS = {'TOP': 'T', 'JUNGLE': 'J', 'MIDDLE': 'M', 'BOTTOM': 'A', 'UTILITY': 'S'}
APEX = {'MASTER': 'masterleagues', 'GRANDMASTER': 'grandmasterleagues', 'CHALLENGER': 'challengerleagues'}


class Api:
    def __init__(self, key, gap):
        self.key, self.gap, self.last, self.calls = key, gap, 0.0, 0

    def get(self, url):
        for _ in range(6):
            w = self.last + self.gap - time.time()
            if w > 0:
                time.sleep(w)
            self.last = time.time()
            self.calls += 1
            req = urllib.request.Request(url, headers={'X-Riot-Token': self.key, 'User-Agent': 'banpick-lab-edu'})
            try:
                with urllib.request.urlopen(req, timeout=30) as r:
                    return json.loads(r.read().decode('utf-8'))
            except urllib.error.HTTPError as e:
                if e.code == 429:
                    time.sleep(int(e.headers.get('Retry-After') or 10) + 1)
                    continue
                if e.code in (401, 403):
                    raise SystemExit('열쇠가 맞지 않거나 만료됐습니다 (개발용 열쇠는 24시간마다 새로 받아야 함). 열쇠_넣기.bat로 다시 넣어 주세요.')
                if e.code == 404:
                    return None
                if e.code >= 500:
                    time.sleep(5)
                    continue
                raise
            except (urllib.error.URLError, TimeoutError):
                time.sleep(5)
        return None


def players(api, tier, pages):
    if tier in APEX:
        d = api.get(f'{PLATFORM}/lol/league/v4/{APEX[tier]}/by-queue/RANKED_SOLO_5x5') or {}
        return [e['puuid'] for e in d.get('entries', []) if e.get('puuid')]
    out = []
    for div in ('I', 'II', 'III', 'IV'):
        for p in range(1, pages + 1):
            d = api.get(f'{PLATFORM}/lol/league-exp/v4/entries/RANKED_SOLO_5x5/{tier}/{div}?page={p}') or []
            out += [e['puuid'] for e in d if e.get('puuid')]
            if not d:
                break
    return out


LEGEND = set()


def load_items():
    """완성(전설) 아이템 번호 목록: Data Dragon 공개 자료(열쇠 필요 없음)에서 한 번 받아 데이터/items.json에 보관."""
    f = DATA / 'items.json'
    if not f.exists():
        DATA.mkdir(exist_ok=True)
        ver = json.loads(urllib.request.urlopen('https://ddragon.leagueoflegends.com/api/versions.json', timeout=30).read())[0]
        d = json.loads(urllib.request.urlopen(f'https://ddragon.leagueoflegends.com/cdn/{ver}/data/ko_KR/item.json', timeout=30).read())
        keep = {k: v['name'] for k, v in d['data'].items()
                if v.get('gold', {}).get('total', 0) >= 2200 and not v.get('into') and v.get('gold', {}).get('purchasable', True)
                and 'Consumable' not in v.get('tags', []) and v.get('maps', {}).get('11', True)}
        f.write_text(json.dumps({'version': ver, 'items': keep}, ensure_ascii=False), encoding='utf-8')
    LEGEND.update(int(k) for k in json.loads(f.read_text(encoding='utf-8'))['items'])


def lane_of(x, y):
    """소환사의 협곡 좌표(0~15000) → 위치 이름. 대각선(x≈y)이 미드, 왼쪽 위가 탑, 오른쪽 아래가 봇."""
    if abs(x - y) < 2200:
        return 'M'
    if x < 4000 and y > 9000 or y > 12500:
        return 'T'
    if y < 4000 and x > 9000 or x > 12500:
        return 'B'
    return 'jt' if y > x else 'jb'  # 정글: 탑 쪽 / 봇 쪽


def plan_info(tl, info):
    """진행 기록에서 경기 계획용 정보만: 6레벨 시각, 첫 전설 아이템 시각, 정글러 2~4분 위치와 첫 킬 관여, 오브젝트."""
    fr = tl['info']['frames']
    pid = {p['participantId']: p for p in info['participants']}
    lv6, item1, obj, fk = {}, {}, [], {}
    jg = {p['participantId'] for p in info['participants'] if p.get('teamPosition') == 'JUNGLE'}
    for f in fr:
        for e in f.get('events', []):
            t, ty = e.get('timestamp', 0) // 1000, e.get('type')
            if ty == 'LEVEL_UP' and e.get('level') == 6:
                lv6.setdefault(e['participantId'], t)
            elif ty == 'ITEM_PURCHASED' and e.get('itemId') in LEGEND:
                item1.setdefault(e['participantId'], (t, e['itemId']))
            elif ty == 'ELITE_MONSTER_KILL':
                obj.append([e.get('monsterType'), e.get('monsterSubType', ''), e.get('killerTeamId'), t])
            elif ty == 'BUILDING_KILL' and e.get('buildingType') == 'TOWER_BUILDING' and 'ftower' not in fk:
                fk['ftower'] = [300 - e.get('teamId', 100), t, e.get('laneType', '')]  # teamId = 탑을 잃은 팀
            elif ty == 'CHAMPION_KILL' and t < 600:
                who = [e.get('killerId')] + (e.get('assistingParticipantIds') or [])
                pos = e.get('position') or {}
                for j in jg:  # 정글러의 첫 교전: [시각, 위치, 1=킬·어시스트 / 0=죽음]
                    if j not in fk and (j in who or e.get('victimId') == j):
                        fk[j] = [t, lane_of(pos.get('x', 0), pos.get('y', 0)), 1 if j in who else 0]
    path = {}
    for j in jg:
        ps = []
        for mnt in (2, 3, 4):
            if len(fr) > mnt:
                q = fr[mnt]['participantFrames'].get(str(j), {}).get('position')
                ps.append(lane_of(q['x'], q['y']) if q else '')
        path[pid[j]['teamId']] = {'path': ps, 'fk': fk.get(j)}
    return lv6, item1, obj, path, fk.get('ftower')


def slim(m, tier, tl):
    info = m['info']
    if info.get('queueId') != 420 or info.get('gameDuration', 0) < 900:
        return None  # 다시하기·15분 미만 항복 제외
    gold = {}
    lv6, item1, obj, path, ftower = {}, {}, [], {}, None
    if tl:
        fr = tl['info']['frames']
        if len(fr) > 15:
            gold = {int(k): v['totalGold'] for k, v in fr[15]['participantFrames'].items()}
        lv6, item1, obj, path, ftower = plan_info(tl, info)
    ps = []
    for p in info['participants']:
        pos = POS.get(p.get('teamPosition'))
        if not pos:
            return None
        i1 = item1.get(p['participantId'])
        ps.append([p['teamId'], pos, p['championName'], 1 if p['win'] else 0, gold.get(p['participantId']),
                   lv6.get(p['participantId']), i1[0] if i1 else None, i1[1] if i1 else None])
    v = '.'.join(info['gameVersion'].split('.')[:2])
    row = {'id': m['metadata']['matchId'], 'v': v, 't': tier, 'p': ps, 'dur': info.get('gameDuration')}
    if tl:
        row['g'] = {'obj': obj, 'jg': path, 'ft': ftower}
    return row


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--target', type=int, default=20000, help='모을 경기 수(전체 누적)')
    ap.add_argument('--tiers', default='EMERALD,DIAMOND')
    ap.add_argument('--days', type=int, default=14, help='최근 며칠 경기만')
    ap.add_argument('--pages', type=int, default=2, help='티어·단계마다 읽을 명단 쪽수(쪽당 약 200명)')
    ap.add_argument('--timeline', action='store_true', help='15분 골드도 받기(호출이 2배)')
    ap.add_argument('--gap', type=float, default=1.25, help='호출 간격 초(개발용 열쇠: 2분에 100번)')
    ap.add_argument('--intro', action='store_true', help='시작 안내 문구 보여 주기(bat 파일의 한글 깨짐 방지)')
    a = ap.parse_args()
    if a.intro:
        print('한국 서버 솔로 랭크 경기를 진행 기록까지 모읍니다 (열쇠 하나만 사용).')
        print('높은 티어부터 모읍니다: ' + ' / '.join(x.replace(':', ' ') + '판' for x in a.tiers.split(',')))
        print('창을 닫거나 Ctrl+C로 멈춰도 모은 만큼 저장되고, 다시 실행하면 이어서 모읍니다.')
        print('개발용 열쇠는 24시간마다 만료됩니다. 만료되면 새 열쇠를 받아 열쇠_넣기.bat로 넣고 다시 실행하세요.\n')

    if not KEY_FILE.exists() or not KEY_FILE.read_text(encoding='utf-8').strip():
        raise SystemExit(f'열쇠 파일이 없습니다: {KEY_FILE}\n열쇠_넣기.bat를 먼저 실행해 주세요.')
    api = Api(KEY_FILE.read_text(encoding='utf-8').strip(), a.gap)
    DATA.mkdir(exist_ok=True)
    if a.timeline:
        load_items()
    out = DATA / 'matches.jsonl'
    seen = set()
    per = {}  # 티어별 이미 모은 판 수
    if out.exists():
        for line in out.open(encoding='utf-8'):
            r = json.loads(line)
            seen.add(r['id'])
            per[r['t']] = per.get(r['t'], 0) + 1
    done = set()
    print(f'이미 모은 경기 {len(seen)}판, 목표 {a.target}판')
    since = int(time.time()) - a.days * 86400
    # --tiers 는 "CHALLENGER:800,MASTER:2500,EMERALD" 처럼 티어별 상한을 붙일 수 있음 (높은 티어부터 적기)
    plan = []
    for x in a.tiers.upper().split(','):
        t, _, cap = x.partition(':')
        plan.append((t.strip(), int(cap) if cap else a.target))
    with out.open('a', encoding='utf-8') as f:
        for tier, cap in plan:
            if per.get(tier, 0) >= cap:
                print(f'{tier}: 이미 {per.get(tier, 0)}판 (상한 {cap}) — 건너뜀')
                continue
            ppl = players(api, tier, a.pages)
            random.shuffle(ppl)
            print(f'{tier}: 선수 {len(ppl)}명 명단, 이 티어 목표 {cap}판')
            for pu in ppl:
                if len(seen) >= a.target or per.get(tier, 0) >= cap:
                    break
                ids = api.get(f'{REGION}/lol/match/v5/matches/by-puuid/{pu}/ids?queue=420&type=ranked&startTime={since}&count=20') or []
                for mid in ids:
                    if mid in seen or mid in done or len(seen) >= a.target or per.get(tier, 0) >= cap:
                        continue
                    done.add(mid)
                    m = api.get(f'{REGION}/lol/match/v5/matches/{mid}')
                    if not m:
                        continue
                    tl = api.get(f'{REGION}/lol/match/v5/matches/{mid}/timeline') if a.timeline else None
                    row = slim(m, tier, tl)
                    if row:
                        f.write(json.dumps(row, ensure_ascii=False) + '\n')
                        f.flush()
                        seen.add(mid)
                        per[tier] = per.get(tier, 0) + 1
                        if len(seen) % 100 == 0:
                            print(f'  {len(seen)}판 (호출 {api.calls}번)')
    print(f'끝: 모두 {len(seen)}판. 이제 상성표_만들기를 실행하세요.')


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print('\n멈춤. 지금까지 모은 경기는 저장됐습니다. 다시 실행하면 이어서 모읍니다.')
        sys.exit(0)
