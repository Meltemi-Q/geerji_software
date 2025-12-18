# 对外行为（果子）索引

下表列出当前项目中主要对外接口/行为，包括 CLI、HTTP API、本地文件产物与 UI 页面。并非每个内部工具脚本都详尽展开，但涵盖了主应用路径及关键离线工具。

## 1. 本地 HTTP API（fNIRS 数据服务）

| 类型        | 名称/标识                   | 实现位置                                        | 关键输入                         | 关键输出/副作用                                                                                         |
|------------|-----------------------------|-------------------------------------------------|----------------------------------|--------------------------------------------------------------------------------------------------------|
| HTTP API   | `GET /api/fnirs/data`       | `fnirs_data_server.py::FNIRSRequestHandler.do_GET` | 无（仅路径）                    | 返回 `hbo_data`/`hbr_data`（432 通道）、`timestamp`、`frame_id` 以及 `hbo_stats`/`hbr_stats` JSON。   |
| HTTP API   | `GET /api/fnirs/hbo`        | 同上                                            | 无                               | 返回当前帧 HbO 数组、统计量及时间戳。                                                                  |
| HTTP API   | `GET /api/fnirs/hbr`        | 同上                                            | 无                               | 返回当前帧 HbR 数组、统计量及时间戳。                                                                  |
| HTTP API   | `GET /api/fnirs/config`     | 同上（`get_dock_configuration()`）              | 无                               | 尝试从 SDK 获取 6-dock Triangle 配置（dock 列表、光源/检测器坐标等）；失败时返回错误与 fallback 提示。 |
| HTTP API   | `GET /api/fnirs/layout`     | 同上（`get_complete_layout_info()`）            | 无                               | 返回 12-dock 静态 + 6-dock 动态整合布局信息与对齐参数，用于前端联合渲染。                             |

> 这些接口通常由前端 `App.vue.fetchRealFNIRSData()` 或未来的热力图模块通过 `fetch` 调用，未走 API 签名拦截器。

---

## 2. 远端云端 HTTP API（戈尔基服务器）

> 远端基础地址在代码中多处写为 `http://36.134.11.254:5002`，在前端调用时常用相对路径 `/api/...` 并通过 `apiClient` 统一封装。

| 类型      | 名称/标识                        | 实现位置                                                | 关键输入                                                         | 关键输出/副作用                                                                                            |
|----------|----------------------------------|---------------------------------------------------------|------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------|
| HTTP API | `GET /api/patients`             | `UserDataService.getAllPatients()` → `fetchWithTimeout` | 查询参数无显式定义，按缓存策略调用                              | 返回 `result.success` + `result.data`（患者数组），被转为前端患者列表并缓存 2 小时。                     |
| HTTP API | `GET /api/patients/{patientId}` | `UserDataService.getPatientDetail()`                   | URL 路径中的 `patientId`                                       | 返回单个患者详情，被转为表单结构用于 `PatientInfoModal`。                                                 |
| HTTP API | `POST /api/patients`            | `UserDataService.createPatient()`                      | JSON：患者基本信息（姓名、年龄、诊断、既往史等）               | 创建云端患者记录，返回 `success` 与 `patient_id`；同时会清理/重建本地缓存。                              |
| HTTP API | `POST /api/upload/data`         | `GeerjiCloudAPI.uploadPatientProfile()`                | JSON：`data_type='patient_profile'` + `patient_info` 字段       | 在云端记录患者档案；成功时写入 `current_patient_id`。                                                     |
| HTTP API | `POST /api/upload/data`         | `GeerjiCloudAPI.createTrainingSession()`               | JSON：`data_type='training_session'` + `session_data`           | 创建云端会话记录，写入 `current_session_id`。                                                             |
| HTTP API | `POST /api/upload/data`         | `GeerjiCloudAPI.uploadHBODataBatch()`                  | JSON：`data_type='hbo_batch'` + `batch_data`（数据点数组）      | 批量上传 HbO 数据点，供云端后续分析使用。                                                                |
| HTTP API | `POST /api/upload/data`         | `GeerjiCloudAPI.uploadScreenshot()`                    | `FormData`：`data_type='screenshot'` + PNG 文件、会话 ID 等元数据 | 上传训练/评估截图文件，形成云端报告附件。                                                                |
| HTTP API | `POST /api/upload/complete_session` | `GeerjiCloudAPI.completeTrainingSession()`           | JSON：`session_update` + `complete_data`（完整会话统计与评估） | 标记训练会话结束并上传完整数据；成功后清理本地 `current_session_id`。                                   |
| HTTP API | `GET /api/health`               | `GeerjiCloudAPI.checkConnection()`                     | 无                                                               | 检查云端健康状况，返回 `connected` 布尔值与服务器自报信息。                                              |
| HTTP API | `POST /api/logs/error`          | `errorHandler.sendErrorToServer()`                     | JSON：错误日志（时间戳、类型、上下文、堆栈、设备/会话 ID 等）  | 记录前端错误到云端日志系统；失败时静默忽略。                                                             |
| HTTP API | `GET /api/sessions/{id}/status` | `SessionManager.validateCloudSession()`                | 会话 ID                                                          | 检查云端会话是否仍然活跃；当前实现依赖 `this.apiUrl`，在代码中似乎未初始化，疑似预留/待修正接口。        |

所有以上请求在前端层面都通过 `apiClient.request()` 统一处理：  
- 自动附加认证头（`apiAuth` 拦截器）；  
- 根据 HTTP 状态码和错误类型决定是否重试；  
- 断路器在故障时阻断后续请求一段时间。

---

## 3. UI 页面与路由 Hash 行为

| 类型    | 名称/标识                 | 实现位置                            | 关键输入（触发）                                                | 关键输出/副作用                                                                                   |
|--------|---------------------------|--------------------------------------|-----------------------------------------------------------------|--------------------------------------------------------------------------------------------------|
| UI 页面 | 待机页面 `/#standby`      | `App.vue` + `StandbyView.vue`       | 访问 URL `/#standby` 或默认进入；用户点击“基础信息”、“开始训练”等按钮 | 通过弹窗完成患者信息登记/选择，写入 `localStorage.patientInfo` 和 `current_patient_id`，最后发出 `start-training` 事件。 |
| UI 页面 | 训练页面 `/#training`     | `App.vue` + `TrainingContainer.vue` | URL hash `#training`，或 Standby 发出的 `start-training` 事件    | 切换 `appState='training'`，启动/控制 fNIRS 数据流和康助侠模拟，展示曲线/游戏视图。              |
| UI 页面 | 评估页面 `/#assessment`   | `App.vue` + `AssessmentView.vue`    | `App.stopTraining()`、`App.emergencyStop()` 或 URL hash `#assessment` | 使用训练结束的 `trainingSummary` 与当前 HbO/HbR 平均值生成曲线和简化热力图，并提供保存记录 + 返回主页操作。 |

> 前端未使用显式路由库，路由行为完全由 `window.location.hash` 与 `App.checkRoute()` 手动管理。

---

## 4. CLI 命令与离线工具

| 类型      | 名称/命令示例                                      | 实现位置                                              | 关键输入                                                | 关键输出/副作用                                                                                               |
|----------|------------------------------------------------------|-------------------------------------------------------|---------------------------------------------------------|----------------------------------------------------------------------------------------------------------------|
| CLI      | `python fnirs_data_server.py --port 8090`            | `fnirs_data_server.py`                                | `--port`（默认 8090）                                   | 启动本地 fNIRS 数据 HTTP 服务器，提供 `/api/fnirs/*` 接口。                                                   |
| CLI      | `python analyze_864_channels.py`                     | `analyze_864_channels.py`                             | `public/config/triangle_layout.json` 必须存在           | 在控制台打印 864 通道布局统计，并生成 `triangle_864_channel_analysis.png` 可视化图片。                         |
| CLI      | `python pytools/generate_channel_map.py`             | `pytools/generate_channel_map.py`                     | 读取 `fnirs_sdk/.../triangle/recordingdata.toml`        | 在 `public/config/channel_map.json` 中生成 `[index, source_index, detector_index, wavelength]` 数组。         |
| CLI      | `python pytools/report_generator_cli.py ...`         | `pytools/report_generator_cli.py`（`NIRSReportGeneratorCLI`） | 数据文件路径（`.LUMO` / `.mat` / `.nirs`）、用户信息等 | 读取 NIRS 原始数据并生成包含曲线/热力图/活动与连接分析的 PDF 报告，存储于指定路径。                            |
| CLI      | `python fnirs_sdk/data_encryption.py`                | `fnirs_sdk/data_encryption.py`                        | 无（测试模式）；也可在自定义脚本中调用 `create_kanglian_data_package` | 测试加密/解密逻辑或为康莲创建加密数据包（`.enc` + `.checksum`），封装真实 fNIRS 数据。                         |
| CLI      | `python fnirs_sdk/config/.../config_validator.py`    | `fnirs_sdk/config/device_profiles/node_configs/*`     | 使用内置 `test_lumo_data/*.npy` 及多种 `recordingdata_*.toml` | 验证不同 Node 布局配置与 LUMO 数据的匹配度，打印匹配率与差异示例。                                            |
| CLI      | `python fnirs_sdk/config/.../node_config_manager.py` | 同上                                                  | `node_layout_config.json` 中定义的布局                 | 根据不同布局模式（默认 6 节点、三角形中心等）生成对应的 `recordingdata_*.toml` 配置文件和映射分析。           |
| CLI      | `python fnirs_sdk/examples.py`                       | `fnirs_sdk/examples.py`                               | 可选参数 `"test"`                                       | 运行康莲 fNIRS 集成 Demo：连接 SDK、模拟 30 秒康复训练、保存脑血氧与运动数据报告。                            |
| CLI      | `python fnirs_sdk/protection.py`                     | `fnirs_sdk/protection.py`                             | 无                                                      | 测试许可证验证与受保护处理器创建逻辑（当前大部分保护选项禁用，用于康莲测试环境）。                            |

---

## 5. 前端构建与测试命令（Node/NPM）

| 类型      | 名称/命令               | 实现位置           | 说明与副作用                                                                 |
|----------|--------------------------|--------------------|------------------------------------------------------------------------------|
| CLI      | `npm run dev`           | `package.json`     | 启动 Vite 开发服务器（默认端口 3000），入口为 `src/main.js`。               |
| CLI      | `npm run dev:3002`      | `package.json`     | 同上，端口 3002。                                                            |
| CLI      | `npm run dev:electron`  | `package.json`     | 启动 Electron，内部会加载 `electron/main.cjs` 并启动前述桌面流程。          |
| CLI      | `npm run build`         | `package.json`     | 使用 Vite 构建前端静态资源，产物输出到 `dist/`。                            |
| CLI      | `npm run build:backend` | `package.json`     | 执行 `scripts\build_fnirs_backend.bat`，将 Python 后端打包为 `fnirs_server`。|
| CLI      | `npm run build:app`     | `package.json`     | 先 `build:backend` 再 `build` 并调用 `electron-builder -w` 打包 Windows 应用。 |
| CLI      | `npm test`              | `package.json`     | 使用 Playwright 运行测试（目前主要是 `tests/user-persistence.spec.js`）。   |
| CLI      | `npm run test:ui`       | `package.json`     | 打开 Playwright UI 测试界面。                                                |
