#!/bin/bash
echo "🚀 Запускаем HR Портал..."

# Start Python agent backend
cd agent
if [ ! -d ".venv" ]; then
  echo "📦 Устанавливаем зависимости..."
  python3 -m venv .venv
  source .venv/bin/activate
  pip install -r requirements.txt
  playwright install chromium
else
  source .venv/bin/activate
fi

if [ ! -f ".env" ]; then
  echo "⚠️  Создай файл agent/.env с твоим ANTHROPIC_API_KEY"
  echo "ANTHROPIC_API_KEY=sk-ant-..." > .env
fi

uvicorn main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

# Start Next.js frontend
cd ..
npm run dev &
FRONTEND_PID=$!

echo "✅ Портал запущен: http://localhost:3000"
echo "   API бэкенд:     http://localhost:8000"
echo ""
echo "Нажми Ctrl+C чтобы остановить"

trap "kill $BACKEND_PID $FRONTEND_PID" SIGINT
wait
