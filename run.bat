@echo off
:: Chuyển tới thư mục dự án
cd /d E:\LHP-FI\lhp-fi

:: In ra trạng thái
echo 🚀 Đang khởi động dự án LHP-FI...

:: Cài thư viện nếu cần (chỉ chạy khi thiếu node_modules)
IF NOT EXIST node_modules (
    echo 📦 Cài dependencies lần đầu...
    npm install
)

:: Chạy dev server
echo 🧠 Đang chạy localhost tại http://localhost:3000 ...
npm run dev

pause
