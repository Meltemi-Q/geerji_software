# 开发记录（脑图模式热力图）

日期: 2025-09-03

变更要点
- 新增 Playwright MCP 配置：`.playwright-mcp/config.json`，脚本：`npm run mcp`。
- 统一布局数据入口：
  - BrainModeView：改为从 `/renumbered_full_layout.json` 加载（public 目录）。
  - HeatmapModeView、fnirsLayout：改为从 `/config/triangle_layout.json` 加载。
  - 旧 `TrainingView.vue` 的布局路径也同步修复，避免误用 404。
- 引入“通道映射”预留：
  - `pytools/generate_channel_map.py`：从 `recordingdata.toml` 生成 `public/config/channel_map.json`。
  - `TriangleDataProcessor` 支持读取全局 `window.__CHANNEL_MAP__`，若存在则按 432 顺序生成通道中点；否则回退为 sources×detectors 全组合。
- 新增文档：`docs/TESTING_MCP.md`（MCP 使用方式）。

后续计划
- 生成并提交 `public/config/channel_map.json`（需本地 Python 执行脚本）。
- 将 BrainMode 默认刷新节奏改为“随数据帧更新”，减少定时重绘。
- 评估 concave hull + 渐变掩膜对边缘贴合的提升效果。

测试建议
- 使用 MCP：`npm run mcp`，在客户端依次导航到 `http://localhost:3001/`，检查脑图模式下热力图是否随窗口缩放保持对齐。
- Playwright 用例：`npm run test` / `npm run test:ui`（本地需安装 Playwright 浏览器）。

