# 重要状态与数据结构

本节聚焦在项目中被频繁读写、且明显影响行为的核心状态（只列举主要者）。

## 1. 前端根状态（`App.vue`）

### 1.1 应用与路由状态

- **`appState: 'standby' | 'training' | 'assessment'`**  
  - 定义：`setup()` 内 `ref('standby')`；  
  - 更新：
    - 初始 `checkRoute()` 根据 `window.location.hash` 调整；  
    - `startTraining()` → `'training'`；  
    - `stopTraining()` → `'assessment'`；  
    - `emergencyStop()`、`newTraining()`、`returnToStandby()` → `'standby'`。  
  - 读取：
    - 模板中使用 `v-if` 决定渲染 `TrainingContainer` / `AssessmentView` / `StandbyView`。

### 1.2 患者与设备状态

- **`patientInfo`**  
  - 结构：`{ name, age, room }`（组件内默认值），在 Standby/PatientInfoModal 中被扩展为含身高/体重/病史等的结构；  
  - 定义：`ref({ name: '张三', age: 87, room: '201-3' })`；  
  - 更新：
    - `loadPatientInfo()` 从 `localStorage.patientInfo` 恢复；  
    - Standby 流程中 `savePatientInfo()` 写入后会间接更新该值（`App.loadPatientInfo()` 再次读取）；  
  - 读取：
    - 传入 `TrainingContainer` 作为 props，用于训练界面右上角展示；  
    - `saveRecord()` 中作为训练记录的一部分生成本地离线记录。

- **`deviceStatus` / `kangzhuxiaStatus`**  
  - `deviceStatus`：大致 `{ fnirs: 'connected'|'disconnected'|'error', kangzhuxia: 'connected'|'running'|'stopped'|'error' }`；  
  - `kangzhuxiaStatus`：`{ connected, card_status, motion_status, emergency_status }`；  
  - 更新：
    - `connectKangzhuxia()/disconnectKangzhuxia()/startKangzhuxiaCollection()/stopKangzhuxiaCollection()` 根据模拟逻辑改变；  
    - 未直接与 Python SDK 的康助侠接口对接（`fnirs_sdk.processor` 中有相关函数，当前前端为纯模拟）。  
  - 读取：
    - 经 `TrainingContainer` 传入 `TrainingControls` / `DeviceStatus` 控件显示设备连接与运动情况。

### 1.3 训练状态与时间

- **`trainingStatus`**  
  - 结构：`{ isTraining: boolean, duration: number, speed: 'low'|'high', sessionId: string|null }`；  
  - 更新：
    - `startTraining()` 初始化为启动状态（`isTraining=true`，`duration=0`，`sessionId` 来自 `sessionManager.startSession`）；  
    - `startDataSimulation()` 中的定时器按真实时间更新 `duration`；  
    - `pauseTraining()` → `isTraining=false`；  
    - `stopTraining()` / `emergencyStop()` / `newTraining()` / `returnToStandby()` 重置状态。  
  - 读取：
    - 传给 `TrainingContainer`，用于顶部计时显示和控制按钮状态；  
    - `generateAssessmentData()` 使用最终 `duration` 更新 `trainingSummary`。

- **`currentTime`**  
  - 由 `setInterval` 每秒更新一次，供 Standby/Training 界面显示当前系统时间。

### 1.4 fNIRS 数据与历史缓冲

- **`hboData` / `hbrData`（数组长度 432）**  
  - 定义：`ref(new Array(432).fill(0.025))` / `ref(new Array(432).fill(-0.015))`；  
  - 更新：
    - `startDataSimulation()` 的定时器内：  
      - `const fnirData = await fetchRealFNIRSData()`；  
      - `hboData.value = fnirData.hboData`；  
      - `hbrData.value = fnirData.hbrData`。  
  - 读取：
    - 作为 props 注入 `TrainingContainer`，进一步传入 `CurveModeView` 或 `GameModeView` 进行可视化。

- **`dataHistory`（滚动帧队列）**  
  - 每帧结构：  
    ```js
    {
      hbo: number[], hbr: number[],
      timestamp: number,
      frameId: number,
      recordTime: number,
      hboMean: number, hbrMean: number,
      hboStats?: object, hbrStats?: object
    }
    ```  
  - 更新：
    - `storeHistoryFrame()` 每帧调用，将深拷贝的数据推入数组；
    - 超过 `MAX_HISTORY_SIZE`（1500）时会从头部批量 `splice` 清理，并调整 `selectedTimeRange` 以防越界；  
  - 读取：
    - `getHistoryData(startIdx, endIdx)` 用于按帧索引切片，供曲线视图（`CurveModeView`）展示指定时间窗；  
    - 可用于后续导出/上传扩展（目前主要用于 UI 展示）。

- **`currentValues`（当前平均值与趋势）**  
  - 结构：
    ```js
    {
      hbo: number,
      hbr: number,
      hboTrend: 'up'|'down'|'stable',
      hbrTrend: 'up'|'down'|'stable'
    }
    ```  
  - 更新：
    - 在 `startDataSimulation()` 定时器中：根据最新 `fnirData.hboStats/hbrStats` 或数组平均值更新；  
    - 与上一帧比较，若变化超过阈值（±0.001），更新趋势字段。  
  - 读取：
    - 传入训练界面和游戏界面，用以驱动实时显示/动画（如游戏中金币生成节奏、曲线跳动等）。

---

## 2. 会话与缓存状态（`SessionManager` 与 `UserDataService`）

### 2.1 会话状态（`SessionManager`）

- **`currentSession`**  
  - 定义：在 `startSession()` 中创建并写入 `localStorage.current_session`；字段包含 `session_id`, `patient_id`, `training_mode`, `session_start`, `status`, 以及可选业务参数；  
  - 更新：
    - `pauseSession()` / `resumeSession()` 修改 `status`；  
    - `endSession()` 设置 `session_end`, `duration`, 以及附加 `session_stats`、`final_*` 字段并上传云端；  
    - `restoreSession()` 会在成功恢复时在内存中加入 `restored_at` 与 `is_restored` 标记，并重启自动保存。  
  - 读取：
    - `getSessionStatus()` 返回给前端 UI 和业务代码；  
    - `AssessmentView.handleSaveRecord()` 构造 `sessionData` 时引用 `sessionManager.currentSession?.session_id`。

- **`hboDataBuffer`**  
  - 用途：准备批量上传的 HbO 数据点队列，每个元素包含 `timestamp_ms`, `hbo_value`, `channel_id`, `data_quality`, `session_id` 等；  
  - 更新：
    - 通过 `addHBODataPoint()` 追加；  
    - `uploadBatchData()` 从头部 `splice` 一批上传，上传失败则再 `unshift` 回缓冲区。  
  - 读取：
    - `uploadBatchData()` 与 `getSessionStatus()` 提供当前缓冲队列长度与整体上传进度概况。

- **`sessionStats`**  
  - 字段：`totalDataPoints`, `avgHBO`, `maxHBO`, `minHBO`, `qualityScore`；  
  - 更新：
    - 每次 `addHBODataPoint()` 调用 `updateSessionStats()` 增量更新平均值/极值和质量得分；  
  - 读取：
    - `endSession()` 组装完整会话数据时写入 `session_stats` 与 `final_hbo_*` 等字段，最终上传云端或本地缓存。

- **持久化字段（localStorage）**  
  - `current_session`：序列化当前会话对象；  
  - `session_buffer_{session_id}`：会话缓冲区与统计信息备份；  
  - `archived_sessions`：最多保存最近 10 条归档会话；  
  - `current_session_id`：当前云端会话 ID，用于匹配上传接口；  
  - `offline_session_*`：云端上传失败时的完整会话离线备份。

### 2.2 患者缓存状态（`UserDataService`）

- **内存缓存 `cache: Map` 与 `lastCallTime: Map`**  
  - `cache` 存储 `key → { data, timestamp, ttl }`：  
    - `all_patients`：完整患者列表；  
    - `patient_{id}`：单个患者详情；  
    - 其他搜索/配置项等。  
  - `lastCallTime` 用于记录每个 API 名称的最近一次调用时间，配合 `minInterval`（2 分钟）限制调用频率。

- **本地存储缓存（`localStorage`）**  
  - `cache_all_patients`：all_patients 对应的离线副本；  
  - `patientInfo` 与 `current_patient_id`：当前前端侧选定患者信息与 ID；  
  - `user_data_cache`：其他用户列表缓存（用于会话恢复时验证患者存在性）。

### 2.3 API 认证与错误日志状态

- **`fnirs_api_key` 与 `device_id`（localStorage）**  
  - 由 `apiAuth.generateApiKey()` 和 `generateDeviceId()` 生成；  
  - 被 `getAuthHeaders()` 和拦截器在每次云端 `/api/` 调用时读出并放入请求头；  
  - `regenerateAuth()` 提供刷新能力。

- **错误日志 `error_logs`（localStorage）**  
  - `errorHandler.logError()` 维护的错误数组（最多 50 条），记录各类前端错误的完整信息；  
  - `getErrorStatistics()` 对这些日志进行简单聚合，用于构建错误概览面板；  
  - 用于后续上传与诊断。

---

## 3. fNIRS 后端状态（`FNIRSDataServer` 与 `FNIRSProcessor`）

### 3.1 `FNIRSDataServer` 状态

- **`current_data`**  
  - 结构示例：
    ```json
    {
      "hbo_data": [...432 floats...],
      "hbr_data": [...432 floats...],
      "timestamp": 1730000000.123,
      "frame_id": 1234,
      "hbo_stats": { "mean": ..., "std": ..., "min": ..., "max": ... },
      "hbr_stats": { ... }
    }
    ```  
  - 更新：`update_data()` 每 1/8 秒覆盖一次；  
  - 读取：`FNIRSRequestHandler.do_GET()` 在所有 `/api/fnirs/*` 请求中使用。

- **`processor: FNIRSProcessor | None` 与 `is_running`, `data_thread`**  
  - 管理数据流线程与设备连接生命周期；  
  - 若 `processor` 为 `None`，则 `update_data()` 总是使用本地模拟函数生成数据。

### 3.2 `FNIRSProcessor` 内部关键状态

- `_data_buffer: np.ndarray`  
  - 缓存最近 N 帧原始强度数据（864 通道×帧数），在 `get_oxygen_data()` 中被转换为 432 通道 HbO/HbR；  
  - 更新：串口接收线程 `_data_receiver_loop()` 或模拟循环 `_simulation_data_loop()` 填充。

- `_processed_data_cache: BrainOxygenData | None`  
  - 存储上一次调用 `get_oxygen_data()` 的结果，避免重复耗时处理；  
  - 更新：在检测到新帧时（`current_frame` 变化）重新调用 `process_nirs_data()` 并更新缓存。

- `_encrypted_provider: KanglianSDKDataProvider` 及相关索引  
  - 当设备未连接或无数据时，`_get_oxygen_data_from_encrypted()` 通过此对象从预加密数据中读取连续帧，作为 fallback。

- 康助侠相关：  
  - `_kangzhuxia_connection`, `_kangzhuxia_status`, `_kangzhuxia_data_thread` 等管理串口连接与模拟数据线程；  
  - `_motion_data_buffer` / `_session_data` 用于缓存外骨骼运动数据，与脑血氧数据关联后可在 `finish_session()` 中打包保存。
