@echo off
echo Starting GovGuide AI Application...
echo.

echo Starting Backend Server...
cd backend
start "GovGuide Backend" cmd /k "venv\Scripts\python.exe -m uvicorn main:app --reload --host 0.0.0.0 --port 8000"
cd ..

echo Waiting for backend to start...
timeout /t 3 /nobreak > nul

echo Starting Frontend Server...
cd frontend
start "GovGuide Frontend" cmd /k "npm run dev"
cd ..

echo.
echo ========================================
echo GovGuide AI is starting...
echo Frontend: http://localhost:5173
echo Backend API: http://localhost:8000
echo API Docs: http://localhost:8000/docs
echo ========================================
echo.
echo Press any key to close this window...
pause > nul
