# 数据采集流程

> 最后更新: 2025-11-28

## 1. 采集流程概述

```
┌─────────────────┐
│  start_data_    │
│  collection()   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│ 设置采集状态    │────►│ 清理历史分段    │
│ is_collecting   │     │ cleanup_temp    │
└────────┬────────┘     └─────────────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│ 创建分段目录    │────►│ 启动分段定时器  │
│ temp_dir        │     │ temp_save_timer │
└────────┬────────┘     └─────────────────┘
         │
         ▼
┌─────────────────┐
│ 添加 start 标记 │
│ add_event_      │
│ marker_new()    │
└────────┬────────┘
         │
         ▼
    [采集进行中]
         │
         ▼
┌─────────────────┐
│ stop_data_      │
│ collection()    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 合并分段文件    │
│ save_complete_  │
│ recording()     │
└─────────────────┘
```

## 2. 开始采集

### 2.1 方法签名

```python
def start_data_collection(self, silent: bool = False):
    """开始数据采集
    
    参数:
        silent: 是否静默模式(不显示提示消息)
    """
```

### 2.2 完整实现

```python
def start_data_collection(self, silent: bool = False):
    # 1. 显示提示消息
    if not silent:
        show_auto_close_message(self, "开始采集", "开始采集数据")
    
    # 2. 设置采集状态
    self.is_collecting = True
    self.start_time = time.time()
    
    # 3. 记录会话起始帧
    try:
        self.session_start_frame = int(getattr(self, "frame_count", 0) or 0)
    except Exception:
        self.session_start_frame = 0
    
    # 4. 创建分段保存目录
    try:
        from fnirs_app.processing.file_operations import create_temp_directory_for_user
        uname = str((getattr(self, 'user_info', {}) or {}).get('name', '')).strip()
        self.temp_dir = create_temp_directory_for_user(uname)
    except Exception:
        base_dir = os.path.join(os.path.expanduser('~'), '.golgi', 'data')
        os.makedirs(base_dir, exist_ok=True)
        self.temp_dir = base_dir
    
    # 5. 清理历史遗留分段文件 (关键优化点!)
    try:
        from fnirs_app.processing.file_operations import cleanup_temp_files
        cleanup_temp_files(self.temp_dir)
        logger.info("start_data_collection: 已清理历史分段文件 %s", self.temp_dir)
    except Exception as e:
        logger.warning("start_data_collection: 清理历史分段文件失败: %s", e)
    
    # 6. 启动分段保存定时器
    try:
        if hasattr(self, 'temp_save_timer'):
            self.temp_save_timer.start(self.temp_save_interval * 1000)
    except Exception:
        pass
    
    # 7. 创建报告保存目录
    self.save_dir = os.path.join(os.getcwd(), 'fnirs_reports')
    os.makedirs(self.save_dir, exist_ok=True)
    
    # 8. 添加开始事件标记
    self.add_event_marker_new('start')
    
    # 9. 更新UI状态
    self.update_collection_buttons_state()
```

### 2.3 关键状态变量

| 变量 | 类型 | 说明 |
|-----|------|-----|
| `is_collecting` | bool | 采集状态标志 |
| `start_time` | float | 采集开始时间戳 |
| `session_start_frame` | int | 会话起始帧号 |
| `temp_dir` | str | 分段文件保存目录 |
| `save_dir` | str | 报告保存目录 |

## 3. 停止采集

### 3.1 方法签名

```python
def stop_data_collection(self, *, hardware_stop: bool = True):
    """停止数据采集并保存数据
    
    参数:
        hardware_stop: 
            - True: 同时向设备发送停止命令并停止接收线程
            - False: 仅结束会话并保存数据，不触碰底层硬件
    """
```

### 3.2 完整流程

```python
def stop_data_collection(self, *, hardware_stop: bool = True):
    # 1. 添加 stop 事件标记
    if not self.is_collecting and not self.event_markers:
        logger.info("Not collecting and no events, skipping stop marker.")
    elif not self.event_markers or self.event_markers[-1][1] != 'stop':
        self.add_event_marker_new('stop')
        logger.info('Added stop event marker.')
    
    try:
        if self.is_collecting:
            show_auto_close_message(self, "结束采集", "结束采集数据")
            self.is_collecting = False
            
            # 2. 停止分段保存定时器
            if hasattr(self, 'temp_save_timer') and self.temp_save_timer.isActive():
                self.temp_save_timer.stop()
            
            # 3. 根据需要停止硬件
            if hardware_stop:
                if self.ser:
                    shut = bytes([0x01, 0x00, 0x04, 0x00, 0x00, 0x04, 0x04])
                    self.ser.write(shut)
                    logger.info("Sent stop command to device.")
                
                if self.receiver:
                    self.receiver.stop()
                if self.receiver_thread and self.receiver_thread.isRunning():
                    self.receiver_thread.quit()
                    self.receiver_thread.wait()
            
            # 4. 计算采集时长
            self.end_time = time.time()
            self.duration = self.end_time - self.start_time if hasattr(self, 'start_time') else 0
            logger.info(f"数据采集持续时间: {self.duration:.2f} 秒")
            
            # 5. 计算本次会话新增帧数
            start_frame = int(getattr(self, "session_start_frame", 0) or 0)
            delta_frames = max(0, int(getattr(self, "frame_count", 0) or 0) - start_frame)
            
            # 6. 获取数据源
            src = getattr(self, 'data', None)
            if src is None:
                src = getattr(self, 'display_data', None)
            if src is None and hasattr(self, 'data_model'):
                src = getattr(self.data_model, '_data', None)
            
            # 7. 判断是否有有效数据
            if delta_frames <= 0 or src is None:
                logger.info("本次采集无有效数据(delta_frames=%d)，跳过保存。", delta_frames)
                show_auto_close_message(self, "数据未保存", "本次采集无有效数据，已跳过保存。", 1000)
                self.is_collecting = False
                self.update_collection_buttons_state()
                return True
            
            # 8. 合并分段文件
            mat_file_path = None
            try:
                from fnirs_app.processing.file_operations import save_complete_recording
                mat_file_path = save_complete_recording(
                    self.temp_dir,
                    getattr(self, 'recording_buffer', []),
                    self.info,
                    self.event_markers
                )
                self.cleanup_temp_files()
            except Exception as e:
                logger.error(f"合并片段失败: {e}")
                mat_file_path = None
            
            # 9. 兜底保存 (如果合并失败)
            if not mat_file_path:
                mat_file_path = self._fallback_save(src, delta_frames)
            
            # 10. 云服务上传
            if self.is_cloud_service_mode and self.current_server_user and mat_file_path:
                self._upload_to_cloud(mat_file_path)
            else:
                show_auto_close_message(self, "数据已保存", f"数据已保存到: {mat_file_path}", 3000)
            
            # 11. 重置状态
            self.is_collecting = False
            self.update_collection_buttons_state()
            
            # 12. 会话级停止时重置会话状态
            if not hardware_stop:
                self.reset_session()
            
            # 13. 云服务模式下返回范式菜单
            if self.is_cloud_service_mode and hasattr(self, 'paradigm_controller'):
                if self.paradigm_controller.current_stage:
                    QTimer.singleShot(1000, lambda: self.show_paradigm_menu())
        
        else:
            # 未处于采集中的兜底处理
            self._handle_non_collecting_stop(hardware_stop)
    
    except Exception as e:
        logger.error(f"保存数据时发生错误: {e}")
        QMessageBox.warning(self, "保存失败", f"保存数据时发生错误: {e}")
```

### 3.3 兜底保存逻辑

```python
def _fallback_save(self, src, delta_frames):
    """当分段合并失败时的兜底保存"""
    try:
        # 确定保存目录
        user_dir = os.path.dirname(self.temp_dir.rstrip("/\\"))
        if os.path.basename(self.temp_dir.rstrip("/\\")).lower() in ('.segments', 'segments', '.tmp', '.npy'):
            user_dir = os.path.dirname(self.temp_dir.rstrip("/\\"))
        os.makedirs(user_dir, exist_ok=True)
        
        filename = f"rawdata_{time.strftime('%Y%m%d_%H%M%S')}.mat"
        mat_file_path = os.path.join(user_dir, filename)
        
        # 仅截取本次会话的尾部数据
        src_session = src
        if isinstance(src, np.ndarray) and src.ndim == 2 and delta_frames > 0:
            frames_in_buffer = src.shape[1]
            frames_to_take = min(int(delta_frames), frames_in_buffer)
            if frames_to_take > 0:
                start_rel = max(0, frames_in_buffer - frames_to_take)
                src_session = src[:, start_rel:]
        
        # 数据清洗
        def _sanitize_for_mat(x):
            if x is None:
                return ''
            if isinstance(x, dict):
                return {k: _sanitize_for_mat(v) for k, v in x.items()}
            if isinstance(x, (list, tuple)):
                return [_sanitize_for_mat(v) for v in x]
            if isinstance(x, np.ndarray):
                if x.dtype == object:
                    return np.array([_sanitize_for_mat(v) for v in x], dtype=object)
                return x
            return x
        
        def _sanitize_events(evts):
            if not evts:
                return []
            pairs = []
            for e in evts:
                try:
                    ts, name = e[0], e[1]
                except Exception:
                    continue
                ts = float(ts) if ts is not None else np.nan
                name = '' if name is None else str(name)
                pairs.append([ts, name])
            return np.array(pairs, dtype=object)
        
        # 转换为 float32 并压缩保存
        data_to_save_data = np.ascontiguousarray(src_session).astype(np.float32, copy=False)
        data_to_save = {
            'data': data_to_save_data,
            'info': _sanitize_for_mat(self.info),
            'duration': self.duration,
            'events': _sanitize_events(self.event_markers)
        }
        savemat(mat_file_path, data_to_save, do_compression=True)
        
        logger.info(f"数据已保存到: {mat_file_path}")
        return mat_file_path
    
    except Exception as e:
        logger.error(f"直接保存内存数据失败: {e}", exc_info=True)
        return None
```

## 4. 分段保存机制

### 4.1 定时器配置

```python
# 分段间隔由配置文件决定 (默认5分钟)
self.temp_save_interval = get_param('write.segment_minutes', 5) * 60  # 秒

# 启动定时器
self.temp_save_timer = QTimer(self)
self.temp_save_timer.timeout.connect(self.save_temp_data)
```

### 4.2 分段保存方法

```python
def save_temp_data(self):
    """保存临时数据文件（基于最近 N 秒数据快照）"""
    try:
        logger.info("[segment] temp_save_timer tick")
        from fnirs_app.processing.file_operations import save_temp_data
        
        # 获取片段时长
        seg_seconds = int(getattr(self, 'temp_save_interval', 300))
        
        # 尝试从数据模型获取最近数据
        recent = None
        try:
            recent = self.data_model.get_recent_data(seconds=seg_seconds)
        except Exception:
            pass
        
        if recent is None:
            # 回退：使用显示数据的最后窗口
            src = getattr(self, 'display_data', None)
            if src is None:
                logger.info("[segment] no data/display_data, skip")
                return
            sr = getattr(self, 'sample_rate', 8) or 8
            pts = min(src.shape[1], int(sr * seg_seconds))
            recent = src[:, -pts:]
        
        if recent is None or recent.size == 0:
            logger.info("[segment] recent window empty, skip")
            return
        
        # 转置为 (frames, channels) 并保存
        chunk = recent.T
        ok = save_temp_data([chunk], self.temp_dir)
        
        if ok:
            logger.info(f"[segment] saved npy, ~{seg_seconds}s, dir={self.temp_dir}, shape={chunk.shape}")
    
    except Exception as e:
        logger.error(f"[segment] save failed: {e}")
```

### 4.3 分段文件格式

- **格式**: `.npy` (NumPy 二进制)
- **命名**: `temp_recording_{timestamp}.npy`
- **位置**: `{user_dir}/.segments/`

## 5. 录制控制

### 5.1 开始录制

```python
def start_recording(self):
    """开始录制数据"""
    self.recording = True
    self.recording_buffer = []
    self.recording_start_time = time.time()
    self.temp_save_timer.start(self.temp_save_interval * 1000)
    
    # 创建分段保存目录
    from fnirs_app.processing.file_operations import create_temp_directory_for_user
    uname = str((getattr(self, 'user_info', {}) or {}).get('name', '')).strip()
    self.temp_dir = create_temp_directory_for_user(uname)
    
    show_auto_close_message(self, "录制开始", "数据录制已开始")
```

### 5.2 停止录制

```python
def stop_recording(self):
    """停止录制数据"""
    if not self.recording:
        return
    
    self.recording = False
    self.temp_save_timer.stop()
    
    # 保存完整数据
    self.save_complete_recording()
    
    # 清理临时文件
    self.cleanup_temp_files()
    
    show_auto_close_message(self, "录制结束", "数据已保存")
```

### 5.3 保存完整录制

```python
def save_complete_recording(self):
    """保存完整的录制数据"""
    from fnirs_app.processing.file_operations import save_complete_recording
    path = save_complete_recording(
        self.temp_dir, 
        self.recording_buffer, 
        self.info, 
        self.event_markers
    )
    if not path:
        QMessageBox.warning(self, "错误", "保存数据失败")
    return path
```

## 6. 会话管理

### 6.1 会话重置

```python
def reset_session(self):
    """
    重置当前会话状态（逻辑清零），用于连续范式测试
    不清空Buffer物理内存，只重置指针和标记
    """
    try:
        logger.info("正在重置会话状态(轻量逻辑清零)...")
        
        # 1. 清空事件和 info 中的同步点
        if hasattr(self, 'data_model'):
            self.data_model.clear_event_markers()
            self.data_model.frame_count = 0
        
        # 2. 重置主窗口属性
        self.frame_count = 0
        self.event_markers = []
        if self.info and 'paradigm' in self.info:
            if 'synchpts' in self.info['paradigm']: 
                self.info['paradigm']['synchpts'] = []
            if 'synchtype' in self.info['paradigm']: 
                self.info['paradigm']['synchtype'] = []
            if 'synchtimes' in self.info['paradigm']: 
                self.info['paradigm']['synchtimes'] = []
        
        # 3. 重置接收器计数器
        if hasattr(self, 'receiver') and self.receiver:
            self.receiver.reset_frame_count()
        
        logger.info("会话状态重置完成（轻量级，无全图清空）")
        
    except Exception as e:
        logger.error(f"重置会话状态失败: {e}")
```

### 6.2 数据清除

```python
def clear_data(self):
    """清除所有数据和相关状态（统一入口）"""
    
    # 1. 使用数据模型清除数据
    if hasattr(self, "data_model") and self.data_model is not None:
        try:
            self.data_model.clear_all_data()
        except Exception as e:
            logger.info("clear_data: data_model.clear_all_data() 失败: %s", e)
    
    # 2. 清除原有属性
    self.data = None
    self.display_data = None
    self.info = None
    self.online_data = []
    self.online_info = None
    self.lmdata = None
    self.ddata = None
    self.lp2data = None
    self.hbo_data = None
    self.hbr_data = None
    self.hbt_data = None
    self.YSB_file_path = None
    self.event_markers = []
    
    # 3. 清除绑图
    if hasattr(self, "plot_widget") and self.plot_widget is not None:
        try:
            self.plot_widget.clear()
            if hasattr(self.plot_widget, "replot"):
                self.plot_widget.replot()
        except Exception:
            pass
    
    if hasattr(self, "plot_manager") and self.plot_manager is not None:
        self.plot_manager.plot_curves = []
    
    if hasattr(self, "plot_curves"):
        self.plot_curves = []
    if hasattr(self, "event_marker_items"):
        self.event_marker_items = []
    
    # 4. 重置状态
    self.current_view = "original"
    self.wavelength_mode = True
    self.frame_count = 0
    
    # 5. 更新UI
    if hasattr(self, "interface_manager"):
        self.interface_manager.update_bottom_button_visibility()
    if hasattr(self, "plot_visualization_manager"):
        self.plot_visualization_manager.update_button_text()
```

## 7. 范式完成处理

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

## 8. 状态流转图

```
                    ┌──────────────┐
                    │   未连接      │
                    └──────┬───────┘
                           │ add_device()
                           ▼
                    ┌──────────────┐
                    │   已连接      │◄─────────────────────┐
                    │ is_collecting │                      │
                    │    = False   │                      │
                    └──────┬───────┘                      │
                           │ start_data_collection()      │
                           ▼                              │
                    ┌──────────────┐                      │
                    │   采集中      │                      │
                    │ is_collecting │                      │
                    │    = True    │                      │
                    └──────┬───────┘                      │
                           │                              │
           ┌───────────────┼───────────────┐              │
           │               │               │              │
           ▼               ▼               ▼              │
    stop_data_     stop_data_     范式完成              │
    collection()   collection()   handle_               │
    (hw=True)      (hw=False)     paradigm_             │
           │               │      completion()          │
           │               │               │              │
           │               └───────────────┘              │
           │                       │                      │
           │                       │ reset_session()      │
           │                       │                      │
           ▼                       └──────────────────────┘
    ┌──────────────┐
    │   已断开      │
    │ (需重连)     │
    └──────────────┘
```
