"""가짜 경기로 상성표 만들기 시험 (라이엇 호출 없음). 실행: py -3 -m unittest test_banpick -v"""
import json, random, unittest
from pathlib import Path
from unittest import mock

import build, collect

HERE = Path(__file__).resolve().parent
CH = json.loads((HERE / 'champs.json').read_text(encoding='utf-8'))


def fake(n, seed=1):
    rnd = random.Random(seed)
    pool = {l: [k for k, c in CH.items() if l in c['pos']] for l in 'TJMAS'}
    rows = []
    for i in range(n):
        bw = rnd.random() < 0.5
        ps = []
        for team in (100, 200):
            for l in 'TJMAS':
                ch = 'Garen' if (l == 'T' and team == 100) else 'Teemo' if (l == 'T' and team == 200) else rnd.choice(pool[l])
                win = 1 if (team == 100) == bw else 0
                ps.append([team, l, ch, win, rnd.randint(4000, 6000)])
        # 가렌이 티모에게 70% 지게
        win_blue = 0 if rnd.random() < 0.7 else 1
        ps = [[t, l, c, (win_blue if t == 100 else 1 - win_blue), g] for t, l, c, _, g in ps]
        rows.append({'id': f'KR_{i}', 'v': '16.22', 't': 'EMERALD', 'p': ps})
    return rows


class T(unittest.TestCase):
    def test_counts_are_symmetric(self):
        lanes = build.build(fake(400), CH, 30)
        g, t = lanes['T']['Garen']['Teemo'], lanes['T']['Teemo']['Garen']
        self.assertEqual(g['n'], 400)
        self.assertEqual(g['w'] + t['w'], 400)
        self.assertEqual(g['gd15'], -t['gd15'])
        self.assertEqual(g['v'], '불리')
        self.assertEqual(t['v'], '유리')

    def test_type_reasons(self):
        # 근접 가렌 vs 원거리 티모(탑) → 원거리 견제 불리
        self.assertIn('range-', build.type_reasons(CH['Garen'], CH['Teemo'], 'T'))
        self.assertIn('range+', build.type_reasons(CH['Teemo'], CH['Garen'], 'T'))
        for a in list(CH)[:40]:
            for b in list(CH)[:40]:
                for c in build.type_reasons(CH[a], CH[b], 'M'):
                    self.assertIn(c, build.REASONS)

    def test_small_sample_gives_guess_only(self):
        lanes = build.build(fake(5), CH, 30)
        e = lanes['T']['Garen']['Teemo']
        self.assertNotIn('v', e)
        self.assertEqual(e['guess'], '불리')

    def test_slim_drops_personal_data(self):
        parts = [{'teamId': 100 if i < 5 else 200, 'teamPosition': 'TOP', 'championName': 'FiddleSticks',
                  'win': i < 5, 'participantId': i + 1, 'puuid': 'SECRET', 'riotIdGameName': 'SECRET'} for i in range(10)]
        m = {'metadata': {'matchId': 'KR_1'}, 'info': {'queueId': 420, 'gameDuration': 1800, 'gameVersion': '16.22.123.4', 'participants': parts}}
        row = collect.slim(m, 'EMERALD', None)
        self.assertEqual(row['v'], '16.22')
        self.assertNotIn('SECRET', json.dumps(row))
        m['info']['gameDuration'] = 600
        self.assertIsNone(collect.slim(m, 'EMERALD', None))

    def test_name_fix(self):
        fix = build.norm_map(CH)
        self.assertEqual(fix('FiddleSticks'), 'Fiddlesticks')

    def test_api_key_error_message(self):
        import urllib.error
        api = collect.Api('k', 0)
        err = urllib.error.HTTPError('u', 403, 'x', {}, None)
        with mock.patch('urllib.request.urlopen', side_effect=err):
            with self.assertRaises(SystemExit):
                api.get('https://kr.api.riotgames.com/x')


if __name__ == '__main__':
    unittest.main()
