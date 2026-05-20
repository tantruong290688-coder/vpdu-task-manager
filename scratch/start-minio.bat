@echo off
title May Chu Luu Tru MinIO - VPDU Task Manager
color 0b

echo =====================================================================
echo         KHOI DONG MAY CHU LUU TRU MINIO (BO LUU TRU NGOAI)
echo                 DU AN: VPDU TASK MANAGER
echo =====================================================================
echo.
echo Duong dan du lieu: D:\Quan tri nhiem vu VPDU\minio\minio-data
echo.

:: 1. Cau hinh thong tin tai khoan quan tri Root (Co the thay doi neu can)
set MINIO_ROOT_USER=admin_vpdu
set MINIO_ROOT_PASSWORD=VpduPassword2026!
set MINIO_API_CORS_ALLOW_ORIGIN=*

:: 2. Kiem tra thu muc du lieu, tu dong tao moi neu chua co
if not exist "D:\Quan tri nhiem vu VPDU\minio\minio-data" (
    echo [THONG BAO] Thu muc du lieu chua ton tai. Dang tu dong khoi tao...
    mkdir "D:\Quan tri nhiem vu VPDU\minio\minio-data"
    echo [THANH CONG] Da tao thu muc: "D:\Quan tri nhiem vu VPDU\minio\minio-data"
)

:: 3. Kiem tra xem tep tin minio.exe co nam dung vi tri khong
if not exist "D:\Quan tri nhiem vu VPDU\minio\minio.exe" (
    color 0c
    echo [LOI RAT NGHIEU TRONG] Khong tim thay tep tin minio.exe!
    echo Vui long tai minio.exe va copy vao thu muc: "D:\Quan tri nhiem vu VPDU\minio\"
    echo.
    echo Huong dan tai:
    echo 1. Truy cap: https://dl.min.io/server/minio/release/windows-amd64/minio.exe
    echo 2. Luu vao thu muc "D:\Quan tri nhiem vu VPDU\minio\" duoi ten file "minio.exe"
    echo.
    pause
    exit /b
)

:: 4. Khoi chay MinIO Server
echo [KHOI DONG] Dang bat dau khoi chay may chu MinIO...
echo - API Server: http://localhost:9000
echo - Console Admin Dashboard: http://localhost:9001
echo.
echo NHAN TO HOP PHIM [Ctrl + C] HOAC DONG CUA SO NAY DE TAT TIEN TRINH CHAY.
echo ---------------------------------------------------------------------

"D:\Quan tri nhiem vu VPDU\minio\minio.exe" server "D:\Quan tri nhiem vu VPDU\minio\minio-data" --console-address ":9001" --address ":9000"

pause
