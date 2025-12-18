# geerji_fnirs_new.py 技术文档

> 最后更新: 2025-11-28
> 
> 本文档集详细记录了 `geerji_fnirs_new.py` 主程序文件的**所有功能的完整代码实现**。
> 
> **目的**: 便于 AI 工具（如 Droid、Claude 等）快速理解和修改代码。
> 
> **特点**: 每个文档都包含**完整的代码实现**，而不仅仅是概述。

## 文档结构

| 文档 | 内容 | 适用场景 |
|-----|------|---------|
| [00_overview.md](00_overview.md) | 整体架构、模块导入、初始化流程 | 首次了解项目 |
| [01_class_structure.md](01_class_structure.md) | MainWindow类结构、管理器模式、委托模式 | 理解代码组织 |
| [02_ui_components.md](02_ui_components.md) | UI布局、组件、事件处理 | 修改界面 |
| [03_device_management.md](03_device_management.md) | 设备连接、串口通信、YSBReceiver | 设备相关问题 |
| [04_data_collection.md](04_data_collection.md) | 采集开始/停止、分段保存、会话管理 | 采集流程问题 |
| [05_data_processing.md](05_data_processing.md) | 数据处理流水线、算法、滤波 | 数据处理问题 |
| [06_file_operations.md](06_file_operations.md) | 文件存储、MAT格式、临时文件 | 文件相关问题 |
| [07_paradigm_system.md](07_paradigm_system.md) | 范式测试、音频池、全屏模式 | 范式相关问题 |
| [08_report_generation.md](08_report_generation.md) | 报告生成、PDF输出 | 报告相关问题 |
| [09_user_management.md](09_user_management.md) | 用户信息、切换用户、云服务同步 | 用户管理问题 |
| [10_event_markers.md](10_event_markers.md) | 事件标记、时间同步 | 事件系统问题 |
| [11_signal_quality.md](11_signal_quality.md) | 信号质量评估 | 信号质量问题 |
| [12_all_methods_reference.md](12_all_methods_reference.md) | 完整方法索引 | 查找特定方法 |
| [13_core_methods_implementation.md](13_core_methods_implementation.md) | **核心方法完整实现** | 查看完整代码 |

## 快速查找

### 按功能查找

| 功能 | 相关文档 | 核心方法 |
|-----|---------|---------|
| 开始采集 | [04_data_collection](04_data_collection.md) | `start_data_collection()` |
| 结束采集 | [04_data_collection](04_data_collection.md) | `stop_data_collection()` |
| 设备连接 | [03_device_management](03_device_management.md) | `add_device()`, `connect_device()` |
| 数据处理 | [05_data_processing](05_data_processing.md) | `process_nirs_data()` |
| 保存数据 | [06_file_operations](06_file_operations.md) | `save_complete_recording()` |
| 范式测试 | [07_paradigm_system](07_paradigm_system.md) | `show_paradigm_menu()` |
| 切换用户 | [09_user_management](09_user_management.md) | `switch_user()` |
| 事件标记 | [10_event_markers](10_event_markers.md) | `add_event_marker_new()` |

### 按管理器查找

| 管理器 | 职责 | 相关文档 |
|-------|-----|---------|
| `ui_initialization_manager` | UI初始化 | [01_class_structure](01_class_structure.md) |
| `business_logic_manager` | 业务逻辑 | [03_device_management](03_device_management.md) |
| `cloud_service_manager` | 云服务 | [09_user_management](09_user_management.md) |
| `report_generation_manager` | 报告生成 | [08_report_generation](08_report_generation.md) |
| `data_model` | 数据存储 | [05_data_processing](05_data_processing.md) |

## 代码修改指南

### 修改前必读

1. **理解管理器模式**: MainWindow 将大部分逻辑委托给各个管理器
2. **理解委托模式**: 很多方法只是转发调用，实际逻辑在管理器中
3. **注意数据同步**: 修改数据后需要同步 `data_model` 和 `MainWindow` 的属性

### 常见修改场景

#### 添加新的侧边栏按钮
参考: [02_ui_components.md](02_ui_components.md) → 侧边栏部分

#### 修改数据处理流程
参考: [05_data_processing.md](05_data_processing.md)

#### 添加新的事件类型
参考: [10_event_markers.md](10_event_markers.md)

#### 修改文件保存格式
参考: [06_file_operations.md](06_file_operations.md)

## 维护指南

### 代码变更后更新文档

1. 修改了方法 → 更新 [12_all_methods_reference.md](12_all_methods_reference.md)
2. 修改了UI → 更新 [02_ui_components.md](02_ui_components.md)
3. 修改了数据流 → 更新 [04_data_collection.md](04_data_collection.md) 或 [05_data_processing.md](05_data_processing.md)
4. 添加了新管理器 → 更新 [01_class_structure.md](01_class_structure.md)

### 文档格式约定

- 使用 Markdown 格式
- 代码块标注语言 (```python)
- 表格用于属性/方法列表
- 流程图使用 ASCII Art

## 相关文件

- 主程序: `geerji_fnirs_new.py`
- 配置文件: `config.toml`
- 依赖模块: `fnirs_app/` 目录下的各模块
