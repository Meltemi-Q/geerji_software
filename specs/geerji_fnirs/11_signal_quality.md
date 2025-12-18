# 信号质量检测

> 最后更新: 2025-11-28

## 1. 信号质量组件

### 1.1 导入

```python
from SignalWidget import SignalQualityWidget
```

### 1.2 创建

```python
# 在UI初始化过程中创建
self.signal_quality_widget = SignalQualityWidget()
self.stacked_layout.addWidget(self.signal_quality_widget)
```

## 2. 更新信号质量

### 2.1 主更新方法

```python
def update_signal_quality(self, option=None):
    """更新信号质量显示"""
    if hasattr(self, 'data') and hasattr(self, 'info'):
        self.signal_quality_widget.update_data(self.data, self.info)
        if option is not None:
            self.signal_quality_widget.set_method(option)
```

### 2.2 在绘图更新中调用

```python
def update_plot(self):
    """更新绘图"""
    try:
        if hasattr(self, 'stacked_layout') and hasattr(self, 'plot_widget'):
            # 如果当前显示的是信号质量页
            if self.stacked_layout.currentWidget() == self.signal_quality_widget:
                if self.data.shape[-1] % 5 == 0:
                    # 每5帧更新一次
                    self.signal_quality_widget.update_data(
                        self.data[:, -100:-1],  # 使用最近100帧
                        self.info
                    )
                return
            
            # 如果不在曲线页，跳过绘图更新
            if self.stacked_layout.currentWidget() is not self.plot_widget:
                return
    except Exception:
        pass
    
    self.plot_manager.update_plot()
```

## 3. 事件处理

### 3.1 信号质量按钮点击

```python
def on_signal_quality_clicked(self):
    """信号质量按钮点击处理 - 委托给事件处理器"""
    return self.event_handler.on_signal_quality_clicked()
```

### 3.2 质量选项选择

```python
def on_quality_option_selected(self):
    """信号质量选项选择处理 - 委托给事件处理器"""
    return self.event_handler.on_quality_option_selected()
```

## 4. 信号质量评估方法

SignalQualityWidget 支持多种评估方法：

| 方法 | 说明 |
|-----|-----|
| SNR | 信噪比 |
| CV | 变异系数 |
| SCI | 头皮耦合指数 |
| PSP | 功率谱峰值 |

### 4.1 设置评估方法

```python
self.signal_quality_widget.set_method('SNR')
```

## 5. 显示切换

### 5.1 切换到信号质量页

```python
self.stacked_layout.setCurrentWidget(self.signal_quality_widget)
```

### 5.2 通道网格中的信号质量

```python
def show_channel_grid(self):
    """显示通道网格视图"""
    try:
        if hasattr(self, 'interface_manager'):
            return self.interface_manager.show_channel_grid()
    except Exception:
        pass
```

## 6. 数据要求

信号质量评估需要的数据：

| 数据 | 类型 | 说明 |
|-----|------|-----|
| `data` | np.ndarray | 原始数据 (channels, frames) |
| `info` | dict | 通道信息 |

### 6.1 info 结构要求

```python
info = {
    'pairs': {
        'WL': np.array([...]),    # 波长
        'r2d': np.array([...]),   # 源-探测器距离
    },
    'system': {
        'framerate': 8            # 采样率
    }
}
```

## 7. 更新频率控制

为避免频繁更新导致性能问题，信号质量更新有频率限制：

```python
# 每5帧更新一次
if self.data.shape[-1] % 5 == 0:
    self.signal_quality_widget.update_data(...)
```

## 8. 数据窗口

信号质量评估使用最近的数据窗口：

```python
# 使用最近100帧数据
self.signal_quality_widget.update_data(
    self.data[:, -100:-1],
    self.info
)
```

## 9. 与通道网格的关系

通道网格视图也会显示信号质量相关信息：

```python
def update_channel_grid(self):
    """更新通道网格"""
    if self.frame_count % 3 == 0:
        conc_data = self.process_nirs_data()
        self.hbo_data = conc_data['HbO']
        self.hbr_data = conc_data['HbR']
        
        self.channel_grid_view.setup_channels(
            {'hbo': self.hbo_data, 'hbr': self.hbr_data}, 
            self.info
        )
        self.channel_grid_view.update_plots()
```

## 10. 信号质量指标

### 10.1 SNR (信噪比)

```
SNR = 10 * log10(signal_power / noise_power)
```

### 10.2 CV (变异系数)

```
CV = std(signal) / mean(signal) * 100%
```

### 10.3 SCI (头皮耦合指数)

评估光极与头皮的接触质量。

### 10.4 PSP (功率谱峰值)

检测心跳频率 (约1Hz) 的功率谱峰值，用于评估血流信号质量。
