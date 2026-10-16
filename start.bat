@echo off
title NyaaChat Server (3000)
chcp 65001 > nul
cd /d "%~dp0"
echo ========================================================
echo   NyaaChat 실시간 웹채팅 서버 시작 (Port 3000)
echo   접속 주소: http://192.168.0.5:3000 (로컬: http://localhost:3000)
echo ========================================================
node server.js
pause
