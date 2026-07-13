@echo off
echo Dang khoi dong Pickleball Booking System...

echo 1. Khoi dong AI Service (cổng 8000)...
start cmd /k "cd ai-service && python -m app.main"

echo 2. Khoi dong Backend Node.js (cổng 5000)...
start cmd /k "cd backend && npm run dev"

echo 3. Khoi dong Frontend React (cổng 3000)...
start cmd /k "cd frontend && npm run dev"

echo Tat ca cac dich vu da duoc khoi dong trong cac cua so rieng biet!
echo Vui long giu nguyen cac cua so den nay de ung dung hoat dong.
