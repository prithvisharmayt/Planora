@echo off
echo ========================================================
echo   Starting PLANORA — The Study Buddy
echo   "Less Panic, More Progress."
echo ========================================================
echo.
echo Opening Planora at http://localhost:5173
echo Press Ctrl+C in this terminal window to stop the server.
echo.
call npm.cmd run dev -- --open
pause

