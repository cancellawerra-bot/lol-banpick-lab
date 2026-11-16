@echo off
chcp 65001 >nul
cd /d "%~dp0"
set PYTHONIOENCODING=utf-8
rem 열쇠가 만료될 때까지 계속 모으도록 목표를 크게 잡음(만료되면 거기서 멈추고, 모은 것은 그대로 남음)
py -3 collect.py --target 80000 --tiers CHALLENGER:5000,GRANDMASTER:8000,MASTER:22000,DIAMOND:22500,EMERALD:22500 --pages 6 --timeline --intro
echo.
pause
