# 范式系统

> 最后更新: 2025-11-28

## 1. 范式系统概述

范式系统用于执行标准化的认知任务测试，包括：
- 说物命名任务
- 魔方任务
- 双耳分听任务
- 自定义范式

## 2. 核心组件

### 2.1 范式控制器

```python
# 由 business_logic_manager.setup_paradigm_test() 创建
self.paradigm_controller = ParadigmTestController(...)
```

**职责**:
- 范式流程控制
- 阶段状态管理
- 音频播放控制
- UI显示管理

### 2.2 初始化

```python
def setup_paradigm_test(self):
    """初始化范式测试系统 - 委托给业务逻辑管理器"""
    return self.business_logic_manager.setup_paradigm_test()
```

## 3. 范式菜单

### 3.1 显示菜单

```python
def show_paradigm_menu(self):
    """显示范式测试菜单 - 委托给业务逻辑管理器"""
    return self.business_logic_manager.show_paradigm_menu()
```

### 3.2 菜单选项

范式菜单提供以下选项：
- 说物命名测试
- 魔方任务测试
- 双耳分听测试
- 自定义范式
- 返回

## 4. 范式配置

### 4.1 配置加载

```python
# 从配置文件读取范式参数
try:
    from fnirs_app.core.config_loader import get_param
    cfg_items = get_param('paradigm.item_list', None)
    if isinstance(cfg_items, dict) and cfg_items:
        self.item_list = cfg_items
except Exception:
    pass
```

### 4.2 配置示例

```toml
# config.toml

[paradigm]
item_list = {
    "水果" = ["苹果", "香蕉", "橙子", "葡萄"],
    "动物" = ["猫", "狗", "鸟", "鱼"],
    "颜色" = ["红色", "蓝色", "绿色", "黄色"]
}
```

## 5. 测试画布

### 5.1 初始化

```python
def setup_test_canvas(self):
    """设置测试画布"""
    self.test_scene = QGraphicsScene(self)
    self.test_view = QGraphicsView(self.test_scene)
    self.test_view.setStyleSheet("background-color: black;")
    
    # 指令文本
    self.instruction_item = QGraphicsTextItem()
    self.instruction_item.setDefaultTextColor(QColor("white"))
    self.instruction_item.setFont(QFont("Arial", 24))
    self.test_scene.addItem(self.instruction_item)
    
    # 倒计时文本
    self.countdown_item = QGraphicsTextItem()
    self.countdown_item.setDefaultTextColor(QColor("white"))
    self.countdown_item.setFont(QFont("Arial", 20))
    self.test_scene.addItem(self.countdown_item)
    
    # 添加到堆叠布局
    self.stacked_layout.addWidget(self.test_view)
```

## 6. 全屏范式模式

### 6.1 进入全屏

```python
def enter_paradigm_fullscreen(self):
    """进入范式全屏模式"""
    if self.is_paradigm_fullscreen_active:
        return
    
    paradigm_view = self.paradigm_controller.ui_mgr.view
    self._original_paradigm_view_parent = paradigm_view.parentWidget()
    
    # 隐藏其他UI元素
    self.title_bar.setVisible(False)
    self.content_widget.setVisible(False)
    
    # 添加范式视图到主布局
    self.main_layout.addWidget(paradigm_view)
    paradigm_view.setVisible(True)
    
    self.showFullScreen()
    self.is_paradigm_fullscreen_active = True
```

### 6.2 退出全屏

```python
def exit_paradigm_fullscreen(self):
    """退出范式全屏模式"""
    if not self.is_paradigm_fullscreen_active:
        return
    
    self.showNormal()
    
    paradigm_view = self.paradigm_controller.ui_mgr.view
    self.main_layout.removeWidget(paradigm_view)
    paradigm_view.setVisible(False)
    
    # 重新添加到stacked_layout
    if self.stacked_layout.indexOf(paradigm_view) == -1:
        self.stacked_layout.addWidget(paradigm_view)
    
    # 恢复UI元素
    self.content_widget.setVisible(True)
    self.title_bar.setVisible(True)
    
    self.stacked_layout.setCurrentWidget(self.plot_widget)
    
    self.is_paradigm_fullscreen_active = False
    self.showMaximized()
```

## 7. 明亮模式

### 7.1 切换明亮模式

```python
def toggle_bright_mode(self):
    """切换明亮模式"""
    self.is_bright_mode_active = not self.is_bright_mode_active
    
    if self.is_bright_mode_active:
        self.title_bar.bright_mode_button.setText("🌟")
        show_auto_close_message(self, "模式切换", "已开启全屏明亮模式")
    else:
        self.title_bar.bright_mode_button.setText("⭐")
        show_auto_close_message(self, "模式切换", "已关闭全屏明亮模式")
        
        # 退出明亮模式
        if hasattr(self, 'paradigm_controller'):
            if self.paradigm_controller.ui_mgr.is_bright_mode:
                self.paradigm_controller.ui_mgr.exit_bright_mode()
                if self.paradigm_controller.current_stage not in [None, "instruction", "test_complete"]:
                    self.paradigm_controller.show_current_state()
```

## 8. 范式完成处理

```python
def handle_paradigm_completion(self):
    """范式完成后的统一收尾逻辑"""
    
    # 1. 返回范式菜单
    self.show_paradigm_menu()
    
    # 2. 清理范式控制器状态
    if self.paradigm_controller:
        self.paradigm_controller.cleanup_experiment_state()
    
    # 3. 结束会话并保存数据（不断开设备）
    try:
        self.stop_data_collection(hardware_stop=False)
    except Exception as e:
        logger.error(f"范式结束停止采集失败: {e}")
```

## 9. 音频池系统

### 9.1 音频池检查

```python
def ensure_audio_pool_ready() -> None:
    """启动前检查音频池完整性"""
    from fnirs_app.paradigms.audio_pool import (
        get_audio_pool_base_dir,
        get_fixed_wav_path,
        list_say_word_categories,
        list_cube_task_groups,
    )
    from fnirs_app.paradigms.prompt_registry import PROMPTS
    
    base = get_audio_pool_base_dir()
    logger.info(f"音频池根目录: {base}")
    
    # 1. 检查固定提示
    missing_fixed = []
    for pid, text in PROMPTS.items():
        if not text:
            continue
        path = get_fixed_wav_path(pid)
        if not os.path.exists(path):
            missing_fixed.append(pid)
    
    # 2. 检查说物类别
    categories = list_say_word_categories()
    
    # 3. 检查魔方任务
    cube_groups = list_cube_task_groups()
    
    # 日志输出
    if missing_fixed:
        logger.warning("固定提示 wav 缺失: %s", missing_fixed[:10])
    if len(categories) < 3:
        logger.warning("说物类别不足")
    if not cube_groups:
        logger.warning("未找到魔方任务组")
```

### 9.2 音频池结构

```
audio_pool/
├── fixed/                    # 固定提示音频
│   ├── start.wav
│   ├── rest.wav
│   └── ...
├── say_word/                 # 说物任务音频
│   ├── 水果/
│   │   ├── 苹果.wav
│   │   └── ...
│   └── ...
├── cube/                     # 魔方任务音频
│   ├── task_01.wav
│   └── ...
└── dichotic/                 # 双耳分听音频
    └── ...
```

## 10. TTS子进程模式

```python
# 作为TTS子进程运行
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
```

## 11. 范式状态变量

| 变量 | 类型 | 说明 |
|-----|------|-----|
| `is_paradigm_fullscreen_active` | bool | 范式全屏状态 |
| `is_bright_mode_active` | bool | 明亮模式状态 |
| `_original_paradigm_view_parent` | QWidget | 原始父组件 |
| `paradigm_controller` | ParadigmTestController | 范式控制器 |

## 12. 双耳分听序列池

```python
# 关闭前收缩序列池
def closeEvent(self, event):
    try:
        from tools.generate_dichotic_sequences import shrink_choice_pool
        shrink_choice_pool(remove_count=2)
    except Exception as e:
        logger.warning(f"关闭前收缩双耳分听序列池失败: {e}")
```
