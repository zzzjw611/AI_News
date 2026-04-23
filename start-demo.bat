@echo off
echo ==================================
echo   AI Marketer Daily — Demo Mode
echo ==================================

where node >nul 2>nul
if %errorlevel% neq 0 (
  echo ❌ 请先安装 Node.js: https://nodejs.org
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo 📦 首次运行，安装依赖...
  call npm install
)

echo.
echo 🚀 启动中... 打开浏览器访问: http://localhost:3000
echo    按 Ctrl+C 停止
echo.

set NEXT_PUBLIC_DEMO_MODE=true
call npx next dev
