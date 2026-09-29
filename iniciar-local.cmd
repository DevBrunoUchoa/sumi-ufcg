@echo off
setlocal
set "ROOT=%~dp0"
if not exist "%ROOT%.tools\node.exe" (
  echo Node portatil nao encontrado em .tools\node.exe
  exit /b 1
)
set "PATH=%ROOT%.tools;%PATH%"
set "TEMP=%ROOT%.tools\tmp"
set "TMP=%TEMP%"
set "XDG_CACHE_HOME=%ROOT%.tools\cache"
set "COREPACK_HOME=%ROOT%.tools\corepack"
cd /d "%ROOT%"
pnpm build || exit /b 1
pnpm start
