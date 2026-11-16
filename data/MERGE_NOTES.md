# data/matches.jsonl merge notes

Last merge: 2026-11-16 13:03 KST (Grok, script merge.py)

- Total rows: 46,494 (unique match ids) · by source: claude 41,361, grok 5,133 · by version: 16.21 8,633, 16.22 37,861
- This run: Claude/base file 41,361 rows + Grok 5,133 new rows (Grok had 12,580 eligible games, 7,447 already in the file).
- Dedupe: by match id (`KR_…`). The record already in the file always wins; Grok rows are only appended for ids not present.
- Grok rows are marked `"src": "grok"`. Source: Riot MATCH-V5, KR solo ranked (queue 420), patch 16.22, games found through
  Challenger/Grandmaster/Master ladder players (`t` = that ladder tier, same meaning as Claude's `t`).
- Same filters as `collector/collect.py`: queue 420, gameDuration >= 900 s, all 10 players have a teamPosition.
- Grok rows have NO timeline: `p` rows are `[teamId, lane, champion, win, null, null, null, null]` and there is no `g` key
  (identical to what collect.py writes without `--timeline`). make_site_data.py and build.py handle this; any new script that
  uses gold@15 / level6 / first item / `g` must skip nulls or filter `src != "grok"`.
- No API keys, puuids or summoner names are included.
