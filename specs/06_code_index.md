# 简洁代码索引

以下按目录/模块列出核心文件、作用及主要类/函数名，便于从名称快速定位实现。

## 1. 顶层目录

### `fnirs_data_server.py`

- 作用：本地 fNIRS 数据 HTTP 服务入口，向前端提供 `/api/fnirs/*` JSON 接口。  
- 重要类/函数：
  - `class FNIRSDataServer`（`__init__`, `start`, `update_data`, `generate_realistic_fnirs_data`, `get_dock_configuration`, `get_complete_layout_info`）  
  - `class FNIRSRequestHandler(BaseHTTPRequestHandler)`（`do_GET`, `do_OPTIONS`, `log_message`）  
  - CLI 入口：`if __name__ == "__main__":`（argparse + `FNIRSDataServer(port).start()`）

### `analyze_864_channels.py`

- 作用：分析 Triangle 布局下 864 通道 fNIRS 系统的几何分布与特征，输出图像与统计。  
- 重要函数：`load_triangle_layout`, `analyze_optode_distribution`, `calculate_channel_positions`, `visualize_channel_distribution`, `analyze_channel_shape`, `main`.

### `index.html`, `vite.config.js`, `playwright.config.js`

- 作用：前端 HTML 模板、打包配置与 UI 自动化测试配置。  
- 重要对象：Vite 插件配置、Playwright 项目配置（测试入口是 `tests/*.spec.js`）。

---

## 2. Electron 桌面壳层

### `electron/main.cjs` / `electron/main.js`

- 作用：Electron 主进程入口，管理后端进程与主窗口创建。  
- 重要函数：
  - `resolveBackendPath()` / `startBackend()` / `stopBackend()`  
  - `createWindow()`  
  - `app.whenReady().then(...)` 与 `app.on('window-all-closed' / 'before-quit' / 'quit')`

---

## 3. 前端入口与根组件

### `src/main.js`

- 作用：Vite/Vue3 应用入口，初始化认证和错误处理，创建并挂载 `App`。  
- 重要函数/调用点：`setupAuthInterceptor`, `setupGlobalErrorHandling`, `validateAuthStatus`, `createApp(App)`, `app.config.errorHandler`, `app.mount`.

### `src/App.vue`

- 作用：根组件，管理待机/训练/评估三种状态及与会话、患者、fNIRS 数据的整体协调。  
- 重要方法/变量：
  - 状态：`appState`, `patientInfo`, `deviceStatus`, `kangzhuxiaStatus`, `trainingStatus`, `currentTime`, `hboData`, `hbrData`, `currentValues`, `dataHistory`, `selectedTimeRange`, `brainActivityScore`, `assessmentText`, `trainingSummary`；  
  - 核心方法：`checkRoute`, `loadChannelMap`, `loadPatientInfo`, `startTraining`, `pauseTraining`, `stopTraining`, `emergencyStop`, `saveRecord`, `newTraining`, `returnToStandby`, `fetchRealFNIRSData`, `storeHistoryFrame`, `getHistoryData`, `updateSelectedTimeRange`, `generateRealisticFNIRSData`, `startDataSimulation`, `stopDataSimulation`, `generateAssessmentData`, 设备相关 `connectKangzhuxia` 等；  
  - 生命周期：`onMounted`, `onUnmounted`。

---

## 4. 前端组件：待机与评估

### `src/components/StandbyView.vue`

- 作用：待机页及训练前的三步准备流程（基础信息、设备校验、开始训练）。  
- 重要部分：
  - 状态：`currentStep`, `stepCompleted`, `showPatientModal`, `showPatientSelector`, `showDeviceCheck`, `deviceCheckProgress`, `currentTime`;  
  - 方法：`openPatientInfo`, `handleSelectExistingPatient`, `handleSelectNewPatient`, `savePatientInfo`, `startDeviceCheck`, `getStepClass`, `formatTime`;  
  - 子组件：`PatientInfoModal`, `SearchableUserSelect`。

### `src/components/PatientInfoModal.vue`

- 作用：三步表单，用于详细录入患者基础信息、体征和健康状况，并尝试上传云端。  
- 重要变量/方法：
  - `formData`（包含 name/age/phone/height/weight/bloodPressure/conditions）；  
  - `errors`, `uploadStatus`, `bmi`, `bmiStatusClass`, `bmiStatusText`, `bmiPosition`;  
  - `validateName`, `validateAge`, `validatePhone`, `toggleCondition`, `selectNone`, `nextStep`, `prevStep`, `submitForm`。

### `src/components/SearchableUserSelect.vue`

- 作用：支持搜索、下拉、最近选择与新建入口的患者选择弹窗。  
- 重要变量/方法：
  - `searchKeyword`, `displayPatients`, `recentPatients`, `allPatients`, `totalPatients`, `currentLocalPatient`, `isLoading`, `loadedCount`;  
  - `refreshPatientsFromCloud`, `loadPatients`, `updateDisplayPatients`, `onSearch`, `performSearch`, `toggleDropdown`, `loadMore`, `selectPatient`, `transformBasicPatientData`, `selectNewPatient`, `formatDate`;  
  - 依赖：`userDataService`, `UserSelectionHistory`。

### `src/components/AssessmentView.vue`

- 作用：训练结束后的评估页面，包括时间曲线、综合评估、简化热力图和彩色康复建议列表，并提供“重新训练”“保存记录”“返回主页”。  
- 重要变量/方法：
  - `timeCurveRef`, `brainHeatmapRef`, `uploadStatus`;  
  - 评估内容：`rehabilitationContent`, `activityLevelClass`, `activityLevelText`, `currentAdvice`, `activityLevelDescription`;  
  - 图表方法：`generateTimeSeriesData`, `createTimeCurve`, `createBrainHeatmap`, `formatValue`;  
  - 主流程：`handleSaveRecord`（截图 + 上传截图 + 完整会话结束 + 触发 `save-record`）。

---

## 5. 前端组件：训练视图与模式

### `src/components/training/TrainingContainer.vue`

- 作用：训练页面布局（左侧模式选择 + 中部曲线/游戏 + 右侧控制面板）。  
- 主要元素：
  - 状态：`displayMode`（'game' | 'curve'）；  
  - 方法：`switchMode`, `formatDuration`, `onCoinCollected`;  
  - 子组件：`ModeSelector`, `TrainingControls`, `CurveModeView`, `GameModeView`。

### `src/components/training/controls/DeviceStatus.vue`

- 作用：展示 fNIRS 与康助侠设备当前状态。  
- 主要 props：`deviceStatus`, `kangzhuxiaStatus`；  
- 主要计算属性：用于显示颜色/图标/文案。

### `src/components/training/controls/ModeSelector.vue`

- 作用：切换训练显示模式（曲线 / 游戏 / 未来的热力图等）。  
- 主要事件：`@switch-mode`。

### `src/components/training/controls/TrainingControls.vue`

- 作用：训练控制区域（开始 / 暂停 / 停止 / 急停 / 设备连接/断开）。  
- 主要事件：`start-training`, `pause-training`, `stop-training`, `emergency-stop`, `connect-kangzhuxia`, `disconnect-kangzhuxia`。

### `src/components/training/modes/CurveModeView.vue`

- 作用：展示 HbO/HbR 曲线和/或统计；  
- 主要 props：`hboData`, `hbrData`, `currentValues`, `dataHistory`, `selectedTimeRange`；  
- 内部函数：曲线渲染、Y 轴缩放等（细节见源码）。

### `src/components/training/modes/GameModeView.vue`, `modes/game/GameComponent.vue`, `GameDataDisplay.vue`

- 作用：将脑活跃度映射为游戏参数（速度、得分等），以游戏方式引导患者完成训练。  
- 主要 props：`currentValues`, `hboData`, `hbrData`；  
- 事件：`exit-game`, `coin-collected` 等。

---

## 6. 前端服务与工具

### `src/services/sessionManager.js`

- 作用：前端训练会话生命周期与数据上传管理。  
- 主要导出：`class SessionManager`, `sessionManager` 单例。  
- 关键方法：`startSession`, `addHBODataPoint`, `updateSessionStats`, `startBatchUpload`, `uploadBatchData`, `pauseSession`, `resumeSession`, `endSession`, `getSessionStatus`, `restoreSession`, `validateSessionData`, `validatePatientExists`, `validateCloudSession`, `restoreSessionBuffer`, `archiveExpiredSession`, `saveSessionToLocal`, `startAutoSave`, `stopAutoSave`。

### `src/services/UserDataService.js`

- 作用：云端用户数据服务（列表/搜索/详情/创建 + 缓存 + 离线兜底）。  
- 导出：`class UserDataService`, `userDataService` 单例。  
- 关键方法：`getAllPatients`, `searchPatients`, `getPatientDetail`, `createPatient`, `fetchWithTimeout`, `canCallAPI`, `updateLastCallTime`, `getCachedData`, `setCacheData`, `getFromLocalStorage`, `transformPatientData`, `transformPatientToFormData`, `maskPatientId`, `addUserToCache`, `forceRefreshUserList`, `shouldRefreshCache`, `clearAllCache`, `syncCurrentPatientToCloud`, `getServiceStatus`。

### `src/services/geerjiCloudAPI.js`

- 作用：戈尔基云端 API 客户端。  
- 导出：`class GeerjiCloudAPI`, `cloudAPI` 单例。  
- 核心方法见 04 文件。

### `src/services/UserSelectionHistory.js`

- 作用：记录和读取最近选择的患者 ID 列表，用于 `SearchableUserSelect` 中的最近快速选择。  
- 主要函数（根据文件命名可推断）：`recordSelection`, `getRecentUserIds` 等（详见源码）。

### `src/utils/apiClient.js`

- 作用：增强型 HTTP 客户端（重试、断路器、请求队列、缓存）。  
- 导出：`class APIClient`, `class APIError`, `apiClient` 默认实例。  
- 关键方法：`request`, `requestWithRetry`, `makeHttpRequest`, `shouldRetry`, `calculateRetryDelay`, `canMakeRequest`, `onRequestSuccess`, `onRequestFailure`, `waitForSlot`, `processQueue`, `getFromCache`, `setCache`, `cleanCache`, `get`, `post`, `put`, `delete`, `getStatus`, `destroy`。

### `src/utils/apiAuth.js`

- 作用：API 密钥与请求签名工具。  
- 导出：`getAuthHeaders`, `setupAuthInterceptor`, `validateAuthStatus`, `regenerateAuth`, 以及内部的 `generateApiKey`, `getApiKey`。  

### `src/utils/errorHandler.js`

- 作用：统一错误分类、日志与通知。  
- 导出：`ErrorTypes`, `handleError`, `handleApiError`, `handleDeviceError`, `handleDataError`, `handleValidationError`, `getErrorStatistics`, `clearErrorLogs`, `setupGlobalErrorHandling`。

### `src/utils/fnirsLayout.js`

- 作用：Triangle fNIRS 布局加载与解析、通道映射与长度匹配。  
- 主要函数：`loadTriangleLayoutData`, `parseTriangleLayoutForHeatmap`, `createTriangleFnirsInfo`, `getMockFnirsInfo`, `createChannelMapping`。

### `src/utils/GeometryUtils.js`

- 作用：大脑轮廓/约束与通道选择相关几何算法。  
- 导出类：`GeometryUtils`，包含静态方法 `isPointInBrainContour`, `calculateConstraintRadius`, `selectChannelsForTopograph`, `isPointInPolygon`, `createConvexHull`, `expandConvexHull`。

### `src/utils/screenshotCapture.js`

- 作用：通用与特定区域的截图/压缩/元数据采集工具。  
- 导出函数：`captureElement`, `captureHeatmap`, `captureAssessment`, `captureCurveMode`, `captureWhenReady`, `captureMultiple`, `compressScreenshot`, `getScreenshotMetadata`。

### `src/workers/heatmapWorker.js`

- 作用：在 Web Worker 中执行 IDW 插值、高斯平滑与前额叶掩膜运算，避免主线程卡顿。  
- 主要类/函数：`WorkerIDW`（`interpolate`, `applyGaussianSmoothing`）、`WorkerMask`（`createForeheadMask`, `applyMask`），以及消息分发函数 `handleInit`, `handleInterpolate`, `handleSmoothing`, `handleMask`, `handleFullProcessing`, `handleStatus`；Worker 全局 `onmessage` 与 `postMessage` 协议定义。

---

## 7. Python SDK 与工具

### `fnirs_sdk/processor.py`

- 作用：统一 fNIRS 设备/数据处理器，包括设备连接、数据流、血氧网格处理与康助侠运动数据集成。  
- 主要实体：
  - `class FNIRSProcessor`（`connect_device`, `disconnect_device`, `start_data_stream`, `stop_data_stream`, `get_oxygen_data`, `_get_oxygen_data_from_encrypted`, `get_oxygen_data_single_channel`, `get_oxygen_data_json`, `get_device_info`, `_data_receiver_loop`, `_simulation_data_loop`, 康助侠接口 `connect_kangzhuxia_device`, `start_kangzhuxia_collection`, `add_motion_data`, `finish_session` 等）；  
  - 便捷函数：`quick_test_connection`, `collect_test_data`。

### `fnirs_sdk/algorithms.py`, `data_structures`, `processing`

- 作用：各类 NIRS 数据处理算法与结构体；  
- 主要类/函数名称（从引用中可见）：`process_nirs_data`, `intensity2optical_density`, `select_channels`, `BrainOxygenData`, `ProcessingConfig`, `blood_oxygen_processor`, `brain_oxygen_processor`。

### `fnirs_sdk/data_encryption.py`

- 作用：fNIRS 数据加密/解密与康莲 SDK 数据提供器。  
- 主要类/函数：`FNIRSDataEncryption`, `KanglianSDKDataProvider`, `create_kanglian_data_package`。

### `fnirs_sdk/examples.py`

- 作用：康莲 fNIRS SDK 集成演示与测试。  
- 主要实体：`class KanglianFNIRSDemo`, 函数 `run_kanglian_demo`, `run_integration_test`, CLI `if __name__ == '__main__'`。

### `fnirs_sdk/protection.py`

- 作用：SDK 保护与许可证机制的示例实现。  
- 主要实体：`CodeObfuscator`, `LicenseValidator`, `SDKProtector`, `create_protected_processor`, `apply_protection_to_file`。

### `pytools/report_generator_cli.py`, `pytools/generate_channel_map.py`, `fnirs_sdk/config/device_profiles/node_configs/*`

- 作用：离线报表生成与 Node 布局配置验证/生成工具（详见 02 和 04 章节描述）。  
- 主要类/函数：`NIRSReportGeneratorCLI.generate_cli_report`, `generate_pdf_report`, `parse_chans_list`, `NodeConfigManager`, `verify_config_match` 等。

---

## 8. 测试

### `tests/user-persistence.spec.js`

- 作用：Playwright 端到端测试，验证新建用户在刷新后仍然存在于选择器与当前用户 Banner 中。  
- 主要测试函数：
  - `openUserSelector(page)`, `createNewUser(page, name, phone)`, `assertUserVisibleAfterRefresh(page, name)`；  
  - 测试用例 `test('create multiple users and verify after F5', ...)`（目前整个 `describe` 被 `skip`）。

---

以上索引可作为从任一类/函数名快速回溯到对应文件与子系统的导航起点。
