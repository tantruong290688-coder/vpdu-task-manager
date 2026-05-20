@echo off
title Tu Dong Dang Ky Windows Task Scheduler - VPDU Task Manager
color 0b

:: Yeu cau quyen Admin
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo =====================================================================
    echo [LOI] BAN CAN PHAI CHAY FILE NAY VOI QUYEN ADMIN!
    echo =====================================================================
    echo Cach thuc hien:
    echo 1. Click chuot phai vao file "register-scheduled-task.bat" này.
    echo 2. Chon "Run as administrator" (Chay duoi quyen quan tri vien).
    echo.
    pause
    exit /b
)

echo =====================================================================
echo    TU DONG DANG KY DICH VU MINIO VAO WINDOWS TASK SCHEDULER (24/7)
echo =====================================================================
echo.
echo Duong dan tep chay: D:\Quan tri nhiem vu VPDU\vpdu-task-manager\scratch\run-minio-hidden.vbs
echo.

:: 1. Xoa tac vu cu neu da ton tai de tranh xung dot
schtasks /delete /tn "MayChuMinIO" /f >nul 2>&1

:: 2. Dang ky tac vu moi vao Task Scheduler
:: - /tn: Ten tac vu ("MayChuMinIO")
:: - /tr: Lenh thuc thi (Chay vbs bang wscript.exe)
:: - /sc: Schedule type (onstart - Chay ngay khi bat may tinh)
:: - /ru: Run User (SYSTEM - Chay duoi quyen he thong thap cao nhat, khong can mat khau Windows)
:: - /rl: Run Level (highest - Chay voi dac quyen cao nhat)
:: - /f: Force (Ghi de neu co san)
schtasks /create /tn "MayChuMinIO" /tr "wscript.exe \"D:\Quan tri nhiem vu VPDU\vpdu-task-manager\scratch\run-minio-hidden.vbs\"" /sc onstart /ru "SYSTEM" /rl highest /f

if %errorLevel% eq 0 (
    echo.
    echo =====================================================================
    echo [THANH CONG] Da dang ky tac vu vao Windows Task Scheduler thanh cong!
    echo.
    echo Tu nay, may chu MinIO se tu dong chay ngam 24/7 moi khi ban bat may,
    echo khong hien thi cua so Command Prompt, va chay truoc ca khi dang nhap.
    echo.
    echo [HUONG DAN KICH HOAT NGAY LAP TUC]
    echo Vi may tính dang bat san, ban co the bam phím bat ky de khoi chay ngam ngay bay gio...
    echo =====================================================================
    echo.
    pause
    
    :: Khoi chay ngay lap tuc de nguoi dung khong can khoi dong lai may de kiem tra
    schtasks /run /tn "MayChuMinIO"
    echo.
    echo [XAC NHAN] May chu MinIO dang duoc chay ngam.
    echo Ban co the kiem tra bang cach mo: http://localhost:9001
) else (
    color 0c
    echo.
    echo [LOI] Co loi xay ra khi dang ky vao Task Scheduler.
    echo Vui long kiem tra lai quyen Administrator hoac lien he lap trinh vien.
)

echo.
pause
