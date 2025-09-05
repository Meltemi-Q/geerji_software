# 仓库指南

## 项目结构与模块组织
- `src/`: Vue 3 前端应用；组件在 `components/`，工具在 `utils/`，Web Workers 在 `workers/`。
- `public/`: 静态资源与入口 `index.html`。
- `tests/`: Playwright 用例（`*.spec.js`）；截图与产物在 `test-results/`、`test_screenshots/`。
- `fnirs_sdk/` 与 `fnirs_data_server.py`: Python SDK 与本地数据/API 服务。
- `docs/`、`screenshots/` 与报告（如 `UI_TEST_REPORT.md`）用于参考。

## 构建、测试与开发命令
- 安装依赖：`npm install`
- 前端开发：`npm run dev`（默认 3000）。运行用例常用 3001：`npm run dev -- --port 3001`。
- 构建/预览：`npm run build` / `npm run preview`。
- 后端服务（Windows 示例）：`python -m venv .venv && .venv\\Scripts\\activate && pip install -r requirements.txt && python fnirs_data_server.py`（默认 8091）。
- UI 测试：`npm test`（无头）或 `npm run test:ui`（带 UI）。端口占用可用 `./kill-ports-3000-8090.bat` 释放。

## 代码风格与命名约定
- JS/Vue：2 空格缩进，ESM 模块，别名 `@` 指向 `src`。组件用 PascalCase（如 `TrainingView.vue`），工具用 CamelCase（如 `HeatmapRenderer.js`）。测试选择器优先使用 `data-testid`。
- Python：遵循 PEP 8，4 空格缩进，文件/标识符用 snake_case，建议补充类型标注。

## 测试规范
- 框架：Playwright（`@playwright/test`）。用例放在 `tests/*.spec.js`。
- 基础 URL：多数用例假定 `http://localhost:3001/`；执行测试请将 Vite 端口切至 3001，并确保后端 8091 已启动。
- 产物：截图/日志输出至 `test-results/`（以及 `test_screenshots/`）。

## 提交与 Pull Request 规范
- 提交信息：推荐 Conventional Commits（如 `feat:`、`fix:`、`docs:`）。简短祈使句；中英文皆可。
- PR 要求：说明目的与影响、关联 issue、提供测试说明与 UI 截图（如有），确保本地 Playwright 用例通过且改动聚焦。

## 安全与配置提示
- 不要提交密钥或大体积二进制，遵守 `.gitignore`。优先使用本地虚拟环境 `.venv/`。
- 默认端口：前端 3000/3001，后端 8091；如有冲突请调整或释放端口。

