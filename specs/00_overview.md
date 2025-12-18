# 项目与根的总览

## 项目大致功能

本仓库实现的是一套面向近红外脑机交互的康复训练系统（戈尔基康复训练系统 / “康助侠平板端UI演示系统”）：
- 前端是一个基于浏览器（或 Electron 壳）的平板式 UI，用于完成患者信息登记、训练过程展示（曲线 / 游戏 / 热力图）、以及训练结束后的评估与记录保存。
- 后端包含两部分：一是本地 fNIRS 数据 HTTP 服务（基于 `fnirs_sdk` 对真实/模拟设备采集并处理 432 通道脑血氧数据），二是访问远端戈尔基云 API 的客户端，用于患者档案与训练会话数据的上传与持久化。
- 通过 Electron 封装将前端与本地 fNIRS 后端打包为桌面应用，同时保留若干 Python CLI 工具，用于布局分析、通道映射生成、报表 PDF 生成、加密数据包制作等离线任务。

## 入口（根）文件一览

在当前代码树中，可以归纳出 3 个最主要的“根”入口：

1. **Electron 主进程入口（桌面壳层）**  
   - 文件：`electron/main.cjs`（`package.json.main` 指向）  
   - 作用：作为桌面应用主进程入口，负责：
     - 解析打包后后端可执行文件路径（`backend/fnirs_server[.exe]`）并通过 `child_process.spawn` 启动；
     - 创建 `BrowserWindow` 并加载打包后的前端页面 `dist/index.html`；
     - 在应用退出时优雅地终止后端进程。

2. **前端 Web 应用入口（Vite + Vue）**  
   - 文件：`src/main.js`  
   - 作用：作为 SPA 的浏览器入口，负责：
     - 初始化 API 认证拦截器（`setupAuthInterceptor`）与全局错误处理（`setupGlobalErrorHandling`），并打印认证状态；
     - `createApp(App)` 并挂载到 `#app`，同时配置 Vue 全局错误处理，将 `handleError` 挂到 `app.config.errorHandler` 和 `window.$handleError`；
     - 将根组件 `App.vue` 作为整个前端 UI 树的主干。

3. **本地 fNIRS 数据 HTTP 服务器入口**  
   - 文件：`fnirs_data_server.py`  
   - 作用：独立运行的 Python HTTP 服务，用于：
     - 启动 `FNIRSDataServer`，内部优先尝试创建并启用 `fnirs_sdk.processor.FNIRSProcessor` 与设备数据流（8Hz），否则退回模拟数据生成；
     - 在后台线程持续更新 `current_data`（432 通道 HbO/HbR 及统计量），同时通过 `HTTPServer + FNIRSRequestHandler` 暴露 `/api/fnirs/*` 一组本地 HTTP JSON 接口（供前端 `App.vue` 周期性读取）。

> 说明：`package.json` 里还存在 `scripts.serve = "python backend/main.py"`，但当前代码树中未找到 `backend/main.py`，推测为历史/打包后入口，不在本次梳理范围。

## 项目结构简化树（根 → 主干模块 → 主要子系统）

```text
(1) electron/main.cjs  ── Electron 桌面壳
    ├─ startBackend() → spawn backend_bin/fnirs_server(.exe)
    │   └─ (内部由 Python 打包的 fNIRS HTTP 服务，逻辑可参考 fnirs_data_server.py / fnirs_sdk)
    └─ createWindow() → BrowserWindow
        └─ 加载 dist/index.html （Vite 构建产物）
            └─ bundle 入口来自 src/main.js

(2) src/main.js  ── 前端 SPA 入口
    ├─ setupAuthInterceptor()        ──> utils/apiAuth.js
    ├─ setupGlobalErrorHandling()    ──> utils/errorHandler.js
    ├─ createApp(App.vue)            ── 根组件
    │   └─ App.vue  ── 应用外壳/状态中枢
    │       ├─ StandbyView.vue       ── 待机 / 患者选择与登记
    │       ├─ TrainingContainer.vue ── 训练界面（曲线 / 游戏等模式）
    │       └─ AssessmentView.vue    ── 训练结束后的评估与报告
    │
    │       ├─ services/sessionManager.js      ── 训练会话生命周期与本地缓冲
    │       ├─ services/UserDataService.js     ── 云端患者数据缓存 / 搜索
    │       ├─ services/geerjiCloudAPI.js      ── 戈尔基云 API 封装
    │       ├─ utils/apiClient.js              ── 带重试/断路器的 HTTP 客户端
    │       ├─ utils/errorHandler.js           ── 统一错误分类 & 日志/上报
    │       ├─ utils/apiAuth.js                ── API 密钥 / 签名管理
    │       ├─ utils/fnirsLayout.js            ── Triangle 布局解析与 432 通道映射
    │       ├─ utils/GeometryUtils.js          ── 大脑轮廓/凸包/约束几何算法
    │       └─ workers/heatmapWorker.js        ── Web Worker 中的 IDW + 高斯平滑 + 掩膜

(3) fnirs_data_server.py  ── 本地 fNIRS HTTP 服务
    ├─ FNIRSDataServer
    │   ├─ FNIRSProcessor (fnirs_sdk/processor.py)      ── 设备连接 & 8Hz 数据流 & 432 通道 HbO/HbR 计算
    │   ├─ generate_realistic_fnirs_data()              ── 模拟 fallback
    │   ├─ get_dock_configuration() / get_complete_layout_info()
    │   └─ update_data() 后台线程 → self.current_data
    └─ FNIRSRequestHandler (BaseHTTPRequestHandler)
        ├─ GET /api/fnirs/data   ── 全量 HbO/HbR + 统计 + frame_id
        ├─ GET /api/fnirs/hbo    ── 仅 HbO + stats
        ├─ GET /api/fnirs/hbr    ── 仅 HbR + stats
        ├─ GET /api/fnirs/config ── 6-dock 配置（SDK 动态）
        └─ GET /api/fnirs/layout ── 12-dock + 6-dock 综合布局信息
```

## 启动流程概要（系统到“就绪状态”的路径）

### 桌面应用路径（Electron）

1. 用户启动 Electron 应用（打包可执行或 `npm run dev:electron`），Node 进入 `electron/main.cjs`。  
2. `startBackend()` 解析生产/开发环境下的 `fnirs_server[.exe]` 路径，并以后台进程方式启动（`stdio: 'ignore'`，`windowsHide: true`），构成本地 fNIRS HTTP 服务。  
3. `createWindow()` 创建 `BrowserWindow`，去掉菜单栏并加载打包后的 `dist/index.html`。  
4. `dist/index.html` 中的前端 bundle 执行，进入 `src/main.js` 启动流程（参见下一小节）。  
5. Electron 进程监听 `window-all-closed` / `before-quit` / `quit`，在退出时调用 `stopBackend()` 杀掉后端进程，完成桌面应用的生命周期管理。

### Web 前端路径（浏览器 / Electron 内嵌 WebView）

1. 浏览器加载 `index.html`（开发模式使用 Vite，打包模式由 Electron 加载 `dist/index.html`），执行 `src/main.js`。  
2. `src/main.js`：  
   - 调用 `setupAuthInterceptor()` 包装全局 `fetch`：对 `/api/` 路径自动加上 `X-API-Key` / `X-Device-ID` / `X-Signature` 等认证头（显式排除了本地 `/api/fnirs/*` 和 `localhost:8090`，避免 fNIRS 服务走签名和 CORS 预检）。  
   - 调用 `setupGlobalErrorHandling()`：注册 `window.error` 与 `unhandledrejection` 监听，将错误交给 `handleError` 统一记录 + 友好提示 + 向 `/api/logs/error` 上报。  
   - 执行 `validateAuthStatus()` 打印当前 API 密钥与设备 ID 的存在情况。  
   - `createApp(App)` 并配置 `app.config.errorHandler = handleError`，挂载全局 `$handleError`，最后 `app.mount('#app')`。

3. `App.vue` 的 `setup()` 执行并初始化核心状态（`appState`、`patientInfo`、训练状态、432 通道数据数组 `hboData/hbrData`、`dataHistory`、`currentValues` 等）：  
   - 启动路由检查 `checkRoute()`：根据 URL hash（`#training` / `#assessment` / 默认）决定进入待机/训练/评估界面。  
   - 加载 `channel_map.json`（若存在）至 `window.__CHANNEL_MAP__`，用于后续和 432 通道顺序对齐。  
   - 从 `localStorage` 恢复 `patientInfo`。  
   - 调用 `sessionManager.restoreSession()` 检查是否存在未完成的训练会话并尝试恢复。  
   - 启动每秒一次的 `currentTime` 更新计时器。  
   - 若当前处于非训练状态，则尝试自动执行 `startTraining()`，触发后续训练会话与 fNIRS 数据流（详见 03 文件中的“关键流程”）。

4. 当前端成功从本地 fNIRS HTTP 服务周期性拉取数据（`fetchRealFNIRSData` 调用 `FNIRS_API_BASE`，通常是 `http://localhost:8090/api/fnirs/data`）并将其填入 `hboData/hbrData/dataHistory/currentValues` 后，训练曲线和热力图渲染即可正常工作，系统进入“就绪”/运行态。

5. 若用户通过待机界面完成患者信息登记、设备检查，并点击“开始训练”，会显式触发一次 `startTraining()`，在已有自动启动机制的基础上同步云端患者与训练会话信息，为云端报表和后续评估做准备。
