@echo off
echo ========================================
echo 戈尔基康复训练系统 - 项目精简脚本
echo ========================================
echo.
echo 警告：此脚本将删除项目中的非核心文件
echo 建议先备份整个项目！
echo.
pause

echo.
echo [1/6] 删除所有 Zone.Identifier 文件...
del /s /q *Zone.Identifier* 2>nul
echo 完成！

echo.
echo [2/6] 精简 docs 文件夹...
del /q "docs\*SNOWBALL*.md" 2>nul
del /q "docs\*SNOWBALL*.md*Identifier" 2>nul
del /q "docs\LANE_GAME_RESEARCH.md*" 2>nul
del /q "docs\*test*.md*" 2>nul
del /q "docs\phase8*.md*" 2>nul
del /q "docs\hm-test*.md*" 2>nul
echo 完成！

echo.
echo [3/6] 删除测试临时文件...
rmdir /s /q ".playwright-mcp" 2>nul
rmdir /s /q "test-results" 2>nul
rmdir /s /q "test_screenshots" 2>nul
del /q "AUTOMATED_TEST_REPORT.md*" 2>nul
del /q "UI_TEST_REPORT.md*" 2>nul
del /q "standby-test-mode-modification.md*" 2>nul
echo 完成！

echo.
echo [4/6] 移除 extra_tool 文件夹...
if exist "extra_tool" (
    echo 正在备份 extra_tool 到上级目录...
    move "extra_tool" "..\extra_tool_backup_%date:~0,4%%date:~5,2%%date:~8,2%" >nul 2>&1
    echo 完成！
) else (
    echo extra_tool 文件夹不存在，跳过...
)

echo.
echo [5/6] 删除 Obelab 相关文件...
del /q "src\components\ObelabTrainingView.vue*" 2>nul
echo 完成！

echo.
echo [6/6] 删除 .git 中的 Zone.Identifier 文件...
cd .git
del /s /q *Zone.Identifier* 2>nul
cd ..
echo 完成！

echo.
echo ========================================
echo 项目精简完成！
echo ========================================
echo.
echo 建议执行以下操作：
echo 1. 运行 npm install 确保依赖正常
echo 2. 运行 npm run dev 测试项目是否正常运行
echo 3. 使用 git status 查看文件变更
echo.
pause