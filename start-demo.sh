#!/bin/bash
echo "=================================="
echo "  AI Marketer Daily — Demo Mode"
echo "=================================="

if ! command -v node &>/dev/null; then
  echo "❌ 请先安装 Node.js: https://nodejs.org"
  exit 1
fi

if [ ! -d "node_modules" ]; then
  echo "📦 首次运行，安装依赖..."
  npm install
fi

echo ""
echo "🚀 启动中... 打开浏览器访问: http://localhost:3000"
echo "   按 Ctrl+C 停止"
echo ""

NEXT_PUBLIC_DEMO_MODE=true npx next dev
