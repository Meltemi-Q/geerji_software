# fNIRS 5000 端口 API 完整对接说明（云端实况版）

> 目的：
> - 对照云端实际运行的 5000 端口服务（/opt/geerji/api_5000/app/api.py），补齐并纠正原有《specs/api_使用说明书_客户端对接_5000.md》中的内容；
> - 把接口行为与数据库表结构串在一起，方便客户端、Web、小程序统一对接。

## 0. 部署与代码定位

- 运行进程：gunicorn `api:app` 监听 `0.0.0.0:5000`（由 `geerji-5000.service` 托管，以便外部通过 `36.134.11.254:5000` 访问）
- 代码目录：`/opt/geerji/api_5000/app`
- 主文件：`/opt/geerji/api_5000/app/api.py`
- 本仓库中对应的完整备份文件：
  - `specs/api_5000_cloud_bundle/api_5000_from_server_20251203.py`（当前云端 `api.py` 的 1:1 快照）
  - `specs/cloud_api_5000_current_20251107_fixed.py`（便于阅读/部署的整理版，与快照在细节上略有差异）
  - 辅助迁移脚本：`specs/server_raw_data_list_download_patch_2025-11-07.py` 等

> 提示：本说明不再重复「如何部署服务端」的细节，只描述客户端对接所需的 API 与数据结构。

## 1. 基址、环境变量和统一请求头

### 1.1 基址解析逻辑

客户端侧推荐仍使用以下优先级（与原文档保持一致）：

1. 环境变量 `FNIRS_API_BASE`（例如 `https://api.meltemi.fun/api`）
2. 本地调试：`FNIRS_LOCAL_5000=1` → `http://127.0.0.1:5000/api`
3. 默认回退：`https://api.meltemi.fun/api`

相关环境变量：

- `FNIRS_API_BASE`：指定完整 API 基址（末尾无需 `/`）
- `FNIRS_LOCAL_5000`：设为 `1/true` 时使用本地 5000 端口
- `FNIRS_CLOUD_ENABLED`：设为 `1/true` 打开“云服务模式”
- `FNIRS_INSTANCE_ID`：客户端实例 ID，用于请求头标记

### 1.2 统一请求头

当前云端 `api.py` 在多处接口中会读取以下请求头（通过 `_header_info()`）：

- `X-Device-Id`：设备或主机名
- `X-Instance-Id`：客户端实例 ID
- `X-Session-Id`：会话标识（可选）
- `X-App-Type`：`pyside` / `vue` / `miniapp` 等
- `X-Mode`：`client` / `rehab` 等

> 现有客户端实现中通常禁用系统代理（`trust_env=False`，`proxies=None`），这一点与原说明书保持一致。

### 1.3 统一返回格式

大部分接口通过 `make_response()` 返回统一结构：

```jsonc
{
  "success": true,
  "message": "说明文字",
  "data": { /* 或数组，按接口定义 */ },
  "timestamp": 1730966400
}
```

**例外：** `/api/user/latest` 使用了简化格式：

```jsonc
{ "success": true, "data": [ /* 用户列表 */ ] }
```

客户端在解析时需考虑这一点（不要强依赖 `message` / `timestamp`）。

## 2. 与原《api_使用说明书_客户端对接_5000》差异概览

原说明书主要覆盖了：

- `POST /identity/resolve`
- `POST /report/save`
- `GET  /user/latest?limit=1`

与当前云端实现相比，存在以下几个重要差异或缺失：

1. **`identity/resolve` 返回字段名不同**
   - 文档示例：`data.id`
   - 实际返回：`data.user_id`

2. **`user/latest` 语义略有扩展**
   - 增加了 `assigned` 标记字段，用于避免同一条记录被多次“自动编号”消费；
   - 新增查询参数 `mark_assigned=true` 时，会把返回的这些用户标记为已分配。

3. **新增了一整组康复相关接口**
   - `rehab_sessions` / `rehab_fnirs_records` / `rehab_motion_records` 等表对应的一组 REST 接口（见第 4 章）；
   - 这些接口在原说明书中完全缺失。

4. **`/api/health` 现已提供健康检查能力**
   - 统一 API 在 `api.py` 中提供了 `/api/health` 路由，用于检查进程与数据库连通性；
   - 典型返回：`{"success": true, "data": {"status": "ok", "db": "up"}}`；
   - 仍可使用 `GET /api/rehab/stats` 作为更“业务化”的探活端点，两者可以并存。

后文已经按“当前云端真实实现”进行了完整整理，可视为修正版说明书。

## 3. 接口总览（按功能分组）

### 3.1 用户管理

#### 3.1.1 `POST /api/user/register`

- **用途**：创建或更新用户基本信息。
- **请求体 JSON：**
  - 创建：`name`(必填), `age`(必填), `gender`(必填, "男"/"女")
  - 更新：
    - 可通过 `user_id` 直接指定用户；
    - 或仅给出 `name`，按姓名查找已存在用户；
    - 可选字段：`paradigm_choice`, `collecting`(bool), `assigned`(bool) 等。
- **行为概要：**
  - 若找到既有用户 → 动态拼接 `UPDATE users SET ... WHERE id=%s`；
  - 若未找到 → 插入 `users` 并为其创建 `reports/<user_id>/` 目录；
  - 返回 `data.user_id`。

#### 3.1.2 `GET /api/user/info`

- **用途**：按 `id` 或 `name` 获取单个用户，或在无参数时返回全部用户列表。
- **查询参数：**
  - `id`：用户 ID（可选）
  - `name`：用户名（可选）
- **行为概要：**
  - 无参数时：`SELECT * FROM users ORDER BY id DESC`；
  - 会把 `created_at` 字段转换为 ISO 字符串。

#### 3.1.3 `GET /api/user/latest`

- **用途**：获取尚未被“分配”的最新用户，用于生成 `AUTO_` 自动编号。
- **查询参数：**
  - `limit`：返回数量，默认 1；
  - `mark_assigned`：默认为 `false`；为 `true` 时将返回的用户记录的 `assigned` 字段置为 `TRUE`。
- **数据库操作：**
  - 读取：`SELECT * FROM users WHERE assigned = FALSE ORDER BY id DESC LIMIT %s`；
  - 可选更新：`UPDATE users SET assigned = TRUE WHERE id = %s`。
- **返回格式：**`{"success": true, "data": [ ... ]}`（无 `message` 字段）。

> 对客户端来说：如果只想“看一下当前最新是谁”而不消耗编号，请不要带 `mark_assigned=true`。

### 3.2 报告管理

#### 3.2.1 `POST /api/report/save`

- **用途**：上传 PDF 报告并关联到指定 `user_id`。
- **表单字段（multipart/form-data）：**
  - `user_id`：目标用户 ID；
  - `report_file`：PDF 文件。
- **数据库操作：**
  - `SELECT id FROM users WHERE id=%s` 验证用户存在；
  - 把文件保存在 `reports/<user_id>/<timestamp>_<filename>`；
  - 插入到 `reports(user_id, report_path)`，返回 `report_id`。

#### 3.2.2 `GET /api/report/list`

- **用途**：获取某个用户的报告列表。
- **参数：**`user_id`（必需）。
- **查询：**
  - `SELECT r.id, r.report_path, r.created_at, u.name FROM reports r JOIN users u ON r.user_id = u.id WHERE r.user_id = %s ORDER BY r.created_at DESC`

#### 3.2.3 `GET /api/report/download/<report_id>`

- **用途**：按报告 ID 下载报告文件。
- **逻辑：**
  - 查 `reports.report_path`，拼接为 `REPORTS_DIR / report_path`；
  - 文件存在则通过 `send_file` 直接返回。

#### 3.2.4 `GET /api/report/latest`

- **用途**：获取某个用户的最新报告列表（通常用于小程序轮询）。
- **参数：**
  - `user_id`（必需）；
  - `limit`（默认 5）。
- **查询：**
  - 连接 `reports` 与 `users`，返回报告及用户基础信息。

### 3.3 身份解析与绑定

#### 3.3.1 `POST /api/identity/resolve`

- **用途**：将外部标识（二维码、小程序 openid、5002 外部患者 ID 等）解析或绑定到内部 `users.id`。
- **请求体 JSON 示例：**

```jsonc
{
  "id_type": "external_patient_id_5002",
  "id_value": "AUTO_000123",
  "create_if_missing": true,
  "name": "张三",
  "gender": "男",
  "age": 30
}
```

- **两种主要用法：**
  1. 直接绑定到已有 `user_id`：
     - 请求体中包含 `user_id`，服务端校验用户存在后，在 `identity_bindings` 中插入一条绑定；
  2. 不带 `user_id`，根据 `(id_type, id_value)` 查找或创建用户：
     - 若已存在绑定 → 直接返回对应的 `user_id`；
     - 若不存在且 `create_if_missing = true` 且提供了完整 `name/age/gender` → 创建 `users` 记录并插入 `identity_bindings`；
     - 否则返回 404。

- **返回示例（成功）：**

```jsonc
{
  "success": true,
  "message": "解析成功",
  "data": { "user_id": 54 },
  "timestamp": 1730966400
}
```

- **相关表：**`identity_bindings`（见第 4 章）。

### 3.4 康复会话与原始数据

> 这一组接口在原说明书中缺失，但在云端已投入使用，且与新增的康复表结构强绑定。

#### 3.4.1 `POST /api/rehab/session/start`

- **用途**：开始一次康复 / 采集会话，生成 `rehab_sessions` 记录。
- **请求体 JSON 关键字段：**
  - `user_id`：优先使用；
  - 或 `id_type + id_value` / `patient_id`：由服务端通过 `_ensure_identity_user` 解析为 `user_id`；
  - 可选：`manufacturer`（默认 `golgi`）、`data_version`（默认 `v2.2.0`）、`notes`。
- **头部字段参与记录：**`X-Device-Id`、`X-Instance-Id`、`X-App-Type`、`X-Mode`。
- **返回：**`{ session_id, session_uuid }`。

#### 3.4.2 `POST /api/rehab/session/finish`

- **用途**：结束会话，更新 `rehab_sessions.status` 为 `completed` 并写入 `end_time`。
- **请求体：**包含 `session_id` 或 `session_uuid` 之一。

#### 3.4.3 `POST /api/rehab/upload/data`（兼容 `/api/upload/data`）

- **用途**：上传原始数据文件（fnirs / motion 等），并归档到 `rehab_fnirs_records` 或 `rehab_motion_records`。
- **表单字段（multipart/form-data）：**
  - `data_type`：`fnirs` / `motion`（默认 `motion`）；
  - `manufacturer`：默认 `golgi`；
  - 关联方式：
    - 直接给 `session_id`；或
    - 给 `user_id`，在服务端自动创建一个新的 `rehab_sessions` 记录；
    - 或通过 `patient_info`（JSON 字符串）中携带 `patient_id`/`name`/`age`/`gender` → 解析/创建用户与会话；
  - 文件字段：优先级 `fnirs_file` → `motion_file` → `data_file` → `file`。
- **保存逻辑：**
  - 物理路径：`rehab_data/<YYYY-MM-DD>/<data_type>_<manufacturer>_timestamp_filename`；
  - 对 `fnirs`：
    - 插入 `rehab_fnirs_records(session_id, file_path, file_size_mb, duration_seconds, channels, fs, wavelengths, metadata_json)`；
  - 对其它类型：
    - 插入 `rehab_motion_records`。

#### 3.4.4 `GET /api/rehab/sessions`

- **用途**：按 `user_id` 查看该用户的所有康复会话列表。
- **参数：**`user_id`（必需）。

#### 3.4.5 `GET /api/rehab/stats`

- **用途**：查看当前系统的会话及数据条目统计（适合作为简单健康检查）。
- **返回 `data`：**`{ sessions, fnirs_records, motion_records }`。

#### 3.4.6 `POST /api/rehab/report/upload`

- **用途**：将某个 PDF 报告挂到指定的康复会话上（会话级报告）。
- **表单字段：**
  - `session_id` 或 `session_uuid`（二选一）；
  - `report_file` / `file`：PDF 报告。
- **逻辑：**
  - 先从 `rehab_sessions` 找到对应会话及其 `user_id`；
  - 调用 `_save_report_for_user` 在 `reports` 表中创建报告记录；
  - 在 `rehab_session_reports(session_id, report_id)` 中建立关联。

#### 3.4.7 `GET /api/rehab/data/list`

- **用途**：获取指定用户（可选指定会话）的 fNIRS 原始数据列表。
- **参数：**
  - `user_id`（必需）；
  - `session_id`（可选）；
  - `limit`（默认 50）、`offset`（默认 0）。
- **查询：**
  - 通过 `rehab_fnirs_records` JOIN `rehab_sessions`，按 `created_at` 倒序。

#### 3.4.8 `GET /api/rehab/data/download/<record_id>`

- **用途**：按记录 ID 下载原始数据文件。
- **路径拼接：**云端当前实现以 `BASE_DIR` + `row.file_path` 作为根路径，确保不会出现重复前缀。

## 4. 数据库表结构与关系

以下为云端实际部署中与 5000 端口 API 直接相关的增量表（不改动原有 `users` / `reports` 结构）：

### 4.1 `identity_bindings`

```sql
CREATE TABLE IF NOT EXISTS `identity_bindings` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `user_id` INT NOT NULL,
  `id_type` VARCHAR(64) NOT NULL,     -- id_card | mp_openid | qr_token | external_patient_id_5002 | other
  `id_value` VARCHAR(191) NOT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_identity` (`id_type`,`id_value`),
  KEY `idx_user` (`user_id`),
  CONSTRAINT `fk_identity_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
);
```

### 4.2 `rehab_sessions`

```sql
CREATE TABLE IF NOT EXISTS `rehab_sessions` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `user_id` INT NOT NULL,
  `session_uuid` VARCHAR(64) NOT NULL,
  `manufacturer` VARCHAR(50) DEFAULT 'golgi',
  `data_version` VARCHAR(20) DEFAULT 'v2.2.0',
  `status` VARCHAR(20) DEFAULT 'active', -- active/completed/failed
  `start_time` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `end_time` TIMESTAMP NULL DEFAULT NULL,
  `notes` VARCHAR(500) DEFAULT NULL,
  `device_id` VARCHAR(64) DEFAULT NULL,
  `instance_id` VARCHAR(64) DEFAULT NULL,
  `app_type` VARCHAR(20) DEFAULT NULL,   -- vue | pyside | miniapp
  `mode` VARCHAR(20) DEFAULT NULL,       -- rehab | client
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_session_uuid` (`session_uuid`),
  KEY `idx_user_time` (`user_id`,`start_time`),
  CONSTRAINT `fk_rehab_session_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
);
```

### 4.3 `rehab_fnirs_records`

```sql
CREATE TABLE IF NOT EXISTS `rehab_fnirs_records` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `session_id` INT NOT NULL,
  `file_path` VARCHAR(500) NOT NULL,
  `file_size_mb` DECIMAL(10,3) DEFAULT NULL,
  `duration_seconds` INT DEFAULT NULL,
  `channels` INT DEFAULT 432,
  `fs` INT DEFAULT 8,
  `wavelengths` VARCHAR(50) DEFAULT '735,850',
  `metadata_json` JSON DEFAULT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_session` (`session_id`),
  CONSTRAINT `fk_fnirs_session` FOREIGN KEY (`session_id`) REFERENCES `rehab_sessions` (`id`) ON DELETE CASCADE
);
```

### 4.4 `rehab_motion_records`

```sql
CREATE TABLE IF NOT EXISTS `rehab_motion_records` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `session_id` INT NOT NULL,
  `file_path` VARCHAR(500) NOT NULL,
  `file_size_mb` DECIMAL(10,3) DEFAULT NULL,
  `duration_seconds` INT DEFAULT NULL,
  `device_name` VARCHAR(100) DEFAULT '康莲设备',
  `metadata_json` JSON DEFAULT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_session` (`session_id`),
  CONSTRAINT `fk_motion_session` FOREIGN KEY (`session_id`) REFERENCES `rehab_sessions` (`id`) ON DELETE CASCADE
);
```

### 4.5 `rehab_session_reports`

```sql
CREATE TABLE IF NOT EXISTS `rehab_session_reports` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `session_id` INT NOT NULL,
  `report_id` INT NOT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_session_report` (`session_id`,`report_id`),
  KEY `idx_session` (`session_id`),
  KEY `idx_report` (`report_id`),
  CONSTRAINT `fk_session_reports_session` FOREIGN KEY (`session_id`) REFERENCES `rehab_sessions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_session_reports_report` FOREIGN KEY (`report_id`) REFERENCES `reports` (`id`) ON DELETE CASCADE
);
```

## 5. 客户端典型对接流程（5000 端口）

以“云端报告上传 + 康复数据同步”为例，一个完整流程可以是：

1. **解析患者身份（可选，若有外部 ID）**
   - `POST /api/identity/resolve`，带上 `id_type` + `id_value`（例如 `external_patient_id_5002`），拿到 `user_id`；
2. **更新或注册本地用户信息**
   - `POST /api/user/register`，带上 `user_id`（如有）和最新的 `name/age/gender`；
3. **创建康复会话**
   - `POST /api/rehab/session/start`，返回 `session_id`/`session_uuid`；
4. **上传原始 fNIRS/运动数据**
   - `POST /api/rehab/upload/data`，带上 `session_id`（或仅 `user_id` + `patient_info`）；
5. **结束会话**
   - `POST /api/rehab/session/finish`；
6. **上传 PDF 报告**
   - 采集结束后，客户端本地生成 PDF；
   - `POST /api/report/save`（用户级报告）或 `POST /api/rehab/report/upload`（会话级报告）。

> 若需要自动编号（`AUTO_000123` 一类），可在身份解析前使用一次 `GET /api/user/latest?limit=1` 读取当前最大编号，然后在客户端本地按约定规则生成新的外部 ID，再回传给 `/api/identity/resolve`。

## 6. 健康检查与兼容性说明

- 当前 **没有** `/api/health` 路由；任何访问都会返回 404。
- 如需在客户端做“云端是否可用”的探活：
  - 建议首选 `GET /api/rehab/stats`；
  - 或一个轻量的只读查询（例如 `GET /api/user/latest?limit=1`），并在客户端容错 404 / 5xx 情况；
- 后续如果在服务端补充 `/api/health`，建议保持返回格式：

```jsonc
{ "success": true, "message": "ok", "data": null, "timestamp": 1730966400 }
```

---

如后端 `api.py` 有新的路由或表结构变动，可在本文件对应章节中追加说明，同时更新 `specs/cloud_api_5000_current_*.py` 备份文件以保持与云端一致。
