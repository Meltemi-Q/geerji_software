"""
配置文件加载器

基于客户端验证的配置加载系统，支持TOML和JSON格式
"""

import os
import json
import toml
import logging
from typing import Dict, Any, Optional
from pathlib import Path

logger = logging.getLogger(__name__)


class ConfigLoader:
    """
    配置文件加载器
    
    支持从客户端addfiles目录迁移的配置文件格式
    """
    
    def __init__(self, config_dir: Optional[str] = None):
        """
        初始化配置加载器
        
        参数:
            config_dir: 配置文件目录，如果为None则使用默认目录
        """
        if config_dir is None:
            # 默认使用当前模块所在目录下的device_profiles
            self.config_dir = Path(__file__).parent / "device_profiles"
        else:
            self.config_dir = Path(config_dir)
        
        self.default_profile = "default_6node"
        
    def load_device_profile(self, profile_name: str = None) -> Dict[str, Any]:
        """
        加载设备配置文件
        
        参数:
            profile_name: 配置文件名，如果为None则使用默认配置
            
        返回:
            包含完整设备配置的字典
        """
        if profile_name is None:
            profile_name = self.default_profile
            
        profile_dir = self.config_dir / profile_name
        
        if not profile_dir.exists():
            raise FileNotFoundError(f"配置文件目录不存在: {profile_dir}")
        
        # 加载各个配置文件
        config = {}
        
        try:
            # 1. 加载元数据
            metadata_path = profile_dir / "metadata.toml"
            if metadata_path.exists():
                config['metadata'] = self._load_toml(metadata_path)
                logger.info(f"已加载metadata配置: {metadata_path}")
            
            # 2. 加载布局配置
            layout_path = profile_dir / "layout.json"
            if layout_path.exists():
                config['layout'] = self._load_json(layout_path)
                logger.info(f"已加载layout配置: {layout_path}")
            
            # 3. 加载硬件配置
            hardware_path = profile_dir / "hardware.toml"
            if hardware_path.exists():
                config['hardware'] = self._load_toml(hardware_path)
                logger.info(f"已加载hardware配置: {hardware_path}")
            
            # 4. 加载录制数据配置
            recording_path = profile_dir / "recordingdata.toml"
            if recording_path.exists():
                config['recordingdata'] = self._load_toml(recording_path)
                logger.info(f"已加载recordingdata配置: {recording_path}")
            
            # 5. 如果存在12节点配置，也加载进来
            recording12_path = profile_dir / "recordingdata12.toml"
            if recording12_path.exists():
                config['recordingdata12'] = self._load_toml(recording12_path)
                logger.info(f"已加载recordingdata12配置: {recording12_path}")
            
            return config
            
        except Exception as e:
            logger.error(f"加载设备配置失败: {e}")
            raise
    
    def get_layout_info(self, profile_name: str = None) -> Dict[str, Any]:
        """
        获取设备布局信息
        
        参数:
            profile_name: 配置文件名
            
        返回:
            布局信息字典
        """
        config = self.load_device_profile(profile_name)
        return config.get('layout', {})
    
    def get_hardware_info(self, profile_name: str = None) -> Dict[str, Any]:
        """
        获取硬件配置信息
        
        参数:
            profile_name: 配置文件名
            
        返回:
            硬件配置字典
        """
        config = self.load_device_profile(profile_name)
        return config.get('hardware', {})
    
    def get_recording_config(self, profile_name: str = None, node_count: int = 6) -> Dict[str, Any]:
        """
        获取录制配置信息
        
        参数:
            profile_name: 配置文件名
            node_count: 节点数量，6或12
            
        返回:
            录制配置字典
        """
        config = self.load_device_profile(profile_name)
        
        if node_count == 12 and 'recordingdata12' in config:
            return config['recordingdata12']
        else:
            return config.get('recordingdata', {})
    
    def detect_node_count(self, profile_name: str = None) -> int:
        """
        从配置文件中检测节点数量
        
        参数:
            profile_name: 配置文件名
            
        返回:
            检测到的节点数量
        """
        try:
            layout = self.get_layout_info(profile_name)
            docks = layout.get('docks', [])
            return len(docks) if docks else 6  # 默认6节点
        except Exception as e:
            logger.warning(f"检测节点数量失败: {e}，使用默认值6")
            return 6
    
    def _load_json(self, file_path: Path) -> Dict[str, Any]:
        """加载JSON文件"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"加载JSON文件失败 {file_path}: {e}")
            raise
    
    def _load_toml(self, file_path: Path) -> Dict[str, Any]:
        """加载TOML文件"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                return toml.load(f)
        except Exception as e:
            logger.error(f"加载TOML文件失败 {file_path}: {e}")
            raise
    
    def list_available_profiles(self) -> list:
        """
        列出所有可用的配置文件
        
        返回:
            配置文件名列表
        """
        if not self.config_dir.exists():
            return []
        
        profiles = []
        for item in self.config_dir.iterdir():
            if item.is_dir():
                profiles.append(item.name)
        
        return sorted(profiles)


# 便捷函数
def load_default_config() -> Dict[str, Any]:
    """
    加载默认配置
    
    返回:
        默认设备配置字典
    """
    loader = ConfigLoader()
    return loader.load_device_profile()


def get_default_node_count() -> int:
    """
    获取默认节点数量
    
    返回:
        默认节点数量
    """
    loader = ConfigLoader()
    return loader.detect_node_count()