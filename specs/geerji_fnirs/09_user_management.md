# 用户管理 - 完整实现

> 最后更新: 2025-11-28

---

## 1. 用户信息结构

```python
user_info = {
    'id': int,           # 用户ID（数据库生成）
    'name': str,         # 姓名
    'gender': str,       # 性别 ('男'/'女')
    'age': int,          # 年龄
    'external_id': str   # 外部ID（可选）
}
```

---

## 2. 切换用户 - 完整代码

```python
def switch_user(self):
    """切换当前登录用户
    
    流程:
        1. 检查是否有正在进行的采集或范式
        2. 如有，询问用户是否结束并保存
        3. 清除当前用户信息
        4. 清空云端绑定用户
        5. 弹出用户信息窗口
        6. 保存新用户信息
        7. 更新标题栏显示
        8. 云服务模式下同步新用户
    """
    from PySide6.QtWidgets import QMessageBox

    # ==================== 1. 检查采集/范式状态 ====================
    is_collecting = bool(getattr(self, "is_collecting", False))
    paradigm_active = False
    try:
        if hasattr(self, "paradigm_controller") and self.paradigm_controller:
            stage = getattr(self.paradigm_controller, "current_stage", None)
            if stage not in (None, "instruction", "test_complete"):
                paradigm_active = True
    except Exception as e:
        logger.info("switch_user: 检查范式状态失败: %s", e, exc_info=True)

    # ==================== 2. 询问是否结束 ====================
    if is_collecting or paradigm_active:
        msg = (
            "当前正在采集或进行范式，切换用户前需要结束当前会话并保存数据。\n"
            "是否立即结束并保存？"
        )
        reply = QMessageBox.question(
            self,
            "切换用户",
            msg,
            QMessageBox.Yes | QMessageBox.No,
            QMessageBox.No,
        )
        if reply != QMessageBox.Yes:
            return

        # 尝试结束范式
        if paradigm_active and hasattr(self, "paradigm_controller"):
            try:
                if hasattr(self, "add_event_marker_new"):
                    self.add_event_marker_new("force_end")
            except Exception as e:
                logger.info("switch_user: 添加 force_end 标记失败: %s", e, exc_info=True)
            try:
                self.paradigm_controller.cleanup_experiment_state()
            except Exception as e:
                logger.info("switch_user: 清理范式状态失败: %s", e, exc_info=True)

        # 尝试结束采集（不停止硬件）
        if is_collecting:
            try:
                self.stop_data_collection(hardware_stop=False)
            except Exception as e:
                logger.info("switch_user: 停止采集失败: %s", e, exc_info=True)

    # ==================== 3. 清除当前用户信息 ====================
    try:
        from fnirs_app.core.user_info_manager import get_user_manager
        user_manager = get_user_manager()
        user_manager.clear_current_user()
    except Exception as e:
        logger.info("switch_user: 清除本地用户信息失败: %s", e, exc_info=True)

    self.user_info = {}
    try:
        if hasattr(self, "title_bar"):
            self.title_bar.update_user_info(self.user_info)
    except Exception as e:
        logger.info("switch_user: 更新标题栏用户信息失败: %s", e, exc_info=True)

    # ==================== 4. 清空云端用户 ====================
    try:
        if hasattr(self, "cloud_service_manager") and self.cloud_service_manager:
            self.cloud_service_manager.current_server_user = None
    except Exception as e:
        logger.info("switch_user: 清空 cloud current_server_user 失败: %s", e, exc_info=True)

    # ==================== 5. 弹出用户信息窗口 ====================
    try:
        from fnirs_app.ui.user_info_window import UserInfoWindow
        dlg = UserInfoWindow(parent=self)
        if dlg.exec() != UserInfoWindow.Accepted:
            logger.info("switch_user: 用户取消重新登录")
            return
        new_user_info = dlg.get_user_info() or {}
    except Exception as e:
        logger.error("switch_user: 打开用户信息窗口失败: %s", e, exc_info=True)
        return

    # ==================== 6. 保存新用户信息 ====================
    try:
        from fnirs_app.core.user_info_manager import get_user_manager
        user_manager = get_user_manager()
        ok = user_manager.save_user_info(
            new_user_info.get("name", ""),
            new_user_info.get("gender", ""),
            int(new_user_info.get("age", 0) or 0),
            new_user_info.get("external_id"),
        )
        if not ok:
            QMessageBox.warning(self, "切换用户失败", "保存新用户信息失败，请重试。")
            return

        # 获取完整信息（包含ID）
        full_info = user_manager.get_current_user() or new_user_info
        self.user_info = {
            "id": full_info.get("id"),
            "name": full_info.get("name"),
            "gender": full_info.get("gender"),
            "age": full_info.get("age"),
            "external_id": full_info.get("external_id"),
        }
        
        # 更新标题栏
        if hasattr(self, "title_bar"):
            self.title_bar.update_user_info(self.user_info)
    except Exception as e:
        logger.error("switch_user: 保存/更新新用户信息失败: %s", e, exc_info=True)
        return

    # ==================== 7. 云服务同步 ====================
    try:
        if self.is_cloud_service_mode:
            self.cloud_service_manager.current_server_user = None
            self.cloud_service_manager.sync_local_user_to_server(self.user_info)
    except Exception as e:
        logger.info("switch_user: 同步新用户到云端失败: %s", e, exc_info=True)
```

---

## 3. 云服务属性 - 完整代码

```python
@property
def is_cloud_service_mode(self):
    """云服务模式状态属性
    
    返回: bool - 是否开启云服务模式
    """
    return self.cloud_service_manager.get_status()

@property
def current_server_user(self):
    """当前服务器用户属性
    
    返回: dict 或 None - 当前云端用户信息
    """
    return self.cloud_service_manager.get_current_user()

@property
def api_base_url(self):
    """API基础URL属性
    
    返回: str - API服务器地址
    """
    return self.cloud_service_manager.get_api_base_url()
```

---

## 4. 云服务切换 - 完整代码

```python
def toggle_cloud_service(self):
    """切换云服务模式的开启/关闭状态
    
    使用云服务管理器处理切换逻辑
    """
    self.cloud_service_manager.toggle_cloud_service()
```

---

## 5. 程序启动时的用户处理

```python
if __name__ == "__main__":
    # ... 前置检查 ...

    app = QApplication(sys.argv)
    
    # 显示用户信息窗口
    from fnirs_app.ui.user_info_window import UserInfoWindow
    from fnirs_app.core.user_info_manager import get_user_manager

    user_window = UserInfoWindow()

    # 等待用户确认
    if user_window.exec() == UserInfoWindow.Accepted:
        user_info = user_window.get_user_info()

        # 保存用户信息到管理器
        user_manager = get_user_manager()
        success = user_manager.save_user_info(
            user_info['name'],
            user_info['gender'],
            user_info['age'],
            user_info.get('external_id')
        )

        if success:
            logger.info(f"用户登录成功: {user_manager.get_user_summary()}")

            # 创建主窗口并传递用户信息
            window = MainWindow(user_info)
            window.setGeometry(100, 100, 800, 600)
            window.showMaximized()
            window.raise_()
            window.activateWindow()

            sys.exit(app.exec())
        else:
            logger.error("保存用户信息失败")
            sys.exit(1)
    else:
        # 用户取消登录
        logger.info("用户取消登录，程序退出")
        sys.exit(0)
```

---

## 6. MainWindow 初始化时的用户处理

```python
def __init__(self, user_info=None):
    super().__init__()

    # 保存用户信息
    self.user_info = user_info or {}
    
    # ... 其他初始化 ...

    # 更新标题栏用户信息显示
    if hasattr(self, 'title_bar') and self.user_info:
        self.title_bar.update_user_info(self.user_info)
```

---

## 7. 用户事件处理委托

```python
def _handle_new_user_detected(self, user_data):
    """处理检测到新用户的信号
    
    委托给事件处理器
    """
    return self.event_handler.handle_new_user_detected(user_data)

def _handle_cloud_status_changed(self, status):
    """处理云服务状态改变的信号
    
    委托给事件处理器
    """
    return self.event_handler.handle_cloud_status_changed(status)
```

---

## 8. 用户数据保存目录

用户数据按用户名分目录保存:

```
%USERPROFILE%/.golgi/data/
├── 张三/
│   ├── .segments/              # 分段临时文件
│   │   └── temp_recording_*.npy
│   └── recording_*.mat         # 完整数据
├── 李四/
│   ├── .segments/
│   └── recording_*.mat
└── ...
```

---

## 9. 用户轮询定时器

```python
# 在关闭时停止用户轮询定时器
def closeEvent(self, event):
    # ...
    
    # 停止用户轮询定时器
    if hasattr(self, 'user_poll_timer') and self.user_poll_timer.isActive():
        self.user_poll_timer.stop()
        logger.info("应用程序关闭，已停止用户轮询定时器。")
    
    # ...
```
