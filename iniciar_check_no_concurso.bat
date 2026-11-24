@echo off
title Check no Concurso - Servidor Local
cd /d "%~dp0"
echo ========================================================
echo   Check no Concurso (checknoconcurso.com.br)
echo   Site + App PWA rodando em http://localhost:3400
echo ========================================================
start "" http://localhost:3400
node server.mjs
pause
