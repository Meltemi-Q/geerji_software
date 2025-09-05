# Playwright MCP 测试指南

本项目已内置 Playwright MCP 配置，便于在支持 MCP 的客户端（VS Code Copilot、Claude、Cursor、Windsurf 等）中以“工具”方式驱动浏览器，对前端进行自动化探索与验证。

## 前置条件
- Node.js ≥ 18（本地环境）
- 已安装浏览器或由 MCP 自动下载（首次启动可能较慢）
- 前端与后端端口：前端 3000/3001，后端 8090/8091（见 `package.json` 与 `fnirs_data_server.py`）

## 启动方式
- 终端直接启动：
  - `npm run mcp`（读取 `.playwright-mcp/config.json`）
- 在 MCP 客户端中添加服务器：
  - command: `npx`
  - args: `@playwright/mcp@latest`, `--config`, `.playwright-mcp/config.json`

## 常用操作
- 在 MCP 客户端中调用工具：`browser_navigate` 打开 `http://localhost:3001/`，随后使用 `browser_click`、`browser_fill_form` 完成 UI 流程。
- `outputDir`: `.playwright-mcp/out`，会保存会话产物（如 trace、会话状态等，视配置而定）。

## 端口与权限
- 允许访问的 origin 已在配置中包含：`http://localhost:3000/3001/8090/8091`。
- 需要更改端口时，修改 `.playwright-mcp/config.json` 的 `network.allowedOrigins`。

## 与现有测试的关系
- 仍可使用 `npm test`/`npm run test:ui` 运行 Playwright 测试用例。
- MCP 更适合交互式探索、对齐定位与人工回归验证。

