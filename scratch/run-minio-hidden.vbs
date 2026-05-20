Set WshShell = CreateObject("WScript.Shell")
' Chạy tệp start-minio.bat và ẩn hoàn toàn cửa sổ dòng lệnh (đối số 0)
WshShell.Run chr(34) & "D:\Quan tri nhiem vu VPDU\vpdu-task-manager\scratch\start-minio.bat" & Chr(34), 0
Set WshShell = Nothing
