# 从入口到主干

## 1. Electron 主进程入口：`electron/main.cjs`

### 1.1 启动逻辑与入口函数

- 该文件在 `package.json` 中被声明为 `main`，由 Electron 作为主进程入口加载。  
- 顶层逻辑：

  ```js
  const { app, BrowserWindow } = require('electron')
  const { spawn } = require('child_process')
  let backendProcess = null

  function resolveBackendPath() { ... }
  function startBackend() { ... }
  function stopBackend() { ... }
  function createWindow() { ... }

  app.whenReady().then(() => {
    startBackend()
    createWindow()
  })

  app.on('window-all-closed', () => { app.quit() })
  app.on('before-quit', stopBackend)
  app.on('quit', stopBackend)
  ```

- 主入口可以理解为 `app.whenReady().then(() => { startBackend(); createWindow(); })`。

### 1.2 直接创建/调用的主干对象与职责

- **`backendProcess`（`child_process.spawn` 返回的进程句柄）**  
  - 由 `startBackend()` 创建，指向打包或开发环境中的 `fnirs_server(.exe)`。  
  - 职责：在应用生命周期内保持本地 fNIRS HTTP 服务运行；应用退出时通过 `stopBackend()` 被安全终止。

- **`BrowserWindow` 主窗口实例**  
  - 在 `createWindow()` 中创建，配置为 1280×800、隐藏菜单栏。  
  - 加载目标：`path.join(__dirname, '..', 'dist', 'index.html')`，由 Vite 打包的前端入口页面。  
  - 职责：承载 Vue 前端 SPA，向用户呈现待机/训练/评估三个主要界面。

- **`electron.app` 生命周期事件处理**  
  - `whenReady`：启动后端 + 创建窗口。  
  - `window-all-closed`：调用 `app.quit()` 以关闭应用。  
  - `before-quit` / `quit`：调用 `stopBackend()`，确保子进程被回收。

### 1.3 调用/依赖关系示意

```text
OS / 用户
  └─ electron main (electron/main.cjs)
      ├─ startBackend()
      │   ├─ resolveBackendPath()
      │   └─ spawn(exe=backend_bin/fnirs_server[.exe])
      │       └─ (内部运行 Python 打包的 fNIRS 数据 HTTP 服务)
      └─ createWindow()
          └─ BrowserWindow.loadFile('dist/index.html')
              └─ 前端 bundle → src/main.js → App.vue
```

---

## 2. Web 前端入口：`src/main.js`

### 2.1 启动逻辑与入口过程

- 文件内容结构（简化）：

  ```js
  import { createApp } from 'vue'
  import App from './App.vue'
  import { setupAuthInterceptor, validateAuthStatus } from './utils/apiAuth.js'
  import { setupGlobalErrorHandling, handleError } from './utils/errorHandler.js'

  setupAuthInterceptor()
  setupGlobalErrorHandling()
  const authStatus = validateAuthStatus()
  const app = createApp(App)

  app.config.errorHandler = (error, instance, info) => {
    console.error('Vue全局错误:', error, info)
    handleError(error, `Vue组件: ${info}`)
  }

  app.config.globalProperties.$handleError = handleError
  window.$handleError = handleError

  app.mount('#app')
  ```

- 无显式 `main()` 函数，顶层脚本即为入口逻辑，其“主干”可以视作：
  - `setupAuthInterceptor()` + `setupGlobalErrorHandling()`  
  - `createApp(App)` + 全局错误处理配置 + `mount('#app')`

### 2.2 主干对象与职责

- **认证与签名层（`utils/apiAuth.js`）**
  - `setupAuthInterceptor()`：  
    - 包装 `window.fetch`，对 URL 中包含 `/api/` 的请求自动附加认证头（`X-API-Key`、`X-Device-ID`、`X-Timestamp`、`X-Signature` 等）。
    - 显式跳过本地 fNIRS 数据接口（`/api/fnirs/*` 和 `localhost:8090`），避免无意义的 CORS 预检与签名。
  - `getAuthHeaders()` / `regenerateAuth()` / `validateAuthStatus()`：维护 `localStorage` 中的 `fnirs_api_key` 与 `device_id`，保证后续云端调用有稳定标识。

- **统一错误处理层（`utils/errorHandler.js`）**
  - `setupGlobalErrorHandling()`：监听全局 JS 错误和未捕获 Promise 拒绝，调用 `handleError(error, context)` 进行：
    - 错误分类（网络/认证/API/数据/设备/权限/校验/未知）；  
    - 记录到本地 `localStorage.error_logs`，并尝试向 `/api/logs/error` 上报；  
    - 弹出 UI 通知（简单的浮层 DOM），提示用户问题与操作建议。
  - `handleError()`、`handleApiError()` 等：为业务代码提供统一错误入口。

- **前端应用实例（`App.vue` 组件）**
  - 由 `createApp(App)` 创建，并通过 `app.config.errorHandler` 挂接错误处理；  
  - `App` 的 `setup()` 中集中管理：
    - 应用状态 `appState`（`'standby' | 'training' | 'assessment'`）；  
    - 设备状态 `deviceStatus` / `kangzhuxiaStatus`；  
    - 训练计时与 432 通道数据 `hboData/hbrData/dataHistory/currentValues`；  
    - 会话管理与患者同步（`sessionManager`、`userDataService`、`geerjiCloudAPI`）。

### 2.3 调用/依赖关系示意

```text
src/main.js
  ├─ setupAuthInterceptor()        ──> utils/apiAuth.js
  ├─ setupGlobalErrorHandling()    ──> utils/errorHandler.js
  ├─ validateAuthStatus()          ──> 本地认证状态检查
  └─ createApp(App.vue)
      ├─ Vue 全局错误 → handleError()
      └─ App.vue （根组件）
          ├─ StandbyView.vue
          │   ├─ PatientInfoModal.vue
          │   ├─ SearchableUserSelect.vue
          │   └─ userDataService (services/UserDataService.js)
          ├─ TrainingContainer.vue
          │   ├─ controls/ModeSelector.vue
          │   ├─ controls/TrainingControls.vue
          │   └─ modes/CurveModeView.vue / GameModeView.vue / game/*
          ├─ AssessmentView.vue
          │   ├─ utils/screenshotCapture.js
          │   ├─ sessionManager (services/sessionManager.js)
          │   └─ cloudAPI (services/geerjiCloudAPI.js)
          └─ services/sessionManager.js / UserDataService.js / geerjiCloudAPI.js
```

---

## 3. 本地 fNIRS HTTP 服务入口：`fnirs_data_server.py`

### 3.1 启动逻辑与入口函数

- 文件底部：

  ```py
  if __name__ == "__main__":
      import argparse
      parser = argparse.ArgumentParser(description='fNIRS数据HTTP服务器')
      parser.add_argument('--port', type=int, default=8090, help='服务器端口 (默认: 8090)')
      args = parser.parse_args()
      
      server = FNIRSDataServer(port=args.port)
      server.start()
  ```

- `FNIRSDataServer.start()` 做两件事：
  1. 将 `self.is_running = True`，启动数据更新线程 `self.data_thread = Thread(target=self.update_data, daemon=True)`；
  2. 创建 `HTTPServer(('localhost', self.port), FNIRSRequestHandler)`，将 `server.fnirs_data_server = self` 挂入，随后 `serve_forever()`。

### 3.2 主干对象与职责

- **`FNIRSDataServer`（Python 类，主服务对象）**
  - 构造函数中：
    - 试图导入 `FNIRSProcessor`（`fnirs_sdk.processor.FNIRSProcessor`），并在成功时：
      - 调用 `self.processor.connect_device()`，若成功则 `self.processor.start_data_stream()`，以 8Hz 采集原始强度并计算 HbO/HbR；
      - 若连接失败或导入失败，则进入“模拟模式”，使用内部 `generate_realistic_fnirs_data()` 生成生理合理的 432 通道波形。
    - 初始化 `self.current_data` 为默认小数值数组（432 通道 HbO/HbR）。
  - `update_data()` 后台线程：
    - 每隔 `1/8` 秒从 `FNIRSProcessor.get_oxygen_data()` 读取最新 HbO/HbR（真实或加密/模拟来源），或退回 `generate_realistic_fnirs_data()`；
    - 将结果转为纯 Python 对象放入 `self.current_data`，附加 `timestamp`, `frame_id` 以及 `hbo_stats`/`hbr_stats`（均值、标准差、最小/最大值）。
  - `get_dock_configuration()` / `get_complete_layout_info()`：
    - 尝试从 SDK 中获取 6-dock 动态布局信息，结合 12-dock 静态 JSON（如 `renumbered_full_layout.json`），为前端热力图提供更精细的布局元数据。

- **`FNIRSRequestHandler`（`BaseHTTPRequestHandler` 子类）**
  - `do_GET()` 实现一组 HTTP JSON 接口：
    - `/api/fnirs/data`：直接回传 `self.server.fnirs_data_server.current_data`；
    - `/api/fnirs/hbo`、`/api/fnirs/hbr`：按需返回某一血红蛋白分量及其统计；
    - `/api/fnirs/config`：返回 6-dock 动态配置（若 SDK 可用）或错误提示给前端，以提示使用静态 `triangle_layout.json` 兜底；
    - `/api/fnirs/layout`：组合 12-dock 静态布局与 6-dock 动态布局，输出统一的布局信息结构。

### 3.3 调用/依赖关系示意

```text
CLI: python fnirs_data_server.py --port 8090
  └─ main (if __name__ == "__main__")
      └─ FNIRSDataServer(port=8090)
          ├─ __init__()
          │   ├─ try import FNIRSProcessor (fnirs_sdk/processor.py)
          │   ├─ self.processor.connect_device()
          │   └─ self.processor.start_data_stream()  (或退回模拟模式)
          └─ start()
              ├─ Thread(target=update_data).start()
              │   └─ (loop) processor.get_oxygen_data() → self.current_data
              └─ HTTPServer(('localhost', port), FNIRSRequestHandler).serve_forever()
                  └─ FNIRSRequestHandler.do_GET()
                      ├─ /api/fnirs/data   → self.server.fnirs_data_server.current_data
                      ├─ /api/fnirs/hbo    → subset of current_data
                      ├─ /api/fnirs/hbr    → subset of current_data
                      ├─ /api/fnirs/config → get_dock_configuration()
                      └─ /api/fnirs/layout → get_complete_layout_info()
```
