"""
配置文件验证器

验证配置文件的完整性和正确性
"""

import logging
from typing import Dict, Any, List, Optional

logger = logging.getLogger(__name__)


class ConfigValidator:
    """
    配置文件验证器
    
    验证从客户端迁移的配置文件是否完整和正确
    """
    
    def __init__(self):
        """初始化验证器"""
        # 必需的配置字段
        self.required_metadata_fields = [
            'description', 'version', 'file_names'
        ]
        
        self.required_layout_fields = [
            'docks'
        ]
        
        self.required_hardware_fields = [
            'firmware_version', 'sampling_rate'
        ]
        
        self.required_recording_fields = [
            'channels', 'sample_rate'
        ]
    
    def validate_device_profile(self, config: Dict[str, Any]) -> tuple[bool, List[str]]:
        """
        验证完整的设备配置
        
        参数:
            config: 设备配置字典
            
        返回:
            (is_valid, error_messages)
        """
        errors = []
        
        # 验证各个配置部分
        if 'metadata' in config:
            is_valid, meta_errors = self.validate_metadata(config['metadata'])
            if not is_valid:
                errors.extend([f"metadata: {err}" for err in meta_errors])
        else:
            errors.append("缺少metadata配置")
        
        if 'layout' in config:
            is_valid, layout_errors = self.validate_layout(config['layout'])
            if not is_valid:
                errors.extend([f"layout: {err}" for err in layout_errors])
        else:
            errors.append("缺少layout配置")
        
        if 'hardware' in config:
            is_valid, hw_errors = self.validate_hardware(config['hardware'])
            if not is_valid:
                errors.extend([f"hardware: {err}" for err in hw_errors])
        else:
            errors.append("缺少hardware配置")
        
        if 'recordingdata' in config:
            is_valid, rec_errors = self.validate_recording(config['recordingdata'])
            if not is_valid:
                errors.extend([f"recordingdata: {err}" for err in rec_errors])
        else:
            errors.append("缺少recordingdata配置")
        
        return len(errors) == 0, errors
    
    def validate_metadata(self, metadata: Dict[str, Any]) -> tuple[bool, List[str]]:
        """验证元数据配置"""
        errors = []
        
        # 检查必需字段
        for field in self.required_metadata_fields:
            if field not in metadata:
                errors.append(f"缺少必需字段: {field}")
        
        # 验证file_names字段
        if 'file_names' in metadata:
            file_names = metadata['file_names']
            required_files = ['layout_file', 'hardware_file', 'recordingdata_file']
            
            for file_field in required_files:
                if file_field not in file_names:
                    errors.append(f"file_names中缺少: {file_field}")
        
        return len(errors) == 0, errors
    
    def validate_layout(self, layout: Dict[str, Any]) -> tuple[bool, List[str]]:
        """验证布局配置"""
        errors = []
        
        # 检查必需字段
        for field in self.required_layout_fields:
            if field not in layout:
                errors.append(f"缺少必需字段: {field}")
        
        # 验证docks配置
        if 'docks' in layout:
            docks = layout['docks']
            if not isinstance(docks, list):
                errors.append("docks必须是列表类型")
            elif len(docks) == 0:
                errors.append("docks列表不能为空")
            else:
                # 验证每个dock的结构
                for i, dock in enumerate(docks):
                    if not isinstance(dock, dict):
                        errors.append(f"dock[{i}]必须是字典类型")
                        continue
                    
                    # 检查dock_id字段（实际字段名）
                    if 'dock_id' not in dock:
                        errors.append(f"dock[{i}]缺少字段: dock_id")
                    
                    # 检查optodes字段
                    if 'optodes' not in dock:
                        errors.append(f"dock[{i}]缺少字段: optodes")
        return len(errors) == 0, errors
    
    def validate_hardware(self, hardware: Dict[str, Any]) -> tuple[bool, List[str]]:
        """验证硬件配置"""
        errors = []
        
        # 检查是否有Hub配置（实际结构）
        if 'Hub' in hardware:
            hub_config = hardware['Hub']
            
            # 检查必需字段
            for field in self.required_hardware_fields:
                if field not in hub_config:
                    errors.append(f"缺少必需字段: {field}")
            
            # 验证采样率
            if 'sampling_rate' in hub_config:
                sample_rate = hub_config['sampling_rate']
                if not isinstance(sample_rate, (int, float)):
                    errors.append("sampling_rate必须是数字类型")
                elif sample_rate <= 0:
                    errors.append("sampling_rate必须大于0")
        else:
            # 如果没有Hub结构，直接在顶级查找（向后兼容）
            for field in self.required_hardware_fields:
                if field not in hardware:
                    errors.append(f"缺少必需字段: {field}")
        
        return len(errors) == 0, errors
    
    def validate_recording(self, recording: Dict[str, Any]) -> tuple[bool, List[str]]:
        """验证录制配置"""
        errors = []
        
        # 检查是否有variables配置（实际结构）
        if 'variables' in recording:
            variables_config = recording['variables']
            
            # 检查必需字段
            for field in self.required_recording_fields:
                if field not in variables_config:
                    errors.append(f"缺少必需字段: {field}")
            
            # 验证通道数
            if 'channels' in variables_config:
                channels = variables_config['channels']
                if not isinstance(channels, int):
                    errors.append("channels必须是整数类型")
                elif channels <= 0:
                    errors.append("channels必须大于0")
            
            # 验证采样率
            if 'sample_rate' in variables_config:
                sample_rate = variables_config['sample_rate']
                if not isinstance(sample_rate, (int, float)):
                    errors.append("sample_rate必须是数字类型")
                elif sample_rate <= 0:
                    errors.append("sample_rate必须大于0")
        else:
            # 如果没有variables结构，直接在顶级查找（向后兼容）
            for field in self.required_recording_fields:
                if field not in recording:
                    errors.append(f"缺少必需字段: {field}")
        
        return len(errors) == 0, errors
    
    def validate_node_count_consistency(self, config: Dict[str, Any]) -> tuple[bool, List[str]]:
        """
        验证节点数量一致性
        
        检查layout中的docks数量与其他配置是否一致
        """
        errors = []
        
        try:
            # 从layout获取节点数量
            layout_node_count = 0
            if 'layout' in config and 'docks' in config['layout']:
                layout_node_count = len(config['layout']['docks'])
            
            # 从recording配置推断期望的节点数量
            expected_channels = 0
            if 'recordingdata' in config:
                recording_config = config['recordingdata']
                
                # 先查找variables结构中的channels
                if 'variables' in recording_config and 'channels' in recording_config['variables']:
                    expected_channels = recording_config['variables']['channels']
                # 向后兼容：直接在顶级查找
                elif 'channels' in recording_config:
                    expected_channels = recording_config['channels']
                
                # 根据通道数推断节点数量 (假设每个节点贡献固定数量的通道)
                # 对于6节点系统，通道数通常是864 (6*6*4*6)
                # 这里使用简化的验证逻辑
                if expected_channels == 864:
                    expected_nodes = 6
                elif expected_channels == 3456:  # 12*12*4*6
                    expected_nodes = 12
                else:
                    expected_nodes = layout_node_count  # 无法推断，使用layout值
                
                if layout_node_count != expected_nodes:
                    errors.append(f"节点数量不一致: layout={layout_node_count}, 期望={expected_nodes}")
        
        except Exception as e:
            errors.append(f"验证节点数量一致性时出错: {e}")
        
        return len(errors) == 0, errors


# 便捷函数
def validate_config(config: Dict[str, Any]) -> tuple[bool, List[str]]:
    """
    验证配置文件
    
    参数:
        config: 配置字典
        
    返回:
        (is_valid, error_messages)
    """
    validator = ConfigValidator()
    return validator.validate_device_profile(config)