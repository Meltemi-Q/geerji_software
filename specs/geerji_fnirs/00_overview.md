# geerji_fnirs_new.py 整体架构概览

> 最后更新: 2025-11-28
> 文件路径: `client/geerji_fnirs_new.py`
> 代码行数: ~2200 行

---

## 1. 文件头部 - 完整导入代码

```python
import sys
import os
from threading import Thread
import time

import numpy as np
import matplotlib.pyplot as plt
from collections import deque

from PySide6.QtWidgets import (QApplication, QMainWindow, QWidget, QHBoxLayout,
                               QPushButton, QVBoxLayout, QLabel, QSpacerItem, QSizePolicy,
                               QFileDialog, QProgressDialog, QMessageBox, QStackedLayout, QMenu, QProgressBar, QGraphicsPathItem, QButtonGroup, QToolButton, QInputDialog, QGridLayout,
                               QGraphicsView, QGraphicsScene, QGraphicsTextItem, QDialog, QComboBox, QLineEdit, QSpinBox, QDoubleSpinBox, QFormLayout, QDialogButtonBox, QRadioButton)
from PySide6.QtCore import Qt, QPoint, QEvent, Property, QPropertyAnimation, Signal, QThread, QTimer, QObject, Slot, QMetaObject, QThreadPool, QRunnable, QThread, QPointF
from PySide6.QtGui import QColor, QPainter, QPixmap, QImage, QAction, QPainterPath, QBrush, QFont, QIcon

from PySide6.QtGui import QMovie

import pyqtgraph as pg
# import pyqtgraph.opengl as gl
from pyqtgraph.exporters import ImageExporter

from pyqtgraph.Qt import QtCore
import scipy.signal as sig
import matplotlib.colors as mcolors

import serial
import serial.tools.list_ports

import threading

from fnirs_app.data_handling.io_functions import ser_read, process_data
from fnirs_app.data_handling.data_types import OnlineYSB, YSB2ndot, load_nirs
from fnirs_app.ui.ui_utils import show_auto_close_message, install_chinese_translations

from scipy.io import savemat

# 从新的算法模块导入函数 - 只导入实际使用的函数
from fnirs_app.processing.algorithms.data_processing_algorithms import intensity2optical_density
from fnirs_app.processing.algorithms.signal_processing import nr_filter
from fnirs_app.processing.algorithms.motion_correction import TDDR_motion_correction
from fnirs_app.processing.algorithms.concentration_calculation import od2conc

# 注意：ChannelGridView和ParadigmTestController在主程序中未实际使用，暂时保留但添加注释
# from fnirs_app.ui.widgets import ChannelGridView  # 未在主程序中使用
# from fnirs_app.paradigms import ParadigmTestController  # 未在主程序中使用
from SignalWidget import SignalQualityWidget
from fnirs_app.core.data_model import FNIRSDataModel
from fnirs_app.core.data_processor import DataProcessor
from fnirs_app.core.YSB_receiver import YSBReceiver
from fnirs_app.ui.custom_widgets import (CustomTitleBar, ColorChangingButton,
                                        SideBar, BottomButton, UpwardsMenuButton)
from fnirs_app.utils.computation_utils import (ComputationSignals, ComputationTask,
                                              ComputationThread, create_computation_task,
                                              create_computation_thread, ComputationManager)
from fnirs_app.utils.common_utils import (resource_path, ensure_dir, get_timestamp,
                                         parse_scan_result, safe_file_operation,
                                         validate_file_path, format_file_size,
                                         get_file_info, PathManager)
from fnirs_app.processing.data_processing_methods import DataProcessingMethods
from fnirs_app.core.config_loader import get_param
import logging

# 根据配置启用/关闭 OpenGL 加速
pg.setConfigOptions(useOpenGL=bool(get_param("display.use_opengl", True)))

import gc
```

---

## 2. 日志配置 - 完整代码

```python
# 统一日志配置：同时输出到命令行和 ./logs 目录下的主日志文件
_root_logger = logging.getLogger()  # root logger
_root_logger.setLevel(logging.INFO)

# 避免重复添加 handler
if _root_logger.handlers:
    _root_logger.handlers.clear()

_log_formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(name)s - %(message)s')

# 控制台 handler
_console_handler = logging.StreamHandler()
_console_handler.setLevel(logging.INFO)
_console_handler.setFormatter(_log_formatter)
_root_logger.addHandler(_console_handler)

# 文件 handler
try:
    _logs_dir = os.path.join(os.getcwd(), "logs")
    os.makedirs(_logs_dir, exist_ok=True)
    _log_filename = f"client_main_{time.strftime('%Y%m%d_%H%M%S')}.log"
    _log_path = os.path.join(_logs_dir, _log_filename)

    _file_handler = logging.FileHandler(_log_path, encoding="utf-8")
    _file_handler.setLevel(logging.INFO)
    _file_handler.setFormatter(_log_formatter)
    _root_logger.addHandler(_file_handler)
except Exception as e:
    _root_logger.error("初始化文件日志失败: %s", e, exc_info=True)

logger = logging.getLogger(__name__)
```

**日志输出位置**:
- 控制台: 实时输出
- 文件: `./logs/client_main_{timestamp}.log`

---

## 3. MainWindow.__init__ - 完整初始化代码

```python
class MainWindow(QMainWindow):
    def __init__(self, user_info=None):
        super().__init__()

        # 保存用户信息
        self.user_info = user_info or {}

        # ==================== 1. 创建管理器 ====================
        
        # 1.1 UI初始化管理器
        from fnirs_app.ui.ui_initialization_manager import UIInitializationManager
        self.ui_initialization_manager = UIInitializationManager(self)

        # 1.2 绑图可视化管理器
        from fnirs_app.ui.plot_visualization_manager import PlotVisualizationManager
        self.plot_visualization_manager = PlotVisualizationManager(self)

        # 1.3 窗口管理器
        from fnirs_app.ui.window_manager import WindowManager
        self.window_manager = WindowManager(self)

        # 1.4 业务逻辑管理器
        from fnirs_app.core.business_logic_manager import BusinessLogicManager
        self.business_logic_manager = BusinessLogicManager(self)

        # 1.5 配置管理器
        from fnirs_app.core.configuration_manager import ConfigurationManager
        self.configuration_manager = ConfigurationManager(self)

        # ==================== 2. 初始化UI组件 ====================
        self.ui_initialization_manager.initialize_all_ui_components()

        # 更新标题栏用户信息
        if hasattr(self, 'title_bar') and self.user_info:
            self.title_bar.update_user_info(self.user_info)

        # ==================== 3. 创建更多管理器 ====================
        
        # 3.1 云服务管理器
        from fnirs_app.processing.cloud_service import CloudServiceManager
        self.cloud_service_manager = CloudServiceManager(self)

        # 3.2 数据导入管理器
        from fnirs_app.processing.data_import import DataImportManager
        self.data_import_manager = DataImportManager(self)

        # 3.3 UI事件处理管理器
        from fnirs_app.ui.ui_event_manager import UIEventManager
        self.ui_event_manager = UIEventManager(self)
        
        # 3.4 报告生成管理器
        from fnirs_app.processing.report_generation_manager import ReportGenerationManager
        self.report_generation_manager = ReportGenerationManager(self)
        
        # 连接报告生成信号
        self.report_generation_manager.report_generation_completed.connect(
            self._handle_report_completed
        )
        self.report_generation_manager.report_generation_failed.connect(
            self._handle_report_failed
        )

        # ==================== 4. 设置鼠标跟踪 ====================
        self.drag_start_position = None
        self.resize_area = None
        self.setMouseTracking(True)

        # ==================== 5. 初始化数据属性 ====================
        self.computation_thread = None
        self.is_online_mode = True
        self.is_bright_mode_active = True
        self.is_paradigm_fullscreen_active = False
        self._original_paradigm_view_parent = None

        # ==================== 6. 初始化数据变量 ====================
        self.data = None
        self.display_data = None
        self.info = None
        self.sorted_indices = None
        self.lmdata = None
        self.ddata = None
        self.lp2data = None
        self.hbo_data = None
        self.hbr_data = None
        self.hbdata = None

        # ==================== 7. 初始化其他变量 ====================
        self.save_dir = None
        self.max_data_points = 10000
        self.gc_counter = 0
        self.active_features = set()
        self.max_display_points = 10000
        
        # 节点拓扑跟踪变量
        self._last_node_list_set = None
        self._pending_node_list = None
        self._pending_change_count = 0
        self._last_info_rebuild_frame = -100000
        self._node_change_confirm_frames = 8
        self._node_rebuild_min_interval = 40

        # ==================== 8. 设置参数 ====================
        self.params = {
            'bthresh': 0.075,
            'det': 1,
            'highpass': 1,
            'lowpass1': 1,
            'ssr': 1,
            'lowpass2': 1,
            'DoGVTD': 1,
            'resample': 5,
            'omega_hp': 0.02,
            'omega_lp1': 1,
            'omega_lp2': 0.5,
            'freqout': 1,
            'rstol': 1e-5,
            'DQC_ONLY': 0,
            'omega_resample': 5
        }
        self.wavelengths = [735, 850]
        self.nwl = 2
        self.framerate = 8
        self.current_view = "original"
        self.sample_rate = 8
        self.E = np.array([[1.6348, 3.1430], [2.1190, 1.6100]])
        self.hp_rate = 0.02
        self.wavelength_mode = True

        # ==================== 9. 创建数据初始化管理器 ====================
        from fnirs_app.core import DataInitializationManager
        self.data_init_manager = DataInitializationManager(self)
        self.data_init_manager.initialize_data_components()

        # ==================== 10. 初始化范式系统 ====================
        self.business_logic_manager.setup_paradigm_test()

        # ==================== 11. 更新UI ====================
        self.plot_visualization_manager.update_button_text()
        self.title_bar.update_cloud_status(False)

        # ==================== 12. 创建数据模型 ====================
        self.data_model = FNIRSDataModel()
        self.data_processing_methods = DataProcessingMethods(self)

        # ==================== 13. 创建事件处理器 ====================
        from fnirs_app.core.main_window_event_handler import MainWindowEventHandler
        self.event_handler = MainWindowEventHandler(self)

        # ==================== 14. 创建设备控制器 ====================
        from fnirs_app.core import DeviceController
        self.device_controller = DeviceController(data_model=self.data_model, parent=self)
        self.device_controller.YSBReceiver = YSBReceiver

        # ==================== 15. 创建数据处理流水线 ====================
        from fnirs_app.core import DataProcessingPipeline
        self.processing_pipeline = DataProcessingPipeline(data_model=self.data_model, parent=self)

        # ==================== 16. 创建UI管理器 ====================
        from fnirs_app.ui import UIManager, PlotManager, InterfaceManager
        from fnirs_app.utils import DataSyncHelper, ErrorHandler

        self.ui_manager = UIManager(main_window=self, parent=self)
        self.plot_manager = PlotManager(main_window=self, parent=self)
        self.interface_manager = InterfaceManager(main_window=self, parent=self)
        self.data_sync_helper = DataSyncHelper(main_window=self, data_model=self.data_model)
        self.error_handler = ErrorHandler(parent=self)

        # ==================== 17. 连接所有信号 ====================
        from fnirs_app.core import EventConnectionManager
        self.event_connection_manager = EventConnectionManager(self)
        self.event_connection_manager.connect_all_signals()

        # ==================== 18. 设置菜单 ====================
        self.configuration_manager.setup_settings_menu()

        # ==================== 19. 更新界面 ====================
        self.interface_manager.update_mode_ui()
        self.interface_manager.update_bottom_button_visibility()

        # ==================== 20. 加载范式配置 ====================
        try:
            from fnirs_app.core.config_loader import get_param
            cfg_items = get_param('paradigm.item_list', None)
            if isinstance(cfg_items, dict) and cfg_items:
                self.item_list = cfg_items
        except Exception:
            pass
```

---

## 4. 程序入口 - 完整代码

```python
if __name__ == "__main__":
    # ==================== TTS子进程模式 ====================
    # 用于 PyInstaller 冻结环境下的 TTS 生成
    if "--tts-worker" in sys.argv:
        try:
            idx = sys.argv.index("--tts-worker")
            text = sys.argv[idx + 1]
            path = sys.argv[idx + 2]
        except Exception:
            sys.exit(1)

        try:
            import pyttsx3
            engine = pyttsx3.init()
            engine.setProperty("rate", 150)
            engine.setProperty("volume", 1.0)
            engine.save_to_file(text, path)
            engine.runAndWait()
        except Exception as e:
            print(f"[tts-worker] 生成失败: {e}")
            sys.exit(1)
        sys.exit(0)

    # ==================== 正常GUI模式 ====================
    
    # 1. 检查音频池
    try:
        ensure_audio_pool_ready()
    except Exception as e:
        logger.warning(f"音频池检查/生成时出现异常（将继续启动 GUI）: {e}")

    # 2. 创建应用并安装中文翻译
    app = QApplication(sys.argv)
    try:
        install_chinese_translations(app)
    except Exception as e:
        logger.warning("安装中文翻译失败: %s", e)

    # 3. 设置图标
    try:
        from fnirs_app.utils.common_utils import resource_path as _res_path
        app.setWindowIcon(QIcon(_res_path("gorky.png")))
    except Exception:
        pass

    # 4. 显示用户信息窗口
    from fnirs_app.ui.user_info_window import UserInfoWindow
    from fnirs_app.core.user_info_manager import get_user_manager

    user_window = UserInfoWindow()

    # 5. 等待用户确认
    if user_window.exec() == UserInfoWindow.Accepted:
        user_info = user_window.get_user_info()

        # 6. 保存用户信息
        user_manager = get_user_manager()
        success = user_manager.save_user_info(
            user_info['name'],
            user_info['gender'],
            user_info['age'],
            user_info.get('external_id')
        )

        if success:
            logger.info(f"用户登录成功: {user_manager.get_user_summary()}")

            # 7. 创建主窗口
            window = MainWindow(user_info)
            try:
                window.setWindowIcon(QIcon(_res_path("gorky.png")))
            except Exception:
                pass
            window.setGeometry(100, 100, 800, 600)
            
            # 8. 最大化显示
            window.showMaximized()
            window.raise_()
            window.activateWindow()

            sys.exit(app.exec())
        else:
            logger.error("保存用户信息失败")
            sys.exit(1)
    else:
        logger.info("用户取消登录，程序退出")
        sys.exit(0)
```

---

## 5. ensure_audio_pool_ready - 完整代码

```python
def ensure_audio_pool_ready() -> None:
    """启动前检查音频池完整性
    
    检查内容:
        1. 固定提示音频 (fixed/*.wav)
        2. 说物类别音频 (say_word/*/*.wav)
        3. 魔方任务音频 (cube/task_*.wav)
    """
    try:
        from fnirs_app.paradigms.audio_pool import (
            get_audio_pool_base_dir,
            get_fixed_wav_path,
            list_say_word_categories,
            list_cube_task_groups,
        )
        from fnirs_app.paradigms.prompt_registry import PROMPTS
        from fnirs_app.core.config_loader import get_param, get_default
    except Exception as e:
        logger.warning(f"音频池自检失败（导入错误）: {e}")
        return

    base = get_audio_pool_base_dir()
    logger.info(f"音频池根目录: {base}")

    def _check_once():
        # 1) 检查固定提示
        missing_fixed_local = []
        for pid, text in PROMPTS.items():
            if not text:
                continue
            path = get_fixed_wav_path(pid)
            if not os.path.exists(path):
                missing_fixed_local.append(pid)

        # 2) 检查说物类别
        try:
            cats = list_say_word_categories()
        except Exception as e2:
            cats = []
            logger.warning(f"扫描说物类别池失败: {e2}")

        # 检查配置中的类别
        try:
            cfg = get_param("paradigm.item_list", None)
        except Exception:
            cfg = None
        if not cfg:
            try:
                cfg = get_default("paradigm.item_list", {})
            except Exception:
                cfg = {}
        if not isinstance(cfg, dict):
            cfg = {}
        
        all_cfg_cats = set(cfg.keys())
        have_wav_cats = set(cats)
        missing_say_cats = sorted(all_cfg_cats - have_wav_cats)

        # 3) 检查魔方任务
        try:
            cube_groups_local = list_cube_task_groups()
        except Exception as e3:
            cube_groups_local = []
            logger.warning(f"扫描魔方任务池失败: {e3}")

        return missing_fixed_local, cats, cube_groups_local, missing_say_cats

    missing_fixed, categories, cube_groups, missing_say_cats = _check_once()

    # 输出检查结果
    if missing_fixed:
        logger.warning("固定提示 wav 缺失: %s",
            ", ".join(missing_fixed[:10]) + ("..." if len(missing_fixed) > 10 else ""))
    else:
        logger.info("固定提示 wav 检查通过")

    if len(categories) < 3:
        logger.warning("说物类别不足 (期望≥3): %d", len(categories))
    else:
        logger.info("说物类别池检查通过，可用类别数=%d", len(categories))

    if missing_say_cats:
        logger.warning("说物类别缺失 wav: %s",
            ", ".join(missing_say_cats[:10]) + ("..." if len(missing_say_cats) > 10 else ""))

    if not cube_groups:
        logger.warning("未找到魔方任务组")
    else:
        logger.info("魔方任务池检查通过，可用组数=%d", len(cube_groups))
```

---

## 6. 关键属性一览

### 状态属性
```python
self.is_collecting = False          # 是否正在采集
self.is_online_mode = True          # 是否在线模式
self.is_bright_mode_active = True   # 明亮模式
self.is_paradigm_fullscreen_active = False  # 范式全屏
```

### 数据属性
```python
self.data = None           # 原始数据 (channels, frames)
self.display_data = None   # 显示数据
self.info = None           # 设备信息字典
self.event_markers = []    # 事件标记列表 [(timestamp, name), ...]
self.hbo_data = None       # HbO 数据
self.hbr_data = None       # HbR 数据
self.frame_count = 0       # 当前帧计数
```

### 硬件属性
```python
self.ser = None              # serial.Serial 串口对象
self.receiver = None         # YSBReceiver 数据接收器
self.receiver_thread = None  # QThread 接收线程
```

### 采样参数
```python
self.sample_rate = 8         # 采样率 Hz
self.framerate = 8           # 帧率
self.wavelengths = [735, 850]  # 波长 nm
self.nwl = 2                 # 波长数量
```

### 路径属性
```python
self.temp_dir = None   # 临时文件目录 (~/.golgi/data/{user}/.segments/)
self.save_dir = None   # 报告保存目录 (./fnirs_reports/)
```
