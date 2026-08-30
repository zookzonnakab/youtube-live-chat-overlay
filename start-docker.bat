@echo off
cd /d "%~dp0"
if not exist .env (
  copy .env.example .env
)
echo Starting with Docker...
docker compose up --build -d
if %ERRORLEVEL% NEQ 0 (
  echo.
  echo Failed to start. Make sure Docker Desktop is running.
  pause
  exit /b 1
)
echo.
echo Running at http://localhost:43123
echo   Dock:     http://localhost:43123/dock
echo   Scroll:   http://localhost:43123/overlay/scroll
echo   Featured: http://localhost:43123/overlay/featured
echo.
docker compose ps
