# 设备连接与管理 - 完整实现

> 最后更新: 2025-11-28

---

## 1. 设备通信协议

### 1.1 串口配置
```python
self.ser = serial.Serial(port, baudrate=2000000, timeout=1)
```

### 1.2 控制命令
```python
# 开始采集命令
collect_data = bytes([0x01, 0x00, 0x03, 0x00, 0x00, 0x04, 0x04])
self.ser.write(collect_data)

# 停止采集命令
shut = bytes([0x01, 0x00, 0x04, 0x00, 0x00, 0x04, 0x04])
self.ser.write(shut)
```

---

## 2. 设备管理委托方法 - 完整代码

```python
def add_device(self):
    """添加设备 - 委托给业务逻辑管理器"""
    return self.business_logic_manager.add_device()

def disconnect_device(self):
    """断开设备连接 - 委托给业务逻辑管理器"""
    return self.business_logic_manager.disconnect_device()

def connect_device(self):
    """连接设备 - 委托给业务逻辑管理器"""
    return self.business_logic_manager.connect_device()

def scan_nodes(self):
    """扫描设备节点 - 委托给业务逻辑管理器"""
    return self.business_logic_manager.scan_nodes()

def load_YSB_info(self):
    """加载YSB设备信息 - 委托给业务逻辑管理器"""
    return self.business_logic_manager.load_YSB_info()

def show_raw_data(self):
    """显示原始数据 - 委托给业务逻辑管理器"""
    return self.business_logic_manager.show_raw_data()
```

---

## 3. 节点扫描结果处理 - 完整代码

```python
def handle_nodes_info(self, nodes_info):
    """处理节点扫描结果
    
    参数:
        nodes_info: 节点信息列表
            [{
                'nid': 节点ID,
                'node_hw': 硬件版本,
                'node_sw': 软件版本,
                'dock_uid': {
                    'identifier': 标识符,
                    'sequence': 序列号
                }
            }, ...]
    """
    result = "扫描结果:\n"
    for node in nodes_info:
        result += f"Node ID: {node['nid']}, "
        result += f"HW: {node['node_hw']}, "
        result += f"SW: {node['node_sw']}, "
        result += f"Dock UID: {node['dock_uid']['identifier']}-{node['dock_uid']['sequence']}\n"
    show_auto_close_message(self, "节点扫描结果", result)
```

---

## 4. 数据接收处理 - 完整代码

```python
def handle_data(self, buffer, frame_count, node_list):
    """处理实时采集到的一帧数据
    
    参数:
        buffer: 环形缓冲区数据 (numpy array, shape: [buffer_size, channels])
        frame_count: 当前帧计数
        node_list: 当前在线节点列表
    
    流程:
        1. 处理循环缓冲区解卷绕
        2. 使用数据模型更新数据
        3. 同步到原有属性
        4. 节点拓扑变更检测与去抖重建
        5. 初始化 info（如果为空）
        6. 定期垃圾回收
    """
    # ==================== 1. 处理循环缓冲区 ====================
    max_len = buffer.shape[0]
    if frame_count <= max_len:
        raw = buffer[:frame_count]
    else:
        # 缓冲区已回绕，按时间顺序拼接
        idx = frame_count % max_len
        raw = np.concatenate((buffer[idx:], buffer[:idx]), axis=0)
        
    raw_data = raw.T  # 转置为 (channels, frames)

    # ==================== 2. 使用数据模型更新 ====================
    self.data_model.update_data_with_processing(raw_data, frame_count)

    # ==================== 3. 同步到原有属性 ====================
    self.data = self.data_model.data
    self.frame_count = self.data_model.frame_count
    self.display_data = self.data_model.display_data

    # ==================== 4. 节点拓扑变更检测 ====================
    try:
        current_nodes_set = frozenset(node_list)
        current_nodes_list = list(node_list)
        
        if self._last_node_list_set is None:
            # 首次初始化
            self._last_node_list_set = current_nodes_set
            self._pending_node_list = current_nodes_list
            self._pending_change_count = 0
        elif current_nodes_set != self._last_node_list_set:
            # 检测到变化
            if self._pending_node_list == current_nodes_list:
                self._pending_change_count += 1
            else:
                self._pending_node_list = current_nodes_list
                self._pending_change_count = 1
            
            # 达到确认阈值且超过最小间隔才重建
            if (self._pending_change_count >= self._node_change_confirm_frames and
                    (self.frame_count - self._last_info_rebuild_frame) >= self._node_rebuild_min_interval):
                from fnirs_app.data_handling.data_types import init_PCcount_info
                self.info = init_PCcount_info(self._pending_node_list)
                self._last_node_list_set = current_nodes_set
                self._last_info_rebuild_frame = self.frame_count
                
                # 清理缓存以触发按新拓扑重建
                self.hbo_data = None
                self.hbr_data = None
                if hasattr(self, 'channel_grid_view'):
                    try:
                        self.channel_grid_view.reset()
                    except Exception:
                        pass
    except Exception:
        pass

    # ==================== 5. 初始化 info ====================
    if self.info is None and self.data is not None:
        from fnirs_app.data_handling.data_types import init_PCcount_info
        self.info = init_PCcount_info(node_list)
        try:
            logger.debug("info初始化成功: io=%s, system=%s",
                         self.info.get('io'),
                         self.info.get('system'))
        except Exception:
            pass
        try:
            self._last_node_list_set = frozenset(node_list)
        except Exception:
            pass

    # ==================== 6. 定期垃圾回收 ====================
    self.gc_counter += 1
    if self.gc_counter > 100:
        self.gc_counter = 0
        gc.collect()
```

---

## 5. 节点拓扑跟踪变量

```python
# 在 __init__ 中初始化
self._last_node_list_set = None        # 上次的节点集合
self._pending_node_list = None          # 待确认的节点列表
self._pending_change_count = 0          # 待确认变化计数
self._last_info_rebuild_frame = -100000 # 上次重建的帧号
self._node_change_confirm_frames = 8    # 确认帧数阈值
self._node_rebuild_min_interval = 40    # 最小重建间隔
```

---

## 6. OnlineYSB 初始化 - 完整代码

```python
def initialize_online_YSB(self, raw_info):
    """初始化 OnlineYSB 对象
    
    参数:
        raw_info: 原始设备信息
    
    返回:
        OnlineYSB 对象
    """
    self.online_YSB = OnlineYSB()
    self.online_YSB.init_from_raw_info(raw_info)
    return self.online_YSB

def get_ndot_info(self):
    """获取 ndot 信息"""
    return self.online_YSB.get_ndot()
```

---

## 7. 事件处理 - 完整代码

```python
def handle_event(self, event_data):
    """处理事件数据
    
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

## 8. Info 更新 - 完整代码

```python
def update_info(self):
    """更新 info 信息
    
    同步:
        - 时间轴 info_t
        - 刺激矩阵 info_s
        - 同步点 paradigm.synchpts
        - 同步类型 paradigm.synchtype
        - 同步时间 paradigm.synchtimes
    """
    if self.info is None or self.data is None:
        return

    # 计算时间轴
    data_lens = self.data.shape[1]
    self.info_t = np.linspace(0, data_lens/self.sample_rate - 1/self.sample_rate, data_lens)

    if self.frame_count == 1:
        self.info_s = np.zeros((len(self.info_t), 1))
        self.info_CondNames = [""]

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

    # 更新 paradigm 信息
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

## 9. 初始化完成回调 - 完整代码

```python
def initialization_completed(self):
    """初始化完成回调"""
    try:
        logger = logging.getLogger(__name__)
        logger.info("Initialization completed, ready to receive data")
    except Exception:
        pass

def handle_initialization_complete(self):
    """处理初始化完成"""
    try:
        logger = logging.getLogger(__name__)
        logger.info("Initialization complete")
    except Exception:
        pass
```

---

## 10. 检查数据 - 完整代码

```python
def check_data(self):
    """检查数据 - 触发数据接收"""
    self.receiver.receive_data()
```

---

## 11. Info 结构说明

```python
info = {
    'system': {
        'framerate': 8,              # 帧率 Hz
    },
    'pairs': {
        'WL': np.array([735, 850, ...]),     # 波长数组
        'r2d': np.array([30, 30, ...]),      # 光源-探测器距离 mm
        'lamda': np.array([...]),             # 波长信息
    },
    'io': {
        'nframe': 0,                 # 当前帧数
    },
    'paradigm': {
        'synchpts': [],              # 同步点帧号
        'synchtype': [],             # 同步类型
        'synchtimes': [],            # 同步时间 (秒)
        'Pulse_1': ...,              # 脉冲1信息
        'Pulse_2': ...,              # 脉冲2信息
    },
    'optodes': {
        # 光极位置信息
    }
}
```
