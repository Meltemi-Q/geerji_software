@echo off
setlocal
chcp 65001 >nul

REM 创建虚拟环境（可选）
REM python -m venv .venv && call .venv\Scripts\activate

pip install --upgrade pip wheel setuptools pyinstaller
pip install -r requirements.txt || goto :eof

REM 使用 spec 进行打包，避免中文路径与通配问题
pyinstaller --noconfirm --clean scripts\build_fnirs_backend.spec || goto :eof

REM 输出移动到 backend_bin 供 Electron 使用
if not exist backend_bin mkdir backend_bin
copy /Y dist\fnirs_server\fnirs_server.exe backend_bin\fnirs_server.exe >nul

REM 结束
exit /b 0

