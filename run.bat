@echo off
title 🚀 LHP Project Runner
color 0B

:: === KHỞI ĐỘNG AI SERVER ===
echo [🔁] Đang chuyển tới thư mục lhp-ai-server...
cd /d E:\LHP-FI\lhp-ai-server

:: Kiểm tra app.py tồn tại
if not exist app.py (
  echo [❌] Không tìm thấy file app.py trong lhp-ai-server. Kiểm tra lại!
  pause
  exit /b
)

:: Kiểm tra venv hoặc yêu cầu cài đặt nếu cần
if not exist venv (
  echo [📦] Không thấy venv, vui lòng tạo trước bằng: python -m venv venv
) else (
  echo [🐍] Kích hoạt môi trường Python ảo...
  call venv\Scripts\activate.bat
)

:: Chạy AI server trong cửa sổ riêng
echo [🧠] Đang chạy lhp-ai-server...
start "LHP AI Server" cmd /k "cd /d E:\LHP-FI\lhp-ai-server && python app.py"

:: === CHỜ 2 GIÂY CHO ỔN ĐỊNH ===
timeout /t 2 >nul

:: === KHỞI ĐỘNG FRONTEND ===
echo.
echo [💻] Đang chuyển tới thư mục lhp-fi...
cd /d E:\LHP-FI\lhp-fi

:: Cài npm packages nếu cần
if not exist node_modules (
  echo [📦] Chưa có node_modules → Đang cài...
  npm install
)

:: Chạy frontend trong cửa sổ riêng
echo [🌐] Đang chạy frontend lhp-fi...
start "LHP Frontend" cmd /k "cd /d E:\LHP-FI\lhp-fi && npm run dev"

:: === HOÀN TẤT ===
echo.
echo [✅] Tất cả đã khởi động trong 2 cửa sổ riêng biệt!
pause
