@echo off
REM Unset ELECTRON_RUN_AS_NODE so Electron starts properly
set ELECTRON_RUN_AS_NODE=
cd /d "%~dp0"
node_modules\electron\dist\electron.exe .
