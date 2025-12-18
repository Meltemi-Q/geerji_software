# 数据处理与算法 - 完整实现

> 最后更新: 2025-11-28

---

## 1. 数据处理流水线

```
原始数据 (Raw Intensity)
        │
        ▼
┌───────────────────────┐
│ intensity2optical_    │  光强度 → 光密度
│ density()             │  OD = -log10(I/I0)
└───────────┬───────────┘
            │
            ▼
┌───────────────────────┐
│ od2conc()             │  光密度 → 浓度
│                       │  使用 Beer-Lambert 定律
└───────────┬───────────┘
            │
            ├──► HbO (氧合血红蛋白)
            └──► HbR (脱氧血红蛋白)
            │
            ▼
┌───────────────────────┐
│ TDDR_motion_          │  运动伪迹校正 (可选)
│ correction()          │  配置: processing.tddr_enabled
└───────────┬───────────┘
            │
            ▼
┌───────────────────────┐
│ nr_filter()           │  FFT带通滤波
│ bandpass 0.01-0.08 Hz │  配置: processing.bandpass_hz
└───────────┬───────────┘
            │
            ▼
        processed_data
```

---

## 2. process_nirs_data - 完整代码

```python
def process_nirs_data(self):
    """处理fNIRS数据 - 完整处理流水线
    
    流程:
        1. 获取波长信息
        2. 处理3波长/2波长情况
        3. 光强度 → 光密度
        4. 光密度 → 浓度 (HbO/HbR)
        5. TDDR运动伪迹校正（可选）
        6. FFT带通滤波
    
    返回:
        dict: {'HbO': hbo_array, 'HbR': hbr_array}
    """
    # ==================== 1. 获取波长信息 ====================
    self.wavelengths = np.unique(self.info['pairs']['lamda'])
    
    # ==================== 2. 处理不同波长数量 ====================
    if len(self.wavelengths) == 3:
        # 3波长情况：只取第1和第3波长
        self.wavelengths = [self.wavelengths[0], self.wavelengths[2]]

        # 计算每个波长对应的通道数
        channels_per_wavelength = self.data.shape[0] // 3

        # 选择对应波长的数据
        data = np.vstack([
            self.data[:channels_per_wavelength],
            self.data[2*channels_per_wavelength:]
        ])

        # 光密度转换
        od_data = intensity2optical_density(data)

    elif len(self.wavelengths) == 2:
        # 2波长情况：直接转换
        od_data = intensity2optical_density(self.data)
    else:
        raise ValueError("波长数量不正确")

    # ==================== 3. 浓度计算 ====================
    ppf = [6, 6]  # 部分路径因子 (Partial Path Factor)
    conc_data = od2conc(od_data, self.wavelengths, self.info, ppf)

    # ==================== 4. TDDR运动伪迹校正 ====================
    # 可配置，默认关闭，仅在配置中显式开启时才使用
    try:
        tddr_enabled = bool(get_param('processing.tddr_enabled', False))
    except Exception:
        tddr_enabled = False
    
    if tddr_enabled:
        hbo_data = TDDR_motion_correction(conc_data['HbO'], 10)
        hbr_data = TDDR_motion_correction(conc_data['HbR'], 10)
    else:
        hbo_data = conc_data['HbO']
        hbr_data = conc_data['HbR']

    # ==================== 5. 滤波参数配置 ====================
    filter_method = 'FFT'     # FFT滤波更平滑
    filter_model = 3          # 带通滤波
    filter_order = None
    sample_rate = self.sample_rate
    
    # 从配置读取带通范围
    try:
        bp = get_param('processing.bandpass_hz', [0.01, 0.08]) or [0.01, 0.08]
        low_hz = float(bp[0])
        high_hz = float(bp[1])
        if low_hz <= 0 or high_hz <= 0 or low_hz >= high_hz:
            low_hz, high_hz = 0.01, 0.08
    except Exception:
        low_hz, high_hz = 0.01, 0.08
    
    # 归一化频率
    hpf = low_hz / sample_rate
    lpf = high_hz / sample_rate

    # ==================== 6. FFT带通滤波 ====================
    processed_data = nr_filter(
        {'HbO': hbo_data, 'HbR': hbr_data},
        filter_method=filter_method,
        filter_model=filter_model,
        filter_order=filter_order,
        hpf=hpf,
        lpf=lpf,
        sample_rate=sample_rate
    )

    return processed_data
```

---

## 3. 在线处理数据更新 - 完整代码

```python
def update_online_processed_data(self, processed_data):
    """更新在线处理后的数据
    
    参数:
        processed_data: 处理后的数据字典
            {
                'optical_density': OD数据,
                'motion_denoised': 去噪数据,
                'bandpass_filtered': 滤波数据,
                'concentration': {
                    'hbo': HbO数据,
                    'hbr': HbR数据
                }
            }
    """
    self.lmdata = processed_data['optical_density']
    self.ddata = processed_data['motion_denoised']
    self.lp2data = processed_data['bandpass_filtered']
    self.hbo_data = processed_data['concentration']['hbo']
    self.hbr_data = processed_data['concentration']['hbr']
```

---

## 4. 通道筛选 - 完整代码

```python
def get_keep(self):
    """获取需要显示的通道掩码
    
    筛选规则:
        1. 距离筛选: 只显示指定距离范围内的通道
        2. 波长筛选: 根据按钮状态显示对应波长
    
    返回:
        numpy bool array: 每个通道是否显示
    """
    # ==================== 1. 读取距离筛选配置 ====================
    try:
        r2d_range = get_param('display.r2d_mm_range', [25, 35]) or [25, 35]
        rmin, rmax = float(r2d_range[0]), float(r2d_range[1])
    except Exception:
        rmin, rmax = 25.0, 35.0

    r2d = self.info['pairs']['r2d']
    wl = self.info['pairs']['WL']

    # ==================== 2. 波长筛选 ====================
    mask_wl = np.ones_like(r2d, dtype=bool)
    
    if hasattr(self, 'button_735_hbr') and self.button_735_hbr.isChecked():
        mask_wl = (wl == 735)
    elif hasattr(self, 'button_850_hbo') and self.button_850_hbo.isChecked():
        mask_wl = (wl == 850)

    # ==================== 3. 距离筛选 ====================
    mask_r = (r2d >= rmin) & (r2d <= rmax)
    
    return mask_wl & mask_r
```

---

## 5. 数据选择 - 完整代码

```python
def select_plot_data(self):
    """选择绘图数据 - 委托给绘图管理器"""
    return self.plot_manager.select_plot_data()
```

---

## 6. 数据视图处理 - 完整代码

```python
def handle_data_view(self, data_type):
    """处理数据视图切换
    
    参数:
        data_type: 数据类型
            - 'original': 原始数据
            - 'od': 光密度
            - 'hbo': 氧合血红蛋白
            - 'hbr': 脱氧血红蛋白
    """
    if self.is_online_mode:
        self.now_button = data_type
        self.update_plot()
    else:
        self.data_processing_methods.process_data(data_type)
```

---

## 7. 参数配置

### 7.1 处理参数

```python
self.params = {
    'bthresh': 0.075,      # 基线阈值
    'det': 1,              # 探测器
    'highpass': 1,         # 高通启用
    'lowpass1': 1,         # 低通1启用
    'ssr': 1,              # SSR
    'lowpass2': 1,         # 低通2启用
    'DoGVTD': 1,           # DoGVTD
    'resample': 5,         # 重采样
    'omega_hp': 0.02,      # 高通截止频率
    'omega_lp1': 1,        # 低通1截止频率
    'omega_lp2': 0.5,      # 低通2截止频率
    'freqout': 1,          # 输出频率
    'rstol': 1e-5,         # 容差
    'DQC_ONLY': 0,         # 仅DQC模式
    'omega_resample': 5    # 重采样频率
}
```

### 7.2 波长与消光系数

```python
self.wavelengths = [735, 850]  # 波长 (nm)
self.nwl = 2                   # 波长数量

# 消光系数矩阵
# 行: [HbO, HbR]
# 列: [735nm, 850nm]
self.E = np.array([
    [1.6348, 3.1430],  # HbO 在两个波长下的消光系数
    [2.1190, 1.6100]   # HbR 在两个波长下的消光系数
])
```

### 7.3 采样参数

```python
self.framerate = 8      # 帧率 (Hz)
self.sample_rate = 8    # 采样率 (Hz)
self.hp_rate = 0.02     # 高通率
```

---

## 8. 配置文件示例

```toml
# config.toml

[processing]
tddr_enabled = false          # TDDR运动校正开关
bandpass_hz = [0.01, 0.08]    # 带通滤波范围 (Hz)

[display]
r2d_mm_range = [25, 35]       # 显示的光源-探测器距离范围 (mm)
```

---

## 9. 数据形状说明

| 变量 | 形状 | 说明 |
|-----|------|-----|
| `self.data` | `(channels, frames)` | 原始数据 |
| `self.display_data` | `(channels, frames)` | 显示数据 |
| `self.hbo_data` | `(channels/2, frames)` | HbO浓度 |
| `self.hbr_data` | `(channels/2, frames)` | HbR浓度 |
| `self.lmdata` | `(channels, frames)` | 光密度 |
| `self.ddata` | `(channels, frames)` | 去噪数据 |
| `self.lp2data` | `(channels, frames)` | 滤波数据 |

---

## 10. 算法模块导入

```python
# 光密度转换
from fnirs_app.processing.algorithms.data_processing_algorithms import intensity2optical_density

# 信号滤波
from fnirs_app.processing.algorithms.signal_processing import nr_filter

# 运动校正
from fnirs_app.processing.algorithms.motion_correction import TDDR_motion_correction

# 浓度计算
from fnirs_app.processing.algorithms.concentration_calculation import od2conc
```
