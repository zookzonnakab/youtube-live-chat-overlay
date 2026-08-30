@echo off
cd /d "%~dp0"
if not exist node_modules (
  echo Installing dependencies...
  call npm install
)
if not exist dist (
  echo Building...
  call npm run build
)
if not exist .env (
  copy .env.example .env
)
echo Starting YouTube Live Chat Overlay on http://localhost:43123
call npm run dev
