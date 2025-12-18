# 主干下面的子系统（树枝）

以下按功能划分主要子系统，每个子系统列出核心模块/类/函数及其依赖关系。

## 1. 桌面壳与后端进程管理子系统

### 相关模块与主要实体

- `electron/main.cjs`, `electron/main.js`  
  - 函数：`resolveBackendPath()`, `startBackend()`, `stopBackend()`, `createWindow()`  
  - 负责在开发/生产环境中定位 `backend_bin/fnirs_server[.exe]` 或打包后的 `resources/backend/fnirs_server[.exe]`，并在 Electron 应用生命周期内启动/停止该进程；  
  - 负责创建主 `BrowserWindow`，加载前端生产构建文件 `dist/index.html`。

### 职责与依赖

- 职责：
  - 将 Vue 前端与 Python fNIRS 后端整合为一体化桌面应用；
  - 管理后端进程的生命周期，防止僵尸进程残留。
- 被谁使用：
  - 由系统/用户直接执行 Electron 应用或 `electron .` / `npm run dev:electron` 调用。
- 依赖：
  - Node 原生模块 `path`、`child_process`；
  - 构建产物目录 `dist/` 与 `backend_bin/`（由 `scripts/build_fnirs_backend.bat` 等生成）。

---

## 2. 前端应用外壳与生命周期控制子系统

### 相关模块与主要实体

- `src/main.js`  
  - 顶层脚本：`setupAuthInterceptor()`, `setupGlobalErrorHandling()`, `validateAuthStatus()`, `createApp(App)`。

- `src/App.vue`  
  - 组件名：`App`  
  - `setup()` 中的核心状态：
    - `appState`：`'standby' | 'training' | 'assessment'`  
    - `patientInfo`：当前展示患者信息（默认“张三”），从 `localStorage.patientInfo` 恢复；  
    - `deviceStatus`：`fnirs` / `kangzhuxia` 连接状态；  
    - `kangzhuxiaStatus`：外骨骼设备状态字段（是否连接、刷卡/运动/急停状态）；  
    - `trainingStatus`：训练状态（`isTraining`, `duration`, `speed`, `sessionId`）；  
    - 432 通道 fNIRS 数据：`hboData`, `hbrData`；  
    - `currentValues`：当前平均 HbO/HbR 与趋势；  
    - `dataHistory` + `selectedTimeRange`：训练过程中滚动缓存与时间选择窗口；  
    - 训练结束评估数据：`brainActivityScore`, `assessmentText`, `trainingSummary`。
  - 核心方法：
    - `startTraining()`, `pauseTraining()`, `stopTraining()`, `emergencyStop()`；  
    - `saveRecord()`, `newTraining()`, `returnToStandby()`；  
    - `fetchRealFNIRSData()`, `storeHistoryFrame()`, `getHistoryData()`, `startDataSimulation()`, `stopDataSimulation()`, `generateAssessmentData()`；  
    - 路由辅助：`checkRoute()` 监听 `hashchange` / `popstate`。

### 职责与依赖

- 职责：
  - 作为整个前端 UI 的根容器和状态中枢，协调待机界面、训练界面、评估界面之间的切换；
  - 驱动 fNIRS 数据流：通过 `fetchRealFNIRSData()` 周期性访问本地 `/api/fnirs/data`，并维护数据滚动窗口与统计信息；
  - 将训练会话与云端患者信息同步整合进训练流程（调用 `userDataService.syncCurrentPatientToCloud()` 与 `sessionManager.startSession()/endSession()`）。
- 被谁使用：
  - `src/main.js` 创建并挂载的根组件；其子组件 `StandbyView` / `TrainingContainer` / `AssessmentView` 通过 `props` 和事件从根状态读写。
- 依赖：
  - `services/sessionManager.js`（训练会话）  
  - `services/UserDataService.js`（患者云端数据）  
  - `services/geerjiCloudAPI.js`（云端上传）  
  - `utils/apiAuth.js`（HTTP 认证签名）  
  - `utils/errorHandler.js`（错误管道）  
  - Web 环境对象：`window.location`, `localStorage`, `performance.memory`, `fetch` 等。

---

## 3. 患者管理与用户选择子系统

### 相关模块与主要实体

- `src/components/StandbyView.vue`  
  - 三步流程：“基础信息”→“设备校验”→“开始训练”；  
  - 使用组件：
    - `PatientInfoModal.vue`：多步骤表单，用于基础信息登记；  
    - `SearchableUserSelect.vue`：支持搜索、下拉与最近记录的患者选择器。
  - 关键状态：
    - `currentStep`, `stepCompleted`：流程控制与 UI 进度条；  
    - `showPatientModal`, `showPatientSelector`, `showDeviceCheck`：弹窗控制；  
    - `deviceCheckProgress`：设备检查进度（模拟）；  
    - `currentTime`：当前时间显示。
  - 主要方法：
    - `openPatientInfo()`, `savePatientInfo()`, `startDeviceCheck()`；  
    - `handleSelectExistingPatient()`, `handleSelectNewPatient()`。
  - 与云端交互：
    - 使用 `userDataService.getPatientDetail()` / `createPatient()` / `addUserToCache()`，并维护 `localStorage.patientInfo` 与 `localStorage.current_patient_id`。

- `src/components/PatientInfoModal.vue`  
  - 三步多页表单，集中录入：
    - 基本信息：姓名、年龄、电话；  
    - 身体指标：身高、体重、BMI 自动计算 + 血压可选；  
    - 健康状况：高血压/糖尿病/吸烟史/心脏病/血脂异常等多选。
  - `submitForm()`：
    - 先本地保存 `patientInfo`，再调用 `userDataService.createPatient()` 上传云端；  
    - 根据返回结果更新 `patient_id` 与 `current_patient_id`，并通过 `emit('save', data)` 通知上层；  
    - 云端失败时回退到离线模式，生成本地 ID 并标记 `needs_sync`。

- `src/components/SearchableUserSelect.vue`  
  - 综合组件：搜索输入 + 下拉列表 + 最近选择 Quick Access + 新用户按钮；  
  - 使用：
    - `userDataService.getAllPatients()/searchPatients()/forceRefreshUserList()`；  
    - `UserSelectionHistory`（`src/services/UserSelectionHistory.js`）记录并读取最近选择的患者 ID；  
    - `localStorage.patientInfo` / `current_patient_id`，用于合并“当前本地患者”到云端列表中。

- `src/services/UserDataService.js`  
  - 类 `UserDataService`，单例 `userDataService`。  
  - 责任：
    - 使用 `cloudAPI`（下节）与远端 `/api/patients` 等接口交互；
    - 内存 `Map` + `localStorage` 双层缓存（TTL + 最小调用间隔）；
    - 数据转换：云端结构 ↔ 前端列表结构（`transformPatientData`）↔ 表单结构（`transformPatientToFormData`）；
    - 离线模式：当云端不可用时生成 `LOCAL_...` ID 并仍允许训练，结果存本地。
  - 关键方法：
    - `getAllPatients()`, `searchPatients()`, `getPatientDetail()`, `createPatient()`,  
    - `syncCurrentPatientToCloud()`, `forceRefreshUserList()`, `addUserToCache()` 等。

### 职责与依赖

- 职责：
  - 统一管理患者生命周期：登记、新建、搜索、最近记录、云端同步与离线容错；
  - 为训练会话和评估流程提供稳定的患者 ID（`current_patient_id`）。
- 被谁使用：
  - `StandbyView` / `PatientInfoModal` / `SearchableUserSelect` / `App.vue.startTraining` / `tests/user-persistence.spec.js`。
- 依赖：
  - `services/geerjiCloudAPI.js`（`cloudAPI`）  
  - `utils/apiClient.js`（带重试/断路器的 HTTP 客户端）  
  - 浏览器 `localStorage`。

---

## 4. 训练会话管理与数据持久化子系统

### 相关模块与主要实体

- `src/services/sessionManager.js`  
  - 类 `SessionManager`，单例实例 `sessionManager`。  
  - 核心字段：
    - `currentSession`：当前训练会话基本信息（`session_id`, `patient_id`, `training_mode`, `session_start`...）；  
    - `hboDataBuffer`：即将批量上传的 HbO 数据队列；  
    - `sessionStats`：统计信息（数据点总数 / 平均/最大/最小 HbO / 数据质量评分）；  
    - `uploadTimer` / `autoSaveTimer`：批量上传与自动保存的定时器；  
    - `cloudMode`：`'disabled' | 'realtime'`；  
    - `cloudEnabled`：当前会话是否允许云端上传。
  - 主要方法：
    - `startSession(trainingMode, options)`：检查未完成会话、生成 `SESSION_*` ID、写入 `current_session` 到 `localStorage`，并在实时模式下调用 `cloudAPI.createTrainingSession()`；  
    - `addHBODataPoint(hboValue, metadata)`：将单值或数组扩展为带时间戳/通道 ID 的数据点，入队，并更新 `sessionStats`；  
    - `startBatchUpload()` / `uploadBatchData()` / `stopBatchUpload()`：针对云端实时模式定期将 `hboDataBuffer` 批量 POST 到 `cloudAPI.uploadHBODataBatch()`；  
    - `endSession(finalData)`：结束当前会话，上传剩余数据，组装完整 `completeSessionData` 并调用 `cloudAPI.completeTrainingSession()`；失败时将数据缓存为 `offline_session_*`。  
    - `restoreSession()`：从 `localStorage.current_session` 恢复中断会话，包含严格的字段验证、过期判断（8 小时）、患者存在性检查以及云端会话验证，必要时切换到离线模式；  
    - `saveSessionToLocal()` / `startAutoSave()`：定期将会话与缓冲区持久化到 `session_buffer_*` 等键中。

- `src/services/geerjiCloudAPI.js`  
  - 类 `GeerjiCloudAPI`，单例 `cloudAPI`。  
  - 封装远端 `http://36.134.11.254:5002` 的主要上传接口：
    - `uploadPatientProfile()` → `POST /api/upload/data`（`data_type = 'patient_profile'`）；  
    - `createTrainingSession()` → `POST /api/upload/data`（`data_type = 'training_session'`）；  
    - `uploadHBODataBatch()` → `POST /api/upload/data`（`data_type = 'hbo_batch'`）；  
    - `uploadScreenshot()` → `POST /api/upload/data`（`data_type = 'screenshot'` + `FormData` 文件）；
    - `completeTrainingSession()` → `POST /api/upload/complete_session`；  
    - `checkConnection()` → `GET /api/health`。
  - 所有方法内部都统一走 `_request(endpoint, options)`，该方法基于 `apiClient.request()`，自动获得重试/断路器/缓存等能力，并在失败时调用 `handleApiError()` 统一归一错误信息。

### 职责与依赖

- 职责：
  - `SessionManager`：在前端维护训练会话的生命周期、数据统计与本地/云端持久化；  
  - `GeerjiCloudAPI`：作为所有云端写操作的统一网关，并提供基本的健康检查接口。
- 被谁使用：
  - `App.vue.startTraining()/stopTraining()/emergencyStop()`；  
  - `AssessmentView.handleSaveRecord()`（会在评估保存时再触发一次 `sessionManager.endSession` 以附加评估信息）；
  - 未来可能的热力图/曲线视图，用于调用 `addHBODataPoint()`（目前代码中尚未发现实调点）。
- 依赖：
  - `utils/apiClient.js`、`utils/apiAuth.js`、`utils/errorHandler.js`；  
  - 浏览器 `localStorage`。

---

## 5. 训练界面与多模式显示子系统

### 相关模块与主要实体

- `src/components/training/TrainingContainer.vue`  
  - 组件名：`TrainingContainer`，作为训练视图主骨架：  
    - 左侧：`ModeSelector`（模式切换按钮）；  
    - 中间：根据 `displayMode` 渲染 `CurveModeView` 或 `GameModeView`；  
    - 右侧：`TrainingControls`，提供开始/暂停/停止/急停/连接康助侠等控制按钮。
  - 主要 props：
    - `hboData`, `hbrData`, `currentValues`，以及 `dataHistory` / `selectedTimeRange`；  
    - `trainingDuration`, `isTraining`, `patientInfo`；  
    - `deviceStatus`, `kangzhuxiaStatus`。  
  - 方法：  
    - `switchMode(mode)`：切换 `displayMode`；  
    - `onCoinCollected(coinData)`：处理游戏金币收集事件（目前主要做日志打印）。

- `src/components/training/controls/*.vue`  
  - `DeviceStatus.vue`：展示 fNIRS / 康助侠连接状态；  
  - `ModeSelector.vue`：模式切换按钮；  
  - `TrainingControls.vue`：发出 `start-training` / `pause-training` / `stop-training` / `emergency-stop` 及设备连接相关事件给 `TrainingContainer` 和上层 `App.vue`。

- `src/components/training/modes/CurveModeView.vue`  
  - 接收 `hboData/hbrData/currentValues/dataHistory/selectedTimeRange`，在曲线模式下展示时间序列与统计。

- `src/components/training/modes/GameModeView.vue` + `modes/game/GameComponent.vue` / `GameDataDisplay.vue`  
  - 使用 `currentValues` / `hboData/hbrData` 驱动滚雪球/金币等游戏化界面，将脑活跃度映射为游戏中的速度/得分等。

- 热力图相关（目前在前端主要作为辅助组件/worker）：  
  - `src/workers/heatmapWorker.js`：Web Worker 实现 IDW 插值、高斯平滑与脑区掩膜；  
  - `src/utils/fnirsLayout.js`：Triangle 设备布局解析与 432 通道空间位置/映射生成；  
  - `src/utils/GeometryUtils.js`：大脑轮廓约束、凸包扩展、通道选择等辅助计算。

### 职责与依赖

- 职责：
  - 将来自 App 根状态的训练数据（包括实时 HbO/HbR、滚动窗口与当前数值）以多模式（曲线 / 游戏 / 热力图）呈现给用户；
  - 暴露训练控制事件（开始 / 暂停 / 停止 / 急停 / 设备连接等）给上层，驱动 `App.vue` 的训练生命周期。
- 被谁使用：
  - `App.vue` 在 `appState === 'training'` 时渲染 `TrainingContainer`；
  - 上层业务通过 props 与事件桥接训练数据和控制逻辑。
- 依赖：
  - 从 `App.vue` 注入的 props；  
  - `trainingCommon` mixin（格式化训练时长等）；  
  - 对热力图场景，还依赖 `fnirsLayout` + `GeometryUtils` + `heatmapWorker`（前者完成通道布局解析，后者在 Worker 中完成插值与掩膜）。

---

## 6. fNIRS 设备 SDK 与数据处理子系统（Python）

### 相关模块与主要实体

- `fnirs_sdk/processor.py`  
  - 类 `FNIRSProcessor`：统一的 fNIRS 数据处理器：
    - 设备发现与串口连接（VID/PID/波特率见 `data_types.DEVICE_*`）；  
    - 数据流启动/停止，包含真实设备模式与模拟模式；  
    - 将采集到的 864 通道强度数据通过 `algorithms.process_nirs_data()` 等算法转换为 432 通道 HbO/HbR，并执行网格化/去噪等处理；  
    - 暴露 `get_oxygen_data()`（返回 `BrainOxygenData`）、`get_oxygen_data_single_channel()`/`_json()` 等接口供 HTTP 服务或第三方 SDK 调用；
    - 同时集成康助侠外骨骼相关接口（连接/启动/停止 (`*_kangzhuxia_*`)，以及 `add_motion_data` / `finish_session` 用于关联运动数据与脑数据）。
- `fnirs_sdk/algorithms.py`, `fnirs_sdk/data_structures/*`, `fnirs_sdk/processing/*`  
  - 各种 NIRS 数据处理算法与数据结构：
    - 强度→光密度 (`intensity2optical_density`)；  
    - 光密度→浓度 (`od2conc` 等，见 `report_generator_cli` 中的引用)；  
    - 血氧网格插值与通道选择等；  
    - `BrainOxygenData`, `ProcessingConfig` 等核心类型。

- `fnirs_sdk/data_encryption.py`  
  - 类 `FNIRSDataEncryption`：将真实采集的 HbO/HbR 以 gzip + Fernet 加密形式打包；  
  - 类 `KanglianSDKDataProvider`：为康莲 SDK 提供预采集加密数据的解密与帧级/时序访问接口（被 `FNIRSProcessor._get_oxygen_data_from_encrypted()` 使用）。

- `fnirs_sdk/examples.py`  
  - 类 `KanglianFNIRSDemo` 与 `run_kanglian_demo()`：演示如何与康莲外骨骼设备联动训练并采集/保存脑血氧与运动数据；  
  - CLI `if __name__ == '__main__'` 支持 demo/test 模式。

- `fnirs_sdk/config/*` & `fnirs_sdk/config/device_profiles/*`  
  - 配置加载与校验（`loader.py`, `validator.py`）；  
  - 多种设备布局 profile（12-node、default_6node、triangle 等）和对应的 `hardware.toml` / `layout.json` / `recordingdata.toml`。

### 职责与依赖

- 职责：
  - 提供从设备→原始信号→处理后 HbO/HbR→（可选）云端或第三方 SDK 的完整 Python 侧处理 pipeline；
  - 提供面向康莲等合作方的封装接口与保护机制（见 `fnirs_sdk/protection.py`）。
- 被谁使用：
  - `fnirs_data_server.py`（本地 HTTP 服务）；  
  - `fnirs_sdk/examples.py`（外部集成 demo）；  
  - 构建出的 `fnirs_server` 可执行（未在源码中直接呈现，但由打包脚本产生）。
- 依赖：
  - Python 科学计算栈：`numpy`, `scipy`, `pywt` 等；  
  - 串口库 `pyserial`；  
  - `cryptography` 用于加密；  
  - ReportLab、matplotlib 等用于报表生成（见下节）。

---

## 7. 报表与离线工具子系统

### 相关模块与主要实体

- `pytools/report_generator_cli.py`  
  - 类 `NIRSReportGeneratorCLI`：
    - 加载 `.LUMO` / `.mat` / `.nirs` 等数据文件，利用 `tools.data_utils` / `tools.geerji_info` / `fnirs_sdk` 算法链生成 HbO/HbR 时间序列、热力图与多种活动/连接分析；  
    - 将生成的图像与分析结果通过 ReportLab 输出为 PDF 报告。
  - 顶部脚本说明了 CLI 用途，底部有 `if __name__ == '__main__'`（被截断处可推断）用于从命令行调用。

- `pytools/generate_channel_map.py`  
  - 解析 `fnirs_sdk/config/device_profiles/triangle/recordingdata.toml` 中的 `chans_list`，生成对应 `public/config/channel_map.json`，使前端可以将 432 通道波形按与设备记录一致的顺序进行映射。

- `analyze_864_channels.py`  
  - 加载 `public/config/triangle_layout.json`，分析 Triangle 布局下光源/检测器分布与 864 通道的几何关系，输出统计和可视化 PNG，用于验证前端/SDK 布局配置正确性。

- `fnirs_sdk/config/device_profiles/node_configs/config_validator.py` 与 `node_config_manager.py`  
  - 提供 Node 配置验证与生成工具，对比 LUMO 数据与各种 `recordingdata_*.toml` 的匹配度，并可根据不同布局策略（如“默认 6 节点”、“三角形中心”）自动生成 `chans_list` 与映射表。

### 职责与依赖

- 职责：
  - 为研发/运维人员提供离线分析、报表生成和配置验证工具，保证布局、通道与数据处理的正确性；
  - 为前端热力图与 SDK 集成提供所需的通道映射 JSON 和配置文件。
- 被谁使用：
  - 通过直接在命令行运行 `python pytools/*.py` 或 `python analyze_864_channels.py`；  
  - 不在应用运行时直接参与，但结果文件（如 `channel_map.json`、报告 PDF）会被前端或外部系统使用。
- 依赖：
  - Python 科学与报表相关依赖（`numpy`, `matplotlib`, `reportlab`, `toml`, `PyMuPDF`, `tqdm` 等）。

---

## 8. 云端通信与 API 客户端子系统

### 相关模块与主要实体

- `src/utils/apiClient.js`  
  - 类 `APIClient`，单例 `apiClient`：
    - 带指数退避重试的 `requestWithRetry()`；  
    - 断路器（failureThreshold / resetTimeout / state: CLOSED|OPEN|HALF_OPEN）；  
    - 请求队列 + 最大并发 (`maxConcurrent`)；  
    - 简单的 GET 结果缓存（`requestCache` + TTL）；  
    - 默认实例配置 `baseURL: 'http://36.134.11.254:5002'`。

- `src/utils/apiAuth.js`  
  - 生成/缓存 API 密钥与设备 ID（写入 `localStorage.fnirs_api_key` / `device_id`）；  
  - `getAuthHeaders(method, url, data)` 构造签名字符串并返回一组自定义头部，用于 Cloud API 认证。

- `src/utils/errorHandler.js`  
  - 参考前文：错误分类、日志本地化、远端上报 `/api/logs/error`、用户通知浮层；  
  - 提供 `handleApiError(error, endpoint)`、`handleDeviceError()` 等领域专用入口。

- `src/utils/screenshotCapture.js`  
  - 使用 `html2canvas` 对选定 DOM 区域进行高分辨率截图，并作为 Base64 PNG 返回；  
  - `captureAssessment()` 专门面向 `.obelab-assessment-view` 评估界面截图，被 `AssessmentView.handleSaveRecord()` 使用，用于上传评估报告快照到云端。

### 职责与依赖

- 职责：
  - 为所有 HTTP 调用（特别是云端 API）提供统一、可靠、带认证与重试的客户端；  
  - 保证错误被规范记录与上报，便于远程诊断；  
  - 提供截图能力，将评估报告/训练界面作为图像上传云端系统。
- 被谁使用：
  - `geerjiCloudAPI` / `UserDataService` / `AssessmentView` / 其他通过 `fetch` 的调用点。
- 依赖：
  - 浏览器环境（`fetch`, `document`, `localStorage`）与第三方库 `html2canvas`。

---

## 9. 测试与自动化子系统

### 相关模块与主要实体

- `tests/user-persistence.spec.js`（Playwright 测试）  
  - 描述（目前被 `describe.skip` 标记为跳过）：
    - 自动完成“添加新用户”流程，校验基础信息表单、步骤切换、弹窗关闭等 UI 行为；
    - 刷新页面后再次打开用户选择器，验证最近创建的用户仍能通过当前用户 Banner 找到（即用户信息被 `localStorage` 与缓存正确持久化）。

- `playwright.config.js` 与 `package.json` 中的 `test` / `test:ui` 脚本  
  - 负责配置与触发前端 UI 自动化测试。

### 职责与依赖

- 职责：
  - 自动回归测试患者创建与持久化流程，确保多次刷新或离线场景下用户选择与训练流程仍然稳定。
- 被谁使用：
  - 开发/测试人员在 CI 或本地执行 `npm test` / `npm run test:ui` 触发。
- 依赖：
  - Playwright 测试框架与配置；  
  - 前端页面路由（测试中通过 `/#standby` 访问 Standby 界面）。
