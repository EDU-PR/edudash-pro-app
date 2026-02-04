@echo off
setlocal
set "SCRIPT_DIR=%~dp0"
node "%SCRIPT_DIR%scripts\eas-wrapper.mjs" %*
endlocal
