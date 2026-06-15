@echo off
chcp 65001 >nul
echo ========================================
echo   A^&M Clean - יוצר קובץ Word הדרכה
echo ========================================
echo.

set SCRIPT_DIR=%~dp0
set OUTPUT_DIR=%APPDATA%\Claude\local-agent-mode-sessions\d5f21d59-a9eb-4cd4-bca4-43a878893ca0\eefc0dc2-59f0-4364-86e7-469db03ef1cc\local_a244f9db-0370-4681-94f9-7a0e92e285d6\outputs

echo [1/3] מתקין תלויות...
cd /d "%OUTPUT_DIR%"
call npm install docx --save 2>nul
if errorlevel 1 (
    echo שגיאה בהתקנת docx. בודק npm...
    where npm
    if errorlevel 1 (
        echo npm לא נמצא. מנסה נתיב מלא...
        "C:\Program Files\nodejs\npm.cmd" install docx --save
    )
)

echo [2/3] יוצר קובץ Word...
node create_tutorial.js
if errorlevel 1 (
    echo שגיאה ביצירת הקובץ.
    pause
    exit /b 1
)

echo [3/3] מעתיק לתיקיית smartclean3...
copy /Y "%OUTPUT_DIR%\tutorial_script.docx" "%SCRIPT_DIR%tutorial_script.docx"

echo.
echo ========================================
echo   הקובץ tutorial_script.docx נוצר!
echo ========================================
echo.
pause
