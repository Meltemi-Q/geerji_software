# MainWindow 类结构与继承关系

> 最后更新: 2025-11-28

## 1. 类继承

```python
class MainWindow(QMainWindow):
    def __init__(self, user_info=None):
        super().__init__()
```

`MainWindow` 继承自 PySide6 的 `QMainWindow`，是标准的 Qt 主窗口类。

## 2. 管理器架构 (Manager Pattern)

MainWindow 采用**管理器模式**将功能模块化，每个管理器负责特定领域的逻辑。

### 2.1 管理器列表

| 管理器 | 模块路径 | 职责 |
|-------|---------|-----|
| `ui_initialization_manager` | `fnirs_app.ui.ui_initialization_manager` | UI组件初始化 |
| `plot_visualization_manager` | `fnirs_app.ui.plot_visualization_manager` | 绑图可视化 |
| `window_manager` | `fnirs_app.ui.window_manager` | 窗口状态管理 |
| `business_logic_manager` | `fnirs_app.core.business_logic_manager` | 业务逻辑 |
| `configuration_manager` | `fnirs_app.core.configuration_manager` | 配置管理 |
| `cloud_service_manager` | `fnirs_app.processing.cloud_service` | 云服务 |
| `data_import_manager` | `fnirs_app.processing.data_import` | 数据导入 |
| `ui_event_manager` | `fnirs_app.ui.ui_event_manager` | UI事件处理 |
| `report_generation_manager` | `fnirs_app.processing.report_generation_manager` | 报告生成 |
| `data_init_manager` | `fnirs_app.core.DataInitializationManager` | 数据组件初始化 |

### 2.2 管理器初始化顺序

```python
# 1. UI初始化管理器 (最先)
from fnirs_app.ui.ui_initialization_manager import UIInitializationManager
self.ui_initialization_manager = UIInitializationManager(self)

# 2. 绑图可视化管理器
from fnirs_app.ui.plot_visualization_manager import PlotVisualizationManager
self.plot_visualization_manager = PlotVisualizationManager(self)

# 3. 窗口管理器
from fnirs_app.ui.window_manager import WindowManager
self.window_manager = WindowManager(self)

# 4. 业务逻辑管理器
from fnirs_app.core.business_logic_manager import BusinessLogicManager
self.business_logic_manager = BusinessLogicManager(self)

# 5. 配置管理器
from fnirs_app.core.configuration_manager import ConfigurationManager
self.configuration_manager = ConfigurationManager(self)

# 6. 初始化所有UI组件
self.ui_initialization_manager.initialize_all_ui_components()

# 7. 云服务管理器
from fnirs_app.processing.cloud_service import CloudServiceManager
self.cloud_service_manager = CloudServiceManager(self)

# 8. 数据导入管理器
from fnirs_app.processing.data_import import DataImportManager
self.data_import_manager = DataImportManager(self)

# 9. UI事件管理器
from fnirs_app.ui.ui_event_manager import UIEventManager
self.ui_event_manager = UIEventManager(self)

# 10. 报告生成管理器
from fnirs_app.processing.report_generation_manager import ReportGenerationManager
self.report_generation_manager = ReportGenerationManager(self)

# 11. 数据初始化管理器
from fnirs_app.core import DataInitializationManager
self.data_init_manager = DataInitializationManager(self)
self.data_init_manager.initialize_data_components()
```

## 3. 控制器架构

### 3.1 设备控制器

```python
from fnirs_app.core import DeviceController
self.device_controller = DeviceController(data_model=self.data_model, parent=self)
self.device_controller.YSBReceiver = YSBReceiver  # 设置接收器类引用
```

**职责**：
- 设备连接/断开
- 串口通信管理
- 数据接收线程管理

### 3.2 范式控制器

```python
# 由 business_logic_manager.setup_paradigm_test() 创建
self.paradigm_controller = ParadigmTestController(...)
```

**职责**：
- 范式测试流程控制
- 测试阶段状态管理
- 音频播放控制

### 3.3 事件处理器

```python
from fnirs_app.core.main_window_event_handler import MainWindowEventHandler
self.event_handler = MainWindowEventHandler(self)
```

**职责**：
- 处理所有业务事件
- 信号槽的实际处理逻辑

## 4. 数据组件

### 4.1 数据模型

```python
from fnirs_app.core.data_model import FNIRSDataModel
self.data_model = FNIRSDataModel()
```

**核心属性**：
- `_data`: 原始数据数组
- `frame_count`: 帧计数
- `event_markers`: 事件标记
- `info`: 设备信息

**核心方法**：
- `update_data_with_processing()`: 更新数据并处理
- `add_event_marker_with_time()`: 添加事件标记
- `clear_all_data()`: 清除所有数据
- `get_recent_data()`: 获取最近N秒数据

### 4.2 数据处理流水线

```python
from fnirs_app.core import DataProcessingPipeline
self.processing_pipeline = DataProcessingPipeline(
    data_model=self.data_model, 
    parent=self
)
```

### 4.3 数据处理方法集

```python
from fnirs_app.processing.data_processing_methods import DataProcessingMethods
self.data_processing_methods = DataProcessingMethods(self)
```

## 5. UI管理组件

### 5.1 UI管理器

```python
from fnirs_app.ui import UIManager, PlotManager, InterfaceManager

self.ui_manager = UIManager(main_window=self, parent=self)
self.plot_manager = PlotManager(main_window=self, parent=self)
self.interface_manager = InterfaceManager(main_window=self, parent=self)
```

### 5.2 工具类

```python
from fnirs_app.utils import DataSyncHelper, ErrorHandler

self.data_sync_helper = DataSyncHelper(main_window=self, data_model=self.data_model)
self.error_handler = ErrorHandler(parent=self)
```

## 6. 信号连接管理

```python
from fnirs_app.core import EventConnectionManager
self.event_connection_manager = EventConnectionManager(self)
self.event_connection_manager.connect_all_signals()
```

**连接的信号包括**：
- 报告生成完成/失败信号
- 数据导入信号
- 云服务状态变化信号
- 设备连接状态信号
- 数据更新信号

## 7. 属性代理 (Property Delegation)

MainWindow 通过属性装饰器代理部分管理器的状态：

```python
@property
def is_cloud_service_mode(self):
    """云服务模式状态属性"""
    return self.cloud_service_manager.get_status()

@property
def current_server_user(self):
    """当前服务器用户属性"""
    return self.cloud_service_manager.get_current_user()

@property
def api_base_url(self):
    """API基础URL属性"""
    return self.cloud_service_manager.get_api_base_url()
```

## 8. 方法委托模式

MainWindow 大量使用**方法委托**，将具体实现交给管理器：

```python
# 设备管理 - 委托给 business_logic_manager
def add_device(self):
    return self.business_logic_manager.add_device()

def disconnect_device(self):
    return self.business_logic_manager.disconnect_device()

def connect_device(self):
    return self.business_logic_manager.connect_device()

# 范式系统 - 委托给 business_logic_manager
def setup_paradigm_test(self):
    return self.business_logic_manager.setup_paradigm_test()

def show_paradigm_menu(self):
    return self.business_logic_manager.show_paradigm_menu()

# 配置管理 - 委托给 configuration_manager
def setup_settings_menu(self):
    return self.configuration_manager.setup_settings_menu()

def show_settings_menu(self):
    return self.configuration_manager.show_settings_menu()

# 窗口管理 - 委托给 window_manager
def toggle_maximize(self):
    return self.window_manager.toggle_maximize()

def toggle_fullscreen(self):
    return self.window_manager.toggle_fullscreen()

# 事件处理 - 委托给 event_handler
def on_data_updated(self):
    return self.event_handler.on_data_updated()

def on_device_connected(self):
    return self.event_handler.on_device_connected()
```

## 9. 事件处理委托方法完整列表

| 方法 | 委托目标 | 说明 |
|-----|---------|-----|
| `on_data_updated` | `event_handler` | 数据更新 |
| `on_device_connected` | `event_handler` | 设备连接 |
| `on_device_disconnected` | `event_handler` | 设备断开 |
| `on_data_collection_started` | `event_handler` | 采集开始 |
| `on_data_collection_stopped` | `event_handler` | 采集停止 |
| `on_connection_error` | `event_handler` | 连接错误 |
| `on_ui_state_changed` | `event_handler` | UI状态变化 |
| `on_mode_changed` | `event_handler` | 模式变化 |
| `on_error_occurred_new` | `event_handler` | 错误发生 |
| `on_critical_error` | `event_handler` | 严重错误 |
| `on_plot_updated` | `event_handler` | 绑图更新 |
| `on_plot_error` | `event_handler` | 绑图错误 |
| `on_interface_mode_changed` | `event_handler` | 界面模式变化 |
| `on_interface_updated` | `event_handler` | 界面更新 |
| `on_app_config_changed` | `event_handler` | 应用配置变化 |
| `on_processing_params_changed` | `event_handler` | 处理参数变化 |
| `on_device_config_changed` | `event_handler` | 设备配置变化 |
| `on_processed_data_updated` | `event_handler` | 处理数据更新 |
| `on_signal_quality_clicked` | `event_handler` | 信号质量点击 |
| `on_quality_option_selected` | `event_handler` | 质量选项选择 |

## 10. 类关系图

```
                    ┌─────────────────┐
                    │   QMainWindow   │
                    └────────┬────────┘
                             │
                    ┌────────┴────────┐
                    │   MainWindow    │
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
   ┌────┴────┐         ┌─────┴─────┐        ┌────┴────┐
   │Managers │         │Controllers│        │  Data   │
   └────┬────┘         └─────┬─────┘        │Components│
        │                    │              └────┬────┘
   ┌────┴────────────┐  ┌────┴────┐        ┌────┴────┐
   │UIInitManager    │  │Device   │        │DataModel│
   │PlotVisManager   │  │Controller│       │Pipeline │
   │WindowManager    │  │Paradigm │        │Methods  │
   │BusinessManager  │  │Controller│       └─────────┘
   │ConfigManager    │  │Event    │
   │CloudManager     │  │Handler  │
   │DataImportManager│  └─────────┘
   │UIEventManager   │
   │ReportManager    │
   └─────────────────┘
```
