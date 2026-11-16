@echo off
chcp 65001 >nul
cd /d "%~dp0"
set PYTHONIOENCODING=utf-8
echo 한국 서버 솔로 랭크 경기를 진행 기록까지 모읍니다 (열쇠 하나만 사용).
echo 높은 티어부터: 챌린저 800 / 그랜드마스터 1200 / 마스터 3000 / 다이아 2500 / 에메랄드 2500판, 모두 1만 판.
echo 한 시간에 1,000판 정도, 다 모으는 데 10시간쯤 걸립니다.
echo 창을 닫거나 Ctrl+C로 멈춰도 모은 만큼 저장되고, 다시 실행하면 이어서 모읍니다.
echo (개발용 열쇠는 24시간마다 만료 — 만료되면 새 열쇠를 받아 열쇠_넣기.bat로 넣고 다시 실행)
echo.
py -3 collect.py --target 10000 --tiers CHALLENGER:800,GRANDMASTER:1200,MASTER:3000,DIAMOND:2500,EMERALD:2500 --timeline
echo.
pause
