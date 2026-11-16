@echo off
chcp 65001 >nul
if not exist "%USERPROFILE%\.riot" mkdir "%USERPROFILE%\.riot"
if not exist "%USERPROFILE%\.riot\api_key.txt" type nul > "%USERPROFILE%\.riot\api_key.txt"
echo.
echo 메모장이 열리면, 라이엇 개발자 사이트에서 복사한 열쇠(RGAPI-로 시작)를
echo 원래 있던 글을 모두 지우고 붙여 넣은 뒤 저장(Ctrl+S)하고 닫아 주세요.
echo (열쇠는 C 드라이브에만 저장됩니다)
echo.
notepad "%USERPROFILE%\.riot\api_key.txt"
