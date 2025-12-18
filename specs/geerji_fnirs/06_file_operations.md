# 文件操作与存储 - 完整实现

> 最后更新: 2025-11-28

---

## 1. 目录结构

```
%USERPROFILE%/.golgi/data/
├── {user_name}/
│   ├── .segments/                    # 分段临时文件目录
│   │   ├── temp_recording_*.npy      # 临时分段文件
│   │   └── ...
│   ├── recording_{timestamp}.mat     # 合并后的完整数据
│   └── rawdata_{timestamp}.mat       # 兜底保存的数据
└── ...

{cwd}/fnirs_reports/                  # 报告保存目录
├── report_*.pdf
└── ...

{cwd}/logs/                           # 日志目录
└── client_main_{timestamp}.log
```

---

## 2. 保存临时数据 - 完整代码

```python
def save_temp_data(self):
    """保存临时数据文件（基于最近 N 秒数据快照）
    
    由 temp_save_timer 定时触发
    默认每5分钟保存一次
    """
    try:
        logger.info("[segment] temp_save_timer tick")
        from fnirs_app.processing.file_operations import save_temp_data
        
        # 以当前定时器间隔作为片段时长（秒）
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
        
        # recent: shape (channels, frames) → 以时间为第一维存盘
        chunk = recent.T  # 转置为 (frames, channels)
        ok = save_temp_data([chunk], self.temp_dir)
        
        if ok:
            logger.info(f"[segment] saved npy, ~{seg_seconds}s, dir={self.temp_dir}, shape={chunk.shape}")
    
    except Exception as e:
        logger.error(f"[segment] save failed: {e}")
```

---

## 3. 保存完整录制 - 完整代码

```python
def save_complete_recording(self):
    """保存完整的录制数据
    
    调用外部模块函数合并分段文件
    
    返回:
        成功: MAT文件路径
        失败: None
    """
    from fnirs_app.processing.file_operations import save_complete_recording
    path = save_complete_recording(
        self.temp_dir, 
        self.recording_buffer, 
        self.info, 
        self.event_markers
    )
    if not path:
        try:
            QMessageBox.warning(self, "错误", "保存数据失败")
        except Exception:
            pass
    return path
```

---

## 4. 清理临时文件 - 完整代码

```python
def cleanup_temp_files(self):
    """清理临时文件
    
    删除 temp_dir 下所有 temp_recording_*.npy 文件
    """
    from fnirs_app.processing.file_operations import cleanup_temp_files
    cleanup_temp_files(self.temp_dir)
```

---

## 5. 录制控制 - 完整代码

### 5.1 开始录制

```python
def start_recording(self):
    """开始录制数据
    
    流程:
        1. 设置录制状态
        2. 初始化录制缓冲区
        3. 记录开始时间
        4. 启动分段保存定时器
        5. 创建分段保存目录
    """
    self.recording = True
    self.recording_buffer = []
    self.recording_start_time = time.time()
    self.temp_save_timer.start(self.temp_save_interval * 1000)  # 毫秒

    # 创建临时分段保存目录（按用户分组）
    from fnirs_app.processing.file_operations import create_temp_directory_for_user
    uname = str((getattr(self, 'user_info', {}) or {}).get('name', '')).strip()
    self.temp_dir = create_temp_directory_for_user(uname)
    print('临时保存目录:', self.temp_dir)

    show_auto_close_message(self, "录制开始", "数据录制已开始")
```

### 5.2 停止录制

```python
def stop_recording(self):
    """停止录制数据
    
    流程:
        1. 检查录制状态
        2. 设置录制状态为False
        3. 停止分段保存定时器
        4. 保存完整数据
        5. 清理临时文件
    """
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

---

## 6. 数据清洗函数（在 stop_data_collection 中定义）

```python
def _sanitize_for_mat(x):
    """清洗数据以避免 savemat 失败
    
    处理:
        - None → ''
        - dict → 递归清洗
        - list/tuple → 递归清洗
        - object dtype array → 递归清洗
    """
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
    """清洗事件标记用于保存
    
    参数:
        evts: 事件列表 [(timestamp, name), ...]
    
    返回:
        numpy array, shape (n_events, 2), dtype object
    """
    if not evts:
        return []
    pairs = []
    for e in evts:
        try:
            ts, name = e[0], e[1]
        except Exception:
            continue
        try:
            ts = float(ts) if ts is not None else np.nan
        except Exception:
            ts = np.nan
        name = '' if name is None else str(name)
        pairs.append([ts, name])
    return np.array(pairs, dtype=object)
```

---

## 7. MAT 文件保存格式

```python
# 保存到 MAT 文件
data_to_save = {
    'data': np.float32,      # 数据数组 (channels, frames) 或 (frames, channels)
    'info': dict,            # 设备和通道信息（已清洗）
    'duration': float,       # 采集时长（秒）
    'events': np.ndarray     # 事件标记 shape (n_events, 2), dtype object
                             # [[timestamp, name], ...]
}

savemat(filename, data_to_save, do_compression=True)
```

---

## 8. 兜底保存逻辑（在 stop_data_collection 中）

```python
# 当分段合并失败时执行兜底保存
if not mat_file_path:
    try:
        # 确定用户目录
        user_dir = os.path.dirname(self.temp_dir.rstrip("/\\"))
        if os.path.basename(self.temp_dir.rstrip("/\\")).lower() in ('.segments', 'segments', '.tmp', '.npy'):
            user_dir = os.path.dirname(self.temp_dir.rstrip("/\\"))
        os.makedirs(user_dir, exist_ok=True)
        
        filename = f"rawdata_{time.strftime('%Y%m%d_%H%M%S')}.mat"
        mat_file_path = os.path.join(user_dir, filename)

        # 仅截取本次会话的尾部数据
        src_session = src
        try:
            if isinstance(src, np.ndarray) and src.ndim == 2 and delta_frames > 0:
                frames_in_buffer = src.shape[1]
                frames_to_take = min(int(delta_frames), frames_in_buffer)
                if frames_to_take > 0:
                    start_rel = max(0, frames_in_buffer - frames_to_take)
                    src_session = src[:, start_rel:]
                    logger.info(
                        "使用会话窗口保存数据, "
                        "frames_in_buffer=%d, delta_frames=%d, start_rel=%d, save_frames=%d",
                        frames_in_buffer, delta_frames, start_rel, src_session.shape[1],
                    )
        except Exception as e:
            src_session = src

        # 转换为 float32 并压缩保存
        try:
            data_to_save_data = np.ascontiguousarray(src_session).astype(np.float32, copy=False)
        except Exception:
            data_to_save_data = src_session
        
        data_to_save = {
            'data': data_to_save_data,
            'info': _sanitize_for_mat(self.info),
            'duration': self.duration,
            'events': _sanitize_events(self.event_markers)
        }
        savemat(mat_file_path, data_to_save, do_compression=True)
        logger.info(f"数据已保存到: {mat_file_path}")
    
    except Exception as e:
        logger.error(f"直接保存内存数据失败: {e}", exc_info=True)
```

---

## 9. 关键优化：开始采集时清理历史文件

```python
# 在 start_data_collection 中
# 清理历史遗留的分段文件，避免首次结束采集时一次性合并大量旧数据导致卡顿
try:
    from fnirs_app.processing.file_operations import cleanup_temp_files
    cleanup_temp_files(self.temp_dir)
    logger.info("start_data_collection: 已清理历史分段文件 %s", self.temp_dir)
except Exception as e:
    logger.warning("start_data_collection: 清理历史分段文件失败: %s", e)
```

**为什么需要这个优化**:
- 如果之前的采集会话异常退出，`.segments` 目录下会残留大量 `.npy` 文件
- 下次结束采集时会一次性加载所有文件，导致内存飙升、UI卡死
- 在开始采集时先清理，确保只合并本次会话的数据

---

## 10. 配置参数

```toml
# config.toml

[write]
temp_dir = ""                 # 临时目录（空则使用默认）
final_dir = ""                # 最终保存目录（空则使用用户目录）
segment_minutes = 5           # 分段间隔（分钟）
```

---

## 11. 文件命名规范

| 类型 | 命名格式 | 示例 |
|-----|---------|-----|
| 临时分段 | `temp_recording_{timestamp}.npy` | `temp_recording_20251128_143022.npy` |
| 合并数据 | `recording_{timestamp}.mat` | `recording_20251128_143500.mat` |
| 兜底数据 | `rawdata_{timestamp}.mat` | `rawdata_20251128_143500.mat` |
| 日志文件 | `client_main_{timestamp}.log` | `client_main_20251128_140000.log` |
