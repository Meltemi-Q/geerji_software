"""
动态节点检测和数据处理器

从客户端版本迁移的动态节点检测逻辑，
支持1-6个节点的动态检测和数据映射
"""

import numpy as np
import logging
from typing import Dict, List, Tuple, Optional, Any

logger = logging.getLogger(__name__)


class NodeDataProcessor:
    """
    动态节点数据处理器
    
    处理fNIRS设备的原始数据包，支持动态节点检测和通道映射
    """
    
    # 系统常量
    N_DET = 4              # 每节点检测器数
    N_SOURCE = 3           # 每节点光源数  
    N_WAVELENGTH = 2       # 波长数
    BYTES_PER_VALUE = 4    # 每个数值占用字节数(3+1)
    WAVELENGTHS = [735, 850]  # 支持的波长
    
    def __init__(self, max_node_num: int = 6):
        """
        初始化处理器
        
        参数:
            max_node_num: 系统最大支持节点数，默认6
        """
        self.max_node_num = max_node_num
        self.total_channels = (self.N_SOURCE * self.N_WAVELENGTH * 
                             max_node_num * max_node_num * self.N_DET)
        
        # 缓存通道映射信息以提高性能
        self._all_channels_cache = None
        self._build_channel_cache()
        
        logger.debug(f"NodeDataProcessor初始化: max_nodes={max_node_num}, total_channels={self.total_channels}")
    
    def _build_channel_cache(self) -> None:
        """构建完整系统的通道映射缓存"""
        self._all_channels_cache = []
        for w in self.WAVELENGTHS:
            for s in range(self.N_SOURCE * self.max_node_num):
                for d in range(self.N_DET * self.max_node_num):
                    self._all_channels_cache.append([s + 1, d + 1, w])
        
        logger.debug(f"通道缓存构建完成: {len(self._all_channels_cache)} 个通道")
    
    def extract_node_source(self, byte_data: bytes, offset: int) -> Tuple[int, int]:
        """
        从字节数据中提取节点号和光源号
        
        参数:
            byte_data: 原始字节数据
            offset: 偏移量
            
        返回:
            (node, source): 节点号和光源号
        """
        try:
            hex_value = hex(byte_data[offset])[2:].zfill(2)
            node = int(hex_value[0], 16)
            source = int(hex_value[1], 16)
            return node, source
        except (IndexError, ValueError) as e:
            logger.warning(f"提取节点信息失败: offset={offset}, error={e}")
            return 0, 0
    
    def bytes_to_float(self, byte_data: bytes, start_idx: int) -> float:
        """
        将3字节数据转换为浮点数
        
        参数:
            byte_data: 字节数据
            start_idx: 起始索引
            
        返回:
            转换后的浮点数
        """
        try:
            value = ((byte_data[start_idx + 2] << 16) + 
                    (byte_data[start_idx + 1] << 8) + 
                    byte_data[start_idx])
            return value / 8388608.0
        except IndexError:
            logger.warning(f"字节转换失败: start_idx={start_idx}")
            return 0.0
    
    def detect_active_nodes(self, data: bytes, n_node: int) -> List[int]:
        """
        检测数据包中的活动节点
        
        参数:
            data: 原始字节数据
            n_node: 数据包中声明的节点数
            
        返回:
            活动节点列表
        """
        try:
            valid_nodes_sources = []
            node_list = []
            
            node_data_bytes = n_node * self.N_DET * self.BYTES_PER_VALUE
            n = 0
            
            while (3 + node_data_bytes * n) < len(data):
                node, source = self.extract_node_source(data, 3 + node_data_bytes * n)
                
                # 跳过无效节点号
                if node == 0 or node > 12:
                    n += 1
                    continue
                
                valid_nodes_sources.append((node, source))
                if node not in node_list:
                    node_list.append(node)
                n += 1
            
            logger.debug(f"检测到活动节点: {node_list}")
            return sorted(node_list)
            
        except Exception as e:
            logger.error(f"节点检测失败: {e}")
            return []
    
    def build_channel_mapping(self, node_list: List[int]) -> Dict[str, Any]:
        """
        构建节点的通道映射信息
        
        参数:
            node_list: 活动节点列表
            
        返回:
            包含光源、检测器和通道信息的字典
        """
        try:
            node_array = np.array(node_list)
            
            # 计算对应的光源和检测器ID
            source_array = sorted(np.concatenate((
                node_array * 3 - 2, 
                node_array * 3 - 1, 
                node_array * 3
            )))
            
            det_array = sorted(np.concatenate((
                node_array * 4 - 3, 
                node_array * 4 - 2, 
                node_array * 4 - 1, 
                node_array * 4
            )))
            
            # 创建实际数据的通道信息列表
            channel_info_list = []
            for w in self.WAVELENGTHS:
                for s in source_array:
                    for d in det_array:
                        channel_info_list.append([s, d, w])
            
            mapping_info = {
                'source_ids': source_array.tolist(),
                'detector_ids': det_array.tolist(),
                'channel_info': channel_info_list,
                'active_nodes': node_list,
                'n_sources': len(source_array),
                'n_detectors': len(det_array),
                'n_channels': len(channel_info_list)
            }
            
            logger.debug(f"通道映射构建完成: {mapping_info['n_channels']} 个通道")
            return mapping_info
            
        except Exception as e:
            logger.error(f"构建通道映射失败: {e}")
            return {}
    
    def get_node_channel_indices(self, node_list: List[int]) -> List[int]:
        """
        获取指定节点的通道索引(兼容客户端版本的方法)
        
        参数:
            node_list: 节点列表
            
        返回:
            对应的通道索引列表
        """
        try:
            node_array = np.array(node_list)
            source_array = sorted(np.concatenate((
                node_array * 3 - 2, 
                node_array * 3 - 1, 
                node_array * 3
            )))
            det_array = sorted(np.concatenate((
                node_array * 4 - 3, 
                node_array * 4 - 2, 
                node_array * 4 - 1, 
                node_array * 4
            )))
            
            channel_indices = []
            idx = 0
            
            # 按照LUMO格式：波长->光源->检测器
            for w in self.WAVELENGTHS:
                for s in range(1, self.N_SOURCE * self.max_node_num + 1):
                    for d in range(1, self.N_DET * self.max_node_num + 1):
                        if s in source_array and d in det_array:
                            channel_indices.append(idx)
                        idx += 1
            
            logger.debug(f"节点{node_list}的通道索引: {len(channel_indices)} 个")
            return channel_indices
            
        except Exception as e:
            logger.error(f"获取节点通道索引失败: {e}")
            return []
    
    def process_data_packet(self, data: bytes, n_node: int) -> Tuple[np.ndarray, List[int], Dict[str, Any]]:
        """
        处理完整的数据包
        
        参数:
            data: 原始字节数据
            n_node: 数据包中声明的节点数
            
        返回:
            (result_data, node_list, mapping_info): 处理后的数据、节点列表和映射信息
        """
        try:
            logger.debug(f"开始处理数据包: size={len(data)}, n_node={n_node}")
            
            # 1. 检测活动节点
            node_list = self.detect_active_nodes(data, n_node)
            if not node_list:
                logger.warning("未检测到有效节点")
                return np.zeros(self.total_channels), [], {}
            
            # 2. 构建通道映射
            mapping_info = self.build_channel_mapping(node_list)
            
            # 3. 数据转换
            converted_data = [
                self.bytes_to_float(data, i) 
                for i in range(0, len(data), self.BYTES_PER_VALUE)
            ]
            
            # 4. 创建结果数组
            result = np.zeros(self.total_channels)
            
            # 5. 构建查找字典以提高映射性能
            truth_chans_dict = {}
            data_idx = 0
            
            for w in self.WAVELENGTHS:
                for s in mapping_info['source_ids']:
                    for d in mapping_info['detector_ids']:
                        truth_chans_dict[(s, d, w)] = data_idx
                        data_idx += 1
            
            # 6. 映射数据到完整数组
            mapped_count = 0
            for ch_idx, channel in enumerate(self._all_channels_cache):
                chan_tuple = (channel[0], channel[1], channel[2])
                if chan_tuple in truth_chans_dict:
                    truth_idx = truth_chans_dict[chan_tuple]
                    if truth_idx < len(converted_data):
                        result[ch_idx] = converted_data[truth_idx]
                        mapped_count += 1
            
            logger.debug(f"数据处理完成: 映射了 {mapped_count} 个通道")
            return result, node_list, mapping_info
            
        except Exception as e:
            logger.error(f"数据包处理失败: {e}")
            raise RuntimeError(f"数据处理错误: {str(e)}")
    
    def update_info_dict(self, base_info: Dict[str, Any], mapping_info: Dict[str, Any], 
                        frame_count: int) -> Dict[str, Any]:
        """
        更新info字典以包含动态节点信息
        
        参数:
            base_info: 基础info字典
            mapping_info: 通道映射信息
            frame_count: 当前帧数
            
        返回:
            更新后的info字典
        """
        try:
            info = base_info.copy() if base_info else {}
            
            # 更新基本信息
            if 'io' not in info:
                info['io'] = {}
            info['io']['nframe'] = frame_count
            
            # 更新节点信息
            if 'nodes' not in info:
                info['nodes'] = {}
            info['nodes']['active_nodes'] = mapping_info.get('active_nodes', [])
            info['nodes']['n_active'] = len(mapping_info.get('active_nodes', []))
            info['nodes']['max_supported'] = self.max_node_num
            
            # 更新通道信息
            if 'channels' not in info:
                info['channels'] = {}
            info['channels']['total_channels'] = self.total_channels
            info['channels']['active_channels'] = mapping_info.get('n_channels', 0)
            info['channels']['source_ids'] = mapping_info.get('source_ids', [])
            info['channels']['detector_ids'] = mapping_info.get('detector_ids', [])
            
            # 更新配对信息(兼容DOT格式)
            if 'pairs' not in info:
                info['pairs'] = {}
            
            # 为所有可能的配对创建基础数组
            total_pairs = len(self._all_channels_cache)
            info['pairs']['Src'] = [ch[0] for ch in self._all_channels_cache]
            info['pairs']['Det'] = [ch[1] for ch in self._all_channels_cache]
            info['pairs']['WL'] = [ch[2] for ch in self._all_channels_cache]
            info['pairs']['lamda'] = [ch[2] for ch in self._all_channels_cache]
            
            # 简化的距离计算(可以后续优化)
            info['pairs']['r2d'] = [30.0] * total_pairs  # 默认距离
            info['pairs']['r3d'] = [30.0] * total_pairs  # 默认距离
            
            logger.debug(f"Info字典更新完成: {len(info)} 个主要字段")
            return info
            
        except Exception as e:
            logger.error(f"更新info字典失败: {e}")
            return base_info if base_info else {}


def process_data(data: bytes, n_node: int, max_node_num: int = 6) -> Tuple[np.ndarray, np.ndarray, List[int]]:
    """
    兼容客户端版本的数据处理函数接口
    
    参数:
        data: 原始字节数据
        n_node: 节点数
        max_node_num: 最大节点数
        
    返回:
        (result, result, node_list): 处理结果(为兼容性返回两次)
    """
    processor = NodeDataProcessor(max_node_num)
    result, node_list, _ = processor.process_data_packet(data, n_node)
    return result, result, node_list