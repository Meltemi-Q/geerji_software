# 关键运行流程（根 → 枝 → 果）

以下选出 5 条对整体行为最关键的流程，从触发点开始，沿调用链描述主要步骤与副作用。

## 流程 1：Electron 桌面应用启动与后端进程管理

### 触发点

- 用户启动桌面应用（打包 EXE）或在开发环境执行 `npm run dev:electron` / `electron .`，由 Electron 加载 `electron/main.cjs` 作为主进程入口。

### 调用链与步骤

1. **`electron/main.cjs` 顶层脚本初始化**  
   - 加载 `electron.app`、`BrowserWindow`、`child_process.spawn`；  
   - 定义 `resolveBackendPath()`，负责根据 `process.resourcesPath` 或 `backend_bin/` 路径查找 `fnirs_server[.exe]`。

2. **`app.whenReady().then(...)`**  
   - 调用 `startBackend()`：
     - 使用 `resolveBackendPath()` 确定后端可执行文件路径；  
     - 通过 `spawn(exe, [], {stdio: 'ignore', env, windowsHide: true})` 启动后端进程，将句柄保存到 `backendProcess`。
   - 调用 `createWindow()`：
     - 创建 `BrowserWindow({ width: 1280, height: 800, webPreferences: { nodeIntegration: false, contextIsolation: true } })`；  
     - `removeMenu()` 去掉默认菜单；  
     - `loadFile(path.join(__dirname, '..', 'dist', 'index.html'))` 加载前端。

3. **应用关闭**  
   - `app.on('window-all-closed')` 调用 `app.quit()`；  
   - `before-quit` / `quit` 事件中调用 `stopBackend()`：若 `backendProcess` 存在则调用 `.kill()`。

### 副作用

- 启动一个长期运行的本地 fNIRS HTTP 服务进程（`fnirs_server[.exe]`），暴露 `/api/fnirs/*` 端点（实现类逻辑与 `fnirs_data_server.py` 类似）；  
- 创建桌面窗口并加载前端界面，使用户可以访问 Standby / Training / Assessment 功能；  
- 关闭窗口时确保子进程被清理，避免资源泄露。

---

## 流程 2：前端应用启动与自动训练激活

### 触发点

- 浏览器加载 `index.html`（开发模式下 Vite 服务，打包模式下被 Electron 窗口加载），触发 `src/main.js` 执行。

### 调用链与步骤

1. **初始化全局认证与错误处理（`src/main.js`）**  
   - `setupAuthInterceptor()`：  
     - 包装 `window.fetch`，针对 URL 包含 `/api/` 的请求自动添加 `X-API-Key` / `X-Device-ID` / `X-Timestamp` / `X-Signature` 等头。  
     - 检测 URL 是否为 `/api/fnirs/*` 或 `localhost:8090`，若是则跳过认证头以减少 CORS 复杂度。  
   - `setupGlobalErrorHandling()`：  
     - 注册全局 JS 错误和未捕获 Promise 拒绝处理函数，统一调用 `handleError()` 分类记录 + 弹出通知 + 尝试向 `/api/logs/error` 上报。  
   - `validateAuthStatus()`：读取 `localStorage.fnirs_api_key` 和 `device_id` 并在控制台输出认证状态。

2. **创建 Vue 应用与挂载根组件**  
   - `const app = createApp(App)`；  
   - 设置 `app.config.errorHandler = (error, instance, info) => handleError(error, 'Vue组件: ' + info)`；  
   - 将 `handleError` 挂到 `app.config.globalProperties.$handleError` 及 `window.$handleError`；  
   - `app.mount('#app')`，注入 `App.vue`。

3. **根组件初始化（`App.vue` → `setup()` / `onMounted`）**  
   - 初始化所有 `ref` 状态：`appState`, `patientInfo`, `deviceStatus`, `kangzhuxiaStatus`, `trainingStatus`, `hboData/hbrData`, `dataHistory`, `currentValues`, `selectedTimeRange`, `brainActivityScore`, `assessmentText`, `trainingSummary` 等。  
   - 注册 `hashchange`、`popstate` 监听，并立即执行一遍 `checkRoute()`：  
     - `#training` → 若不在 training 状态则切换 `appState = 'training'` 并调用 `startTraining()`；  
     - `#assessment` → `appState = 'assessment'`；  
     - 默认 → `appState = 'standby'`。  
   - 异步 `loadChannelMap()`：若 `GET /config/channel_map.json` 成功，则将结果数组挂到 `window.__CHANNEL_MAP__`。  
   - 从 `localStorage.patientInfo` 恢复患者信息，并设置到 `patientInfo`；  
   - 调用 `sessionManager.restoreSession()`：  
     - 若存在有效的 `current_session` 且未过期，则恢复 `currentSession`、`sessionStats` 与缓冲区，同时重新开启自动保存与批量上传定时器。  
   - 启动每秒更新 `currentTime` 的计时器；  
   - 在 `onMounted` 尾部尝试 `if (!trainingStatus.value.isTraining) await startTraining()`：  
     - 若成功，则自动进入训练状态并开始数据流；  
     - 失败时将错误打印到控制台，但不会终止应用。

### 副作用

- 在浏览器级别建立了统一的 API 认证与错误处理机制，所有后续云端请求都会带上签名；
- `AppState` 被初始化为 `standby`/`training`/`assessment`，并根据 URL hash 及历史会话决定是否直接进入训练或评估界面；
- 本地 `localStorage` 中已有的患者信息与训练会话状态会被恢复，增强应用在刷新/异常退出后的恢复能力；
- 若条件允许，会自动进入训练状态并启动 fNIRS 数据流（见下一流程）。

---

## 流程 3：单次训练会话生命周期（开始 → 数据流 → 结束 → 评估）

### 触发点

- 用户在 Standby 界面点击“开始训练”（`StandbyView` 发出 `@start-training` 事件），或 App 自动在 `onMounted` 尝试 `startTraining()`。

### 调用链与步骤

1. **`App.vue.startTraining()`（核心入口）**

   ```js
   async function startTraining() {
     loadPatientInfo()
     const syncResult = await userDataService.syncCurrentPatientToCloud()
     const sessionResult = await sessionManager.startSession('brain')
     if (!kangzhuxiaStatus.value.connected) await connectKangzhuxia()
     appState.value = 'training'
     trainingStatus.value = { isTraining: true, duration: 0, ... }
     trainingStartMs = Date.now()
     dataHistory.value = []
     selectedTimeRange.value = { start: 0, end: 0 }
     startDataSimulation()
     startKangzhuxiaCollection().catch(...)
   }
   ```

2. **患者信息同步（`UserDataService.syncCurrentPatientToCloud()`）**  
   - 从 `localStorage.patientInfo` 读出最后登记的患者数据；
   - 若不存在，则生成 `LOCAL_*` 患者 ID 并写入 `current_patient_id`，以离线模式继续训练；  
   - 若存在，则调用 `createPatient(cloudPatientData)` → 远端 `POST /api/patients` 或等价 API；  
   - 成功则更新 `current_patient_id` 为云端返回的 ID，并将其写回 `patientInfo`；  
   - 若云端失败，则生成 `LOCAL_*` ID，记录错误并进入离线模式（仍返回 `success: true` 表示本地 ID 创建成功）。

3. **会话启动（`sessionManager.startSession('brain')`）**  
   - 检查 `currentSession` 是否存在未完成会话，如有则 `await endSession()` 强制结束并尝试上传；  
   - 从 `localStorage.current_patient_id` 获取当前患者 ID，若为空则抛出错误；  
   - 生成 `SESSION_*` ID，构造 `sessionData`，写入 `current_session`；  
   - 若 `cloudMode === 'realtime'`，调用 `cloudAPI.createTrainingSession(sessionData)`，成功后写入 `current_session_id` 并启用云端批量上传；  
   - 重置 `hboDataBuffer` 与 `sessionStats`，根据 `cloudEnabled` 决定是否启动 `uploadTimer`。

4. **康助侠设备连接（前端模拟逻辑）**  
   - `App.connectKangzhuxia()`：当前项目中为纯前端模拟，使用 `setTimeout` 和内部状态更新模拟连接/采集开启/停止，只更新 `kangzhuxiaStatus` 与 `deviceStatus.kangzhuxia`。

5. **进入训练界面与数据流（`App.startDataSimulation()`）**  
   - 启动 `dataUpdateTimer = setInterval(..., 125ms)`（8Hz）；
   - 每个 tick：
     - 若 `trainingStatus.isTraining` 为 `true`：  
       - 使用真实时间计算训练持续秒数（`trainingStatus.duration`）；  
       - 调用 `fetchRealFNIRSData()`：
         - 构造 `apiUrl = FNIRS_API_BASE + '/api/fnirs/data'`（默认 `http://localhost:8090`）；  
         - `fetch(apiUrl)` → 若成功则解析 JSON：`hbo_data/hbr_data/hbo_stats/hbr_stats/timestamp/frame_id`；  
         - 若失败（如本地服务器未启动），则打印详细错误信息，并生成生理合理的本地模拟数据，同时在控制台提示“请检查 fnirs_data_server.py”；  
       - 将得到的 `hboData/hbrData` 写入根状态的 `hboData/hbrData`；  
       - 调用 `storeHistoryFrame()` 将当前帧（含统计值）推入 `dataHistory`，并维护滑动窗口大小（最大 1500 帧 + 定期内存清理），更新 `selectedTimeRange`；  
       - 更新 `currentValues`（平均 HbO/HbR 与变化趋势）；
     - 若未在训练状态，则只打印调试日志，不更新数据。

6. **训练结束（正常完成：`App.stopTraining()`）**  
   - 切换 `appState = 'assessment'`，将 `trainingStatus.isTraining = false`；  
   - 调用 `stopKangzhuxiaCollection()`（模拟停止外骨骼数据）与 `stopDataSimulation()`（清除 `dataUpdateTimer`）；  
   - 调用 `sessionManager.endSession({ training_mode: 'completed', duration, stop_reason: 'normal_completion' })`：  
     - 停止批量上传定时器，上传剩余 `hboDataBuffer`（若云端开启）；  
     - 填充 `session_end`, `duration`, `session_stats` 等字段，并尝试调用 `cloudAPI.completeTrainingSession()`；  
     - 若失败则写入本地 `offline_session_*`；  
     - 清空 `currentSession`、缓冲区与 `current_session` 本地存储；  
   - 重置 `trainingStartMs`，清空 `dataHistory` 与 `selectedTimeRange`；  
   - 调用 `generateAssessmentData()`：  
     - （容错性）尝试获取一帧 fNIRS 数据；  
     - 使用当前平均值更新 `trainingSummary`（时长与平均 HbO/HbR 变化）。

7. **评估与记录保存（与流程 5 相关，略见下文）**

### 副作用

- `localStorage.current_patient_id` 与 `patientInfo` 被更新，确保训练与云端患者关联；
- 训练过程中的所有实时 fNIRS 帧数据被存于浏览器内存 `dataHistory`，用于曲线/热力图展示；
- 若启用实时云端模式，将分批将 `hboDataBuffer` 中的 HbO 数据点上传到云端服务器；
- 训练正常结束时，会话的整体统计与评估数据会被上传或本地缓存，为报告和后续分析提供素材。

---

## 流程 4：本地 fNIRS 数据 HTTP 流（水下：设备→SDK→服务→前端）

### 触发点

- `fnirs_data_server.py` 作为独立进程被启动（开发时手动 `python fnirs_data_server.py --port 8090`，打包应用中通过 `fnirs_server.exe`）；  
- 前端 `App.vue` 中的 `fetchRealFNIRSData()` 周期性对 `/api/fnirs/data` 发起请求。

### 调用链与步骤（后端）

1. **`FNIRSDataServer.__init__()`**  
   - `self.processor = FNIRSProcessor()`（若导入成功）；  
   - 调用 `self.processor.connect_device()`，真实设备连接失败时进入“模拟模式”，仅使用内部模拟数据循环；  
   - 成功连接则调用 `self.processor.start_data_stream()`（真实设备模式）。

2. **数据更新线程 `FNIRSDataServer.update_data()`**  
   - 每 `1/8` 秒执行一次：  
     - 若 `self.processor` 存在：
       - 调用 `brain_data = self.processor.get_oxygen_data()`：  
         - 内部会根据设备/加密数据/模拟模式选择不同路径；  
         - 输出 `BrainOxygenData` 对象，内部字段包括：`HbO`, `HbR`, `frame_id`, `timestamp`, `device_status` 等。
       - 转为 numpy array 以便后续统计：`hbo_arr = np.asarray(brain_data.HbO)` / `hbr_arr = ...`；  
       - 计算统计量 `mean/std/min/max`，生成 `self.current_data = {...}`。  
     - 若 `self.processor` 不存在（导入失败）：  
       - 使用 `generate_realistic_fnirs_data()` 直接生成 432 通道 HbO/HbR 模拟数据，并计算统计量；  
       - 写入 `self.current_data`。
   - 使用 `frame_id` 自增进行帧编号。

3. **HTTP 请求处理（`FNIRSRequestHandler.do_GET()`）**  
   - 对 `/api/fnirs/data` 路径：  
     - 设置 CORS 与 JSON 头；  
     - `response = self.server.fnirs_data_server.current_data`；  
     - `self.wfile.write(json.dumps(response, indent=2).encode())`。  
   - 对 `/api/fnirs/hbo` / `/api/fnirs/hbr` / `/api/fnirs/config` / `/api/fnirs/layout` 进行类似结构化返回或错误回退。

### 调用链与步骤（前端）

1. **`App.fetchRealFNIRSData()`**  
   - 构造 `apiUrl = FNIRS_API_BASE + '/api/fnirs/data'`，默认 `http://localhost:8090`（可由环境变量 `VITE_API_BASE_URL` 覆盖）；  
   - `fetch(apiUrl)` → 解析 JSON，映射为：
     - 数组 `hboData`/`hbrData`（432 通道）；  
     - 统计对象 `hboStats`/`hbrStats`（若缺失则通过数组计算）；  
     - `timestamp`（秒）与 `frameId`（帧号）。
   - 失败时：
     - 记录详细错误日志（包含 URL、错误 message 与 stack）；  
     - 生成 fallback 模拟数据：`generateRealisticFNIRSData()`（纯前端版本），并标记 `fallbackMode: true`。

2. **`App.storeHistoryFrame()` & `startDataSimulation()` 中的使用**  
   - 对 `fetchRealFNIRSData()` 返回的数据执行深拷贝后入 `dataHistory`，维持最多约 3 分钟（1500 帧）历史；  
   - 每 100 帧输出一次浏览器堆内存占用，以监控内存泄漏风险；  
   - 更新 `selectedTimeRange` 的滚动窗口，以便 `CurveModeView` 按指定帧范围绘制曲线。

### 副作用

- 实现了从设备/加密数据到前端 432 通道 HbO/HbR 时间序列的完整闭环；  
- 提供清晰的错误与回退机制：即使后端未启动，前端仍可通过模拟波形呈现 UI，便于演示与联调；  
- 为热力图与曲线视图提供高质量、高采样率的输入数据。

---

## 流程 5：评估结果保存与云端上传（截图 + 会话完成）

### 触发点

- 用户在评估界面（`AssessmentView.vue`）中点击“保存记录”按钮，触发 `handleSaveRecord()`；  
- 结束后还会通过 `emit('save-record')` 通知 `App.vue` 的 `saveRecord()`，进行本地记录补充。

### 调用链与步骤

1. **`AssessmentView.handleSaveRecord()`**

   ```js
   async function handleSaveRecord() {
     uploadStatus = { isUploading: true, progress: '正在截图保存...', ... }
     const screenshotResult = await captureAssessment({...})
     const uploadResult = await cloudAPI.uploadScreenshot(screenshotResult.dataUrl, { ... })
     uploadStatus.progress = '正在保存训练数据...'
     const sessionResult = await sessionManager.endSession(sessionData)
     if (sessionResult.success) { uploadStatus.success = true } ...
     emit('save-record')
   }
   ```

   - 步骤：
     1. 更新 `uploadStatus`，提示正在截图；  
     2. 调用 `captureAssessment()`（`utils/screenshotCapture.js`）：  
        - 找到 `.obelab-assessment-view` 等评估界面容器；  
        - 使用 `html2canvas` 生成高分辨率 PNG，并返回 `dataUrl`（Base64）与宽高信息。  
     3. 将截图上传云端：`cloudAPI.uploadScreenshot(dataUrl, { type: 'assessment', session_id: sessionManager.currentSession?.session_id, dimensions })`；  
        - 内部调用 `GeerjiCloudAPI._request('/api/upload/data', ...)`，实际向远端 `POST` 上传 `FormData`（`data_type: 'screenshot'` 等）。  
        - 若失败则打印警告，但不阻断后续流程。  
     4. 构造 `sessionData`，将评估用到的字段（`activity_level` / HbO/HbR 平均变化 / `brainActivityScore` / `assessmentText` 等）打包；  
     5. 再次调用 `sessionManager.endSession(sessionData)`，这次会用更丰富的评估信息覆盖之前普通结束时上传的数据；  
     6. 根据结果更新 `uploadStatus`（成功或失败），并在短暂延时后自动清除成功提示；  
     7. 无论成功与否，调用 `emit('save-record')`，保证上层逻辑能执行“离线保存”兜底。

2. **`App.vue.saveRecord()`（上层离线/本地记录）**  
   - 获取 `sessionManager.getSessionStatus()`：
     - 若当前没有活动会话且无历史 session，则构造 `offlineRecord`（包含患者信息、训练总结、评估文字等）并写入 `localStorage.training_record_*`。  
     - 若有有效 session，则构造 `trainingRecord` 对象（包括 `patient_info`、`training_summary`、`assessment`、`session_info` 等），同样写入本地 `training_record_*`，并打印日志；  
   - 若 `current_patient_id` 存在，可扩展进一步上传完整记录到云端（目前注释中表示已有 `sessionManager` 在 `endSession` 时做主要上传工作，此处暂作为附加信息）。

### 副作用

- 生成前端评估界面的高质量截图并上传到云端，为医生或远程分析提供可视化报告；  
- 保证训练会话的完整统计与评估文本被发送到云端 `complete_session` 接口，或在云端不可用时写入本地离线缓存，以便后续重试；  
- 始终在本地 `localStorage` 保持一份训练记录（即便云端流程失败），增强数据安全与可追溯性。
