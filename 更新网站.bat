@echo off
rem ============================================================
rem  DaoXuan WenJi - One-click Update Entry
rem  Double-click to open the update tool in Edge browser.
rem  Then click "Start Update" in the page, and commit via
rem  GitHub Desktop as usual.
rem ============================================================
set "TOOL=%~dp0build.html"

start "" msedge "%TOOL%" 2>nul
if not errorlevel 1 exit /b 0

start "" "microsoft-edge:file:///%TOOL:\=/%" 2>nul
if not errorlevel 1 exit /b 0

rem Fallback: open with the default browser
start "" "%TOOL%"
