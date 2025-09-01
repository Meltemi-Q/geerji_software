"""
fNIRS SDK数据类型定义

定义SDK中使用的数据结构，确保与API文档规格一致
"""

from dataclasses import dataclass
from typing import Dict, List, Optional, Union
import numpy as np


@dataclass
class BrainOxygenData:
    """脑氧数据核心结构（简单的HbO和HbR两个基本指标）"""
    
    timestamp: float          # Unix时间戳（毫秒）
    frame_id: int            # 数据帧ID，从0开始递增
    HbO: np.ndarray          # 氧合血红蛋白浓度 (864,) 单位：μmol/L
    HbR: np.ndarray          # 去氧血红蛋白浓度 (864,) 单位：μmol/L
    device_status: str       # 设备状态：'connected', 'disconnected', 'error'


@dataclass
class DeviceInfo:
    """设备信息结构"""
    
    device_id: str           # 设备ID
    firmware_version: str    # 固件版本
    hardware_version: str    # 硬件版本
    serial_number: str       # 序列号
    sample_rate: int         # 采样率（Hz）
    channel_count: int       # 通道数
    wavelengths: List[int]   # 支持的波长列表
    node_count: int = 6      # 节点数量，默认6


@dataclass
class ProcessingConfig:
    """数据处理配置"""
    
    # 光密度转换配置
    baseline_points: int = 2              # 基线计算使用的时间点数
    
    # 滤波配置
    highpass_freq: float = 0.01          # 高通滤波频率 (Hz)
    lowpass_freq: float = 0.08           # 低通滤波频率 (Hz)
    filter_method: str = 'FFT'           # 滤波方法
    
    # 运动校正配置
    motion_correction: bool = True        # 是否启用运动校正
    motion_method: str = 'TDDR'          # 运动校正方法
    
    # 血氧计算配置
    ppf_values: List[float] = None       # 路径长度因子 [6, 6]
    wavelengths: List[int] = None        # 波长列表 [735, 850]
    
    # 采样配置
    sample_rate: int = 8                 # 采样率 (Hz)
    ppf: List[float] = None              # 别名，与ppf_values相同
    
    def __post_init__(self):
        if self.ppf_values is None:
            self.ppf_values = [6, 6]
        if self.wavelengths is None:
            self.wavelengths = [735, 850]
        if self.ppf is None:
            self.ppf = self.ppf_values


# 异常类定义
class FNIRSError(Exception):
    """fNIRS SDK基础异常类"""
    pass


class DeviceNotFoundError(FNIRSError):
    """设备未找到异常"""
    pass


class DeviceConnectionError(FNIRSError):
    """设备连接失败异常"""
    pass


class DataProcessingError(FNIRSError):
    """数据处理错误异常"""
    pass


class NoDataAvailableError(FNIRSError):
    """无可用数据异常"""
    pass


class StreamStartError(FNIRSError):
    """数据流启动失败异常"""
    pass


# 消光系数数据（与客户端保持一致）
HB_EXTINCTION_COEFFS = {
    650: {'HbO': 506.0, 'HbR': 3743.0},
    652: {'HbO': 488.0, 'HbR': 3677.0},
    654: {'HbO': 474.0, 'HbR': 3612.0},
    656: {'HbO': 464.0, 'HbR': 3548.0},
    658: {'HbO': 454.3, 'HbR': 3491.3},
    660: {'HbO': 445.0, 'HbR': 3442.0},
    735: {'HbO': 1294.0, 'HbR': 2259.0},  # 客户端使用的关键波长
    850: {'HbO': 2526.0, 'HbR': 1798.0},  # 客户端使用的关键波长
    # 可以根据需要添加更多波长
}

# 默认处理参数
DEFAULT_SAMPLE_RATE = 8
DEFAULT_CHANNEL_COUNT = 864
DEFAULT_NODE_COUNT = 6
DEFAULT_WAVELENGTHS = [735, 850]
DEFAULT_PPF = [6, 6]

# 硬件连接参数
DEVICE_VID = "18D1"  # 戈尔基fNIRS设备VID（客户端验证）
DEVICE_PID = "D002"  # 戈尔基fNIRS设备PID（客户端验证）
DEVICE_BAUD_RATE = 2000000
DEVICE_TIMEOUT = 1.0