# 事件标记系统 - 完整实现

> 最后更新: 2025-11-28

---

## 1. 事件标记数据结构

```python
# MainWindow 中的事件标记列表
self.event_markers = []  # [(timestamp, event_name), ...]

# 示例
event_markers = [
    (0, 'start'),           # 帧号0，开始事件
    (80, 'task_start'),     # 帧号80，任务开始
    (240, 'task_end'),      # 帧号240，任务结束
    (320, 'stop'),          # 帧号320，停止事件
]
```

---

## 2. 添加事件标记 - 完整代码

```python
def add_event_marker_new(self, event_name):
    """添加新的事件标记
    
    参数:
        event_name: 事件名称字符串
            - 'start': 采集开始
            - 'stop': 采集结束
            - 'force_end': 强制结束
            - 'task_start': 任务开始
            - 'rest_start': 休息开始
            - 等等...
    
    流程:
        1. 调用数据模型的事件标记方法
        2. 同步到原有属性
        3. 记录日志
        4. 触发重绑
    """
    # 使用数据模型的事件标记方法
    self.data_model.add_event_marker_with_time(event_name)

    # 保持兼容性 - 同步到原有属性
    self.event_markers = self.data_model.event_markers
    self.info = self.data_model.info

    current_time = self.data_model.frame_count
    try:
        logger = logging.getLogger(__name__)
        logger.info("Event marker added: %s at frame %d", event_name, current_time)
    except Exception:
        pass

    self.update_plot()  # 触发重绘
```

---

## 3. 事件处理（旧接口） - 完整代码

```python
def handle_event(self, event_data):
    """处理事件数据（旧接口）
    
    参数:
        event_data: 事件数据字典
            {
                'label': 事件标签,
                'type': 事件类型,
                ...
            }
    """
    timestamp = self.frame_count / self.sample_rate  # 当前时间戳（秒）

    marker = {
        'timestamp': timestamp,
        'label': event_data.get('label', ''),
        'type': event_data.get('type', ''),
    }

    self.event_markers.append(marker)
```

---

## 4. 预定义事件类型

| 事件名 | 触发时机 | 说明 |
|-------|---------|-----|
| `start` | `start_data_collection()` | 采集开始 |
| `stop` | `stop_data_collection()` | 采集结束 |
| `force_end` | `switch_user()` | 强制结束（切换用户时） |
| `paradigm_start` | 范式控制器 | 范式开始 |
| `paradigm_end` | 范式控制器 | 范式结束 |
| `task_start` | 范式控制器 | 任务开始 |
| `task_end` | 范式控制器 | 任务结束 |
| `rest_start` | 范式控制器 | 休息开始 |

---

## 5. 采集开始时添加事件

```python
def start_data_collection(self, silent: bool = False):
    # ... 其他初始化 ...
    
    # 添加开始事件标记
    self.add_event_marker_new('start')
    
    # ...
```

---

## 6. 采集结束时添加事件

```python
def stop_data_collection(self, *, hardware_stop: bool = True):
    # 添加 stop 事件标记
    if not self.is_collecting and not self.event_markers:
        logger.info("Not collecting and no events, skipping stop marker.")
    elif not self.event_markers or self.event_markers[-1][1] != 'stop':
        self.add_event_marker_new('stop')
        logger.info('Added stop event marker.')
    
    # ...
```

---

## 7. 会话重置时清除事件 - 完整代码

```python
def reset_session(self):
    """重置当前会话状态
    
    清除事件相关:
        1. 数据模型中的事件标记
        2. MainWindow 中的 event_markers
        3. info['paradigm'] 中的同步点
    """
    try:
        logger.info("正在重置会话状态(轻量逻辑清零)...")
        
        # 1. 清空数据模型中的事件
        if hasattr(self, 'data_model'):
            self.data_model.clear_event_markers()
            self.data_model.frame_count = 0
            
        # 2. 重置主窗口属性
        self.frame_count = 0
        self.event_markers = []  # 关键：清空事件标记
        
        # 3. 清空 info 中的同步点
        if self.info and 'paradigm' in self.info:
            if 'synchpts' in self.info['paradigm']: 
                self.info['paradigm']['synchpts'] = []
            if 'synchtype' in self.info['paradigm']: 
                self.info['paradigm']['synchtype'] = []
            if 'synchtimes' in self.info['paradigm']: 
                self.info['paradigm']['synchtimes'] = []
        
        # 4. 重置接收器计数器
        if hasattr(self, 'receiver') and self.receiver:
            self.receiver.reset_frame_count()
             
        logger.info("会话状态重置完成")
        
    except Exception as e:
        logger.error(f"重置会话状态失败: {e}")
```

---

## 8. 清除所有数据时清除事件

```python
def clear_data(self):
    """清除所有数据和相关状态"""
    
    # ... 其他清理 ...
    
    # 关键：清空主窗口的 event_markers 引用
    self.event_markers = []
    
    # ...
```

---

## 9. 事件保存到 MAT 文件

```python
def _sanitize_events(evts):
    """清洗事件标记用于保存
    
    参数:
        evts: 事件列表 [(timestamp, name), ...]
    
    返回:
        numpy array, shape (n_events, 2), dtype object
        [[timestamp1, 'event1'], [timestamp2, 'event2'], ...]
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

# 保存到 MAT
savemat(filename, {
    'data': ...,
    'info': ...,
    'duration': ...,
    'events': _sanitize_events(self.event_markers)  # 这里保存事件
}, do_compression=True)
```

---

## 10. Info 同步（update_info 方法中）

```python
def update_info(self):
    """更新 info 信息，包括事件同步"""
    
    # ... 其他代码 ...
    
    # 处理临时事件
    if self.temp_events:
        self.info_timeStamp = []
        self.info_CondNames = []
        for eve in self.temp_events:
            self.info_timeStamp.append(eve['Timestamp'] * 1e-3)
            self.info_CondNames.append(eve['name'])
        
        self.info_s = np.zeros((len(self.info_t), len(self.info_CondNames)))
        for i, timeStampTmp in enumerate(self.info_timeStamp):
            indTmp = np.argmin(np.abs(self.info_t - timeStampTmp))
            self.info_s[indTmp, i] = 1

    # 更新 paradigm 同步点
    num_stim = self.info_s.shape[1]
    num_synchs = np.sum(self.info_s == 1)

    if num_synchs != 0:
        synchs = [np.where(self.info_s[:, i] == 1)[0] + 1 for i in range(num_stim)]
        synchTot = np.unique(np.sort(np.concatenate(synchs, axis=0)))

        self.info['paradigm']['synchpts'] = synchTot.tolist()
        self.info['paradigm']['synchtype'] = np.zeros_like(synchTot).tolist()

        for k in range(num_stim):
            field_names = f"Pulse_{k + 1}"
            self.info['paradigm'][field_names] = (np.where(synchTot == synchs[k])[0][0] + 1).tolist()
            self.info['paradigm']['synchtype'][self.info['paradigm'][field_names] - 1] = k + 1
        
        self.info['paradigm']['synchtimes'] = (synchTot / self.sample_rate).tolist()

    self.info['io']['nframe'] = self.frame_count
```

---

## 11. 时间计算

```python
# 帧号 → 时间（秒）
time_sec = frame_number / sample_rate

# 时间（秒） → 帧号
frame_number = int(time_sec * sample_rate)

# 示例
# sample_rate = 8 Hz
# frame_number = 80
# time_sec = 80 / 8 = 10 秒
```

---

## 12. 事件在绘图中的显示

事件标记通常在绑图中显示为垂直线：

```python
# 在 plot_manager.update_plot() 中
# 清除旧的事件标记
if hasattr(self, 'event_marker_items'):
    for item in self.event_marker_items:
        self.plot_widget.removeItem(item)
    self.event_marker_items = []

# 添加新的事件标记
for timestamp, name in self.event_markers:
    time_sec = timestamp / self.sample_rate
    line = pg.InfiniteLine(pos=time_sec, angle=90, pen='r')
    self.plot_widget.addItem(line)
    self.event_marker_items.append(line)
```
