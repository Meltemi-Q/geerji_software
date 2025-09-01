"""
数据结构模块

提供fNIRS数据的标准化数据结构，包括NIRS和NDot格式
"""

from .nirs import Nirs
from .ndot import NDot

__all__ = ['Nirs', 'NDot']