"""
fNIRS SDK - 近红外光谱脑氧监测SDK

一个用于处理功能性近红外光谱（fNIRS）数据的专业Python SDK。
基于客户端验证的算法实现，提供实时血氧浓度测量和数据处理功能。

主要功能：
- 设备连接和管理  
- 实时数据采集
- 血氧浓度计算
- 数据滤波和校正
- 标准化API接口
- 康莲/康助侠设备集成

作者：戈尔基fNIRS团队
版本：2.1.0 (多设备集成版)
"""

__version__ = "2.1.0"
__author__ = "戈尔基fNIRS团队"

# 导入核心处理器
from .processor import FNIRSProcessor, quick_test_connection, collect_test_data

# 导入数据类型
from .data_types import (
    BrainOxygenData,
    DeviceInfo, 
    ProcessingConfig,
    # 异常类
    FNIRSError,
    DeviceNotFoundError,
    DeviceConnectionError,
    DataProcessingError,
    NoDataAvailableError,
    StreamStartError,
    # 常量
    DEFAULT_SAMPLE_RATE,
    DEFAULT_CHANNEL_COUNT,
    DEFAULT_WAVELENGTHS,
    DEFAULT_PPF
)

# 导入核心算法（供高级用户使用）
from .algorithms import (
    intensity2optical_density,
    od2conc,
    TDDR_motion_correction,
    nr_filter,
    process_nirs_data,
    select_channels
)

# 定义公开API
__all__ = [
    # 核心处理器
    'FNIRSProcessor',
    
    # 便捷函数
    'quick_test_connection',
    'collect_test_data',
    
    # 数据类型
    'BrainOxygenData',
    'DeviceInfo',
    'ProcessingConfig',
    
    # 异常类
    'FNIRSError',
    'DeviceNotFoundError',
    'DeviceConnectionError', 
    'DataProcessingError',
    'NoDataAvailableError',
    'StreamStartError',
    
    # 核心算法（高级API）
    'intensity2optical_density',
    'od2conc',
    'TDDR_motion_correction',
    'nr_filter',
    'process_nirs_data',
    'select_channels',
    
    # 常量
    'DEFAULT_SAMPLE_RATE',
    'DEFAULT_CHANNEL_COUNT', 
    'DEFAULT_WAVELENGTHS',
    'DEFAULT_PPF'
]


# SDK信息
def get_sdk_info() -> dict:
    """
    获取SDK版本和配置信息
    
    返回:
        包含SDK信息的字典
    """
    return {
        'name': 'fNIRS SDK',
        'version': __version__,
        'author': __author__,
        'description': '近红外光谱脑氧监测SDK (支持康莲/康助侠集成)',
        'sample_rate': DEFAULT_SAMPLE_RATE,
        'channel_count': DEFAULT_CHANNEL_COUNT,
        'wavelengths': DEFAULT_WAVELENGTHS,
        'supported_devices': ['戈尔基fNIRS设备', '康莲康复设备', '康助侠辅助设备'],
        'api_version': '2.1'
    }


# 模块级便捷函数
def create_processor(config: ProcessingConfig = None) -> FNIRSProcessor:
    """
    创建处理器实例的便捷函数
    
    参数:
        config: 处理配置，可选
    
    返回:
        FNIRSProcessor实例
    """
    return FNIRSProcessor(config)


def test_device_availability() -> bool:
    """
    测试设备是否可用的便捷函数
    
    返回:
        True: 设备可用
        False: 设备不可用
    """
    return quick_test_connection()