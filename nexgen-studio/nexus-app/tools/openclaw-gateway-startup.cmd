@echo off
setlocal

set "PROJECT_DIR=C:\Users\nexge\New folder\nexgen-studio\nexgen-studio\nexus-app"

powershell.exe -WindowStyle Hidden -ExecutionPolicy Bypass -Command ^
  "Start-Process -WindowStyle Hidden -FilePath powershell.exe -ArgumentList '-ExecutionPolicy','Bypass','-File','%PROJECT_DIR%\scripts\openclaw.ps1','gateway','run' -WorkingDirectory '%PROJECT_DIR%'"

endlocal
