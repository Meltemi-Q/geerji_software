"""
fNIRS SDK配置管理模块

提供设备配置文件加载和验证功能
"""

from .loader import ConfigLoader
from .validator import ConfigValidator

__all__ = ['ConfigLoader', 'ConfigValidator']