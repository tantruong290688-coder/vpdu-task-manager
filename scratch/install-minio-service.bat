@echo off
title Cai Dat MinIO Windows Service - VPDU Task Manager
color 0e

:: Yeu cau quyen Admin
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo =====================================================================
    echo [LOI] BAN CAN PHAI CHAY FILE NAY VOI QUYEN ADMIN!
    echo =====================================================================
    echo Cach thuc hien:
    echo 1. Click chuot phai vao file "install-minio-service.bat" này.
    echo 2. Chon "Run as administrator" (Chay duoi quyen quan tri vien).
    echo.
    pause
    exit /b
)

echo =====================================================================
echo    CAI DAT MINIO THANH WINDOWS SERVICE (KHOI DONG CUNG MAY TINH)
echo =====================================================================
echo.

:: 1. Kiem tra thu muc nssm
if not exist "D:\Quan tri nhiem vu VPDU\minio\nssm.exe" (
    color 0c
    echo [LOI] Khong tim thay nssm.exe tai "D:\Quan tri nhiem vu VPDU\minio\nssm.exe"
    echo Vui loai tai NSSM tu https://nssm.cc/release/nssm-2.24.zip
    echo Giai nen va copy tep tin nssm.exe (trong thu muc win64) vao "D:\Quan tri nhiem vu VPDU\minio\"
    echo.
    pause
    exit /b
)

:: 2. Dang ky dich vu bang NSSM
echo [TIEN TRINH] Dang dang ky Windows Service "MinIOServer"...
"D:\Quan tri nhiem vu VPDU\minio\nssm.exe" install MinIOServer "D:\Quan tri nhiem vu VPDU\minio\minio.exe"
"D:\Quan tri nhiem vu VPDU\minio\nssm.exe" set MinIOServer AppDirectory "D:\Quan tri nhiem vu VPDU\minio"
"D:\Quan tri nhiem vu VPDU\minio\nssm.exe" set MinIOServer AppParameters "server \"D:\Quan tri nhiem vu VPDU\minio\minio-data\" --console-address \":9001\" --address \":9000\""
"D:\Quan tri nhiem vu VPDU\minio\nssm.exe" set MinIOServer AppEnvironmentExtra MINIO_ROOT_USER=admin_vpdu MINIO_ROOT_PASSWORD=VpduPassword2026! MINIO_API_CORS_ALLOW_ORIGIN=*
"D:\Quan tri nhiem vu VPDU\minio\nssm.exe" set MinIOServer Start SERVICE_AUTO_START

echo.
echo [TIEN TRINH] Dang khoi dong dich vu "MinIOServer"...
"D:\Quan tri nhiem vu VPDU\minio\nssm.exe" start MinIOServer

echo.
echo =====================================================================
echo [THANH CONG] Da cai dat va khoi dong MinIO Service thanh cong!
echo May chu MinIO tu nay se tu dong chay ngam cung Windows khi bat may.
echo.
echo - Xem trang Console: http://localhost:9001
echo - API endpoints: http://localhost:9000
echo =====================================================================
echo.
pause
