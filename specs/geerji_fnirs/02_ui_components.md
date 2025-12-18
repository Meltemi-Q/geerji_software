# UI 组件与布局 - 完整实现

> 最后更新: 2025-11-28

---

## 1. 整体布局结构

```
┌─────────────────────────────────────────────────────────┐
│                    CustomTitleBar                        │
│  [Logo] [Title] [User] [Switch] [Cloud] [Bright] [─□×] │
├─────────────────────────────────────────────────────────┤
│        │                                                │
│  Side  │              StackedLayout                     │
│  Bar   │    ┌────────────────────────────────────┐     │
│        │    │  plot_widget (pyqtgraph)           │     │
│  [添加]│    │  signal_quality_widget             │     │
│  [连接]│    │  channel_grid_view                 │     │
│  [数据]│    │  paradigm_view                     │     │
│  [范式]│    └────────────────────────────────────┘     │
│  [设置]│                                                │
│        │                                                │
├────────┴────────────────────────────────────────────────┤
│              Bottom Buttons (底部按钮栏)                 │
│  [节点扫描] [开始采集] [结束采集] [735nm] [850nm] [All] │
└─────────────────────────────────────────────────────────┘
```

---

## 2. 测试画布初始化 - 完整代码

```python
def setup_test_canvas(self):
    """设置测试画布 - 用于范式测试显示"""
    
    # 创建场景和视图
    self.test_scene = QGraphicsScene(self)
    self.test_view = QGraphicsView(self.test_scene)
    self.test_view.setStyleSheet("background-color: black;")

    # 指令文本项
    self.instruction_item = QGraphicsTextItem()
    self.instruction_item.setDefaultTextColor(QColor("white"))
    self.instruction_item.setFont(QFont("Arial", 24))
    self.test_scene.addItem(self.instruction_item)

    # 倒计时文本项
    self.countdown_item = QGraphicsTextItem()
    self.countdown_item.setDefaultTextColor(QColor("white"))
    self.countdown_item.setFont(QFont("Arial", 20))
    self.test_scene.addItem(self.countdown_item)

    # 添加到堆叠布局
    self.stacked_layout.addWidget(self.test_view)
```

---

## 3. 信号质量更新 - 完整代码

```python
def update_signal_quality(self, option=None):
    """更新信号质量显示
    
    参数:
        option: 评估方法选项 (可选)
    """
    if hasattr(self, 'data') and hasattr(self, 'info'):
        self.signal_quality_widget.update_data(self.data, self.info)
        if option is not None:
            self.signal_quality_widget.set_method(option)
```

---

## 4. 采集按钮状态更新 - 完整代码

```python
def update_collection_buttons_state(self):
    """根据当前采集状态更新底部按钮的高亮状态
    
    规则:
        - 未采集中: 高亮"开始采集"，熄灭"结束采集"
        - 采集中: 高亮"结束采集"，熄灭"开始采集"
    """
    try:
        if hasattr(self, "start_button") and hasattr(self, "stop_button"):
            collecting = bool(getattr(self, "is_collecting", False))
            if collecting:
                self.start_button.setChecked(False)
                self.stop_button.setChecked(True)
            else:
                self.start_button.setChecked(True)
                self.stop_button.setChecked(False)
    except Exception as e:
        logger.info("update_collection_buttons_state 失败: %s", e, exc_info=True)
```

---

## 5. 通道网格显示 - 完整代码

```python
def show_channel_grid(self):
    """显示通道网格视图
    
    委托给 InterfaceManager 统一处理
    """
    try:
        if hasattr(self, 'interface_manager'):
            return self.interface_manager.show_channel_grid()
    except Exception:
        pass
```

---

## 6. 通道网格更新 - 完整代码

```python
def update_channel_grid(self):
    """更新通道网格显示
    
    每3帧更新一次，降低计算负载
    """
    if self.frame_count % 3 == 0:
        # 处理数据
        conc_data = self.process_nirs_data()
        self.hbo_data = conc_data['HbO']
        self.hbr_data = conc_data['HbR']

        # 设置通道
        self.channel_grid_view.setup_channels(
            {'hbo': self.hbo_data, 'hbr': self.hbr_data}, 
            self.info
        )
        
        # 更新绑图
        try:
            self.channel_grid_view.update_plots()
        except Exception:
            pass
```

---

## 7. 明亮模式切换 - 完整代码

```python
def toggle_bright_mode(self):
    """切换全屏明亮模式
    
    明亮模式下:
        - 范式测试使用全白背景
        - 适合光线较暗的环境
    """
    self.is_bright_mode_active = not self.is_bright_mode_active
    
    if self.is_bright_mode_active:
        self.title_bar.bright_mode_button.setText("🌟")
        show_auto_close_message(self, "模式切换", "已开启全屏明亮模式", 1500)
    else:
        self.title_bar.bright_mode_button.setText("⭐")
        show_auto_close_message(self, "模式切换", "已关闭全屏明亮模式", 1500)
        
        # 如果测试正在进行，退出明亮模式
        if hasattr(self, 'paradigm_controller') and \
           self.paradigm_controller.ui_mgr.is_bright_mode:
            self.paradigm_controller.ui_mgr.exit_bright_mode()
            # 恢复当前状态显示
            if self.paradigm_controller.current_stage not in [None, "instruction", "test_complete"]:
                self.paradigm_controller.show_current_state()
```

---

## 8. 范式全屏模式 - 完整代码

### 8.1 进入全屏

```python
def enter_paradigm_fullscreen(self):
    """进入范式全屏模式
    
    流程:
        1. 保存原始父组件引用
        2. 隐藏标题栏和内容区域
        3. 将范式视图添加到主布局
        4. 切换到系统全屏
    """
    if self.is_paradigm_fullscreen_active or not hasattr(self, 'paradigm_controller'):
        return

    paradigm_view = self.paradigm_controller.ui_mgr.view

    # 保存原始父组件
    self._original_paradigm_view_parent = paradigm_view.parentWidget()
    if self._original_paradigm_view_parent:
        paradigm_view.setParent(None)

    # 隐藏其他UI元素
    self.title_bar.setVisible(False)
    self.content_widget.setVisible(False)

    # 添加范式视图到主布局
    self.main_layout.addWidget(paradigm_view)
    paradigm_view.setVisible(True)

    self.showFullScreen()
    self.is_paradigm_fullscreen_active = True
```

### 8.2 退出全屏

```python
def exit_paradigm_fullscreen(self):
    """退出范式全屏模式
    
    流程:
        1. 退出系统全屏
        2. 移除范式视图
        3. 将范式视图添加回 stacked_layout
        4. 恢复标题栏和内容区域
        5. 切换到曲线图页
        6. 恢复最大化状态
    """
    if not self.is_paradigm_fullscreen_active or not hasattr(self, 'paradigm_controller'):
        return

    paradigm_view = self.paradigm_controller.ui_mgr.view

    self.showNormal()

    # 移除范式视图
    self.main_layout.removeWidget(paradigm_view)
    paradigm_view.setVisible(False)

    # 重新添加到 stacked_layout
    try:
        if hasattr(self, 'stacked_layout'):
            try:
                if self.stacked_layout.indexOf(paradigm_view) == -1:
                    self.stacked_layout.addWidget(paradigm_view)
            except Exception:
                self.stacked_layout.addWidget(paradigm_view)
    except Exception:
        if self._original_paradigm_view_parent:
            paradigm_view.setParent(self._original_paradigm_view_parent)

    # 恢复UI元素
    self.content_widget.setVisible(True)
    self.title_bar.setVisible(True)

    # 切换回曲线图页
    try:
        if hasattr(self, 'plot_widget') and hasattr(self, 'stacked_layout'):
            self.stacked_layout.setCurrentWidget(self.plot_widget)
    except Exception:
        pass
    
    try:
        self.content_widget.raise_()
        self.content_widget.update()
        self.update()
    except Exception:
        pass

    self._original_paradigm_view_parent = None
    self.is_paradigm_fullscreen_active = False
    
    # 恢复最大化状态
    self.showMaximized()
```

---

## 9. 绘图更新 - 完整代码

```python
def update_plot(self):
    """更新绑图
    
    流程:
        1. 检查当前显示的页面
        2. 如果是信号质量页，更新信号质量
        3. 如果不是曲线页，跳过
        4. 使用绑图管理器更新
    """
    try:
        if hasattr(self, 'stacked_layout') and hasattr(self, 'plot_widget'):
            # 信号质量页
            if self.stacked_layout.currentWidget() == self.signal_quality_widget:
                if self.data.shape[-1] % 5 == 0:
                    self.signal_quality_widget.update_data(self.data[:,-100:-1], self.info)
                return
            
            # 非曲线页跳过
            if self.stacked_layout.currentWidget() is not self.plot_widget:
                return
    except Exception:
        pass
    
    self.plot_manager.update_plot()
```

---

## 10. 绘图样式更新 - 完整代码

```python
def update_plot_style(self):
    """更新绘图样式"""
    label_style = {'color': 'white', 'size': '12pt'}
    self.plot_widget.setLabel('bottom', 'Time (s)', **label_style)
    self.plot_widget.setXRange(0, 10)
```

---

## 11. 功能开关控制 - 完整代码

```python
def toggle_feature(self, feature_name):
    """控制功能的开启/关闭
    
    参数:
        feature_name: 功能名称 ("血氧网格" / "范式工具")
    
    限制:
        同时最多运行 2 个功能，保证性能
    """
    if feature_name in self.active_features:
        # 关闭功能
        if feature_name == "血氧网格":
            self.channel_grid_view.stop_updates()
        elif feature_name == "范式工具":
            self.paradigm_controller.pause()
        self.active_features.remove(feature_name)
    else:
        # 检查同时运行的功能数量
        if len(self.active_features) >= 2:
            QMessageBox.warning(self, "警告", "为保证性能，建议同时只运行1-2个功能")
            return

        # 开启功能
        if feature_name == "血氧网格":
            self.channel_grid_view.start_updates()
        elif feature_name == "范式工具":
            self.paradigm_controller.resume()
        self.active_features.add(feature_name)
```

---

## 12. 窗口事件处理 - 完整代码

### 12.1 大小调整

```python
def resizeEvent(self, event):
    """窗口大小调整事件 - 委托给UI事件管理器"""
    self.ui_event_manager.handle_resize_event(event)
```

### 12.2 鼠标事件

```python
def mousePressEvent(self, event):
    """鼠标按下 - 委托给窗口管理器"""
    return self.window_manager.handle_mouse_press_event(event)

def mouseMoveEvent(self, event):
    """鼠标移动 - 委托给窗口管理器"""
    return self.window_manager.handle_mouse_move_event(event)

def mouseReleaseEvent(self, event):
    """鼠标释放 - 委托给窗口管理器"""
    return self.window_manager.handle_mouse_release_event(event)
```

### 12.3 绘制事件

```python
def paintEvent(self, event):
    """绘制事件 - 委托给窗口管理器"""
    return self.window_manager.handle_paint_event(event)
```

### 12.4 悬停事件

```python
def event(self, event):
    """通用事件处理"""
    if event.type() == QEvent.HoverMove:
        self.window_manager.handle_hover_event(event)
    return super().event(event)
```

---

## 13. 窗口控制 - 完整代码

```python
def toggle_maximize(self):
    """切换最大化状态 - 委托给窗口管理器"""
    return self.window_manager.toggle_maximize()

def toggle_fullscreen(self):
    """切换全屏状态 - 委托给窗口管理器"""
    return self.window_manager.toggle_fullscreen()
```

---

## 14. 按钮点击处理 - 完整代码

```python
def button_clicked(self, button_text):
    """按钮点击处理 - 委托给UI事件管理器"""
    self.ui_event_manager.handle_button_click(button_text)

def onBottomButtonClicked(self):
    """底部按钮点击处理 - 委托给UI事件管理器"""
    self.ui_event_manager.handle_bottom_button_click()

def open_settings(self):
    """设置按钮点击处理 - 委托给UI事件管理器"""
    self.ui_event_manager.handle_settings_button_click()
```

---

## 15. 停止动画 - 完整代码

```python
def stop_dot_animation(self):
    """停止点动画，切换回第一页"""
    self.stacked_layout.setCurrentIndex(0)
```

---

## 16. 关闭事件 - 完整代码

```python
def closeEvent(self, event):
    """窗口关闭事件处理
    
    流程:
        1. 退出明亮模式
        2. 如果正在录制，询问是否保存
        3. 收缩双耳分听序列池
        4. 停止所有运行功能
        5. 停止用户轮询定时器
    """
    try:
        # 1. 退出明亮模式
        if self.is_bright_mode_active and hasattr(self, 'paradigm_controller'):
            self.paradigm_controller.ui_mgr.exit_bright_mode()

        # 2. 如果正在录制，询问是否保存
        if self.is_collecting:
            reply = QMessageBox.question(
                self,
                '确认关闭',
                '正在录制数据，是否保存后关闭？',
                QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No | QMessageBox.StandardButton.Cancel,
                QMessageBox.StandardButton.Cancel
            )

            if reply == QMessageBox.StandardButton.Cancel:
                event.ignore()
                return
            elif reply == QMessageBox.StandardButton.Yes:
                self.stop_data_collection()

        # 3. 收缩双耳分听序列池
        try:
            from tools.generate_dichotic_sequences import shrink_choice_pool
            shrink_choice_pool(remove_count=2)
        except Exception as e:
            logger.warning(f"关闭前收缩双耳分听序列池失败: {e}")

        # 4. 停止所有运行功能
        self.stop_real_time_mode()
        if hasattr(self, 'paradigm_controller'):
            self.paradigm_controller.cleanup()

        # 5. 停止用户轮询定时器
        if hasattr(self, 'user_poll_timer') and self.user_poll_timer.isActive():
            self.user_poll_timer.stop()
            logger.info("应用程序关闭，已停止用户轮询定时器。")

        event.accept()

    except Exception as e:
        logging.error(f"关闭窗口时发生错误: {str(e)}", exc_info=True)
        event.accept()
```

---

## 17. 停止实时模式 - 完整代码

```python
def stop_real_time_mode(self):
    """停止实时模式
    
    停止:
        - 数据接收器
        - 更新定时器
    """
    if self.receiver:
        self.receiver.stop()
    self.update_timer.stop()
```
