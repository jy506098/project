@echo off
REM 在 app/ 下创建硬链接，让 app/users.json / app/messages.json 指向 website/ 的同一份文件
REM 这样 desktop 壳和 website 后端共享一份用户和留言数据
REM
REM 如果以后想独立运行 app/（不共享 website 数据），删掉这两个链接即可：
REM     del app\users.json
REM     del app\messages.json
REM 之后 app/ 会从空 {} 开始自己的数据。
REM
REM Windows 上 mklink /H 是硬链接（同一份数据两个路径），不需要管理员权限。

setlocal
set "PROJECT_ROOT=%~dp0.."
set "WEBSITE=%PROJECT_ROOT%\website"
set "APP=%~dp0."

if not exist "%WEBSITE%\users.json" (
    echo [错误] %WEBSITE%\users.json 不存在，请先跑过一次 website/app.py 让它自动生成
    exit /b 1
)

if exist "%APP%\users.json" (
    if not exist "%APP%\users.json\*" (
        echo [提示] %APP%\users.json 已存在，跳过
    ) else (
        echo [跳过] %APP%\users.json 已存在
    )
) else (
    mklink /H "%APP%\users.json" "%WEBSITE%\users.json"
    if errorlevel 1 (
        echo [错误] 创建 users.json 硬链接失败
        exit /b 1
    )
    echo [OK] 已创建 %APP%\users.json -^> %WEBSITE%\users.json
)

if exist "%APP%\messages.json" (
    echo [跳过] %APP%\messages.json 已存在
) else (
    mklink /H "%APP%\messages.json" "%WEBSITE%\messages.json"
    if errorlevel 1 (
        echo [错误] 创建 messages.json 硬链接失败
        exit /b 1
    )
    echo [OK] 已创建 %APP%\messages.json -^> %WEBSITE%\messages.json
)

echo.
echo 完成。app/ 与 website/ 现在共享同一份 users.json / messages.json。
endlocal
