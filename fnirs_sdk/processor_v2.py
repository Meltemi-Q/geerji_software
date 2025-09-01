"""
fNIRS SDK统一处理器 v2.0

集成配置系统和转换器的新版本处理器，支持动态节点检测
"""

import time
import threading
import queue
import json
import serial
import serial.tools.list_ports
import numpy as np
from typing import Dict, List, Optional, Callable, Tuple, Any
import logging
from dataclasses import asdict

from .data_types import (
    BrainOxygenData, DeviceInfo, ProcessingConfig,
    DeviceNotFoundError, DeviceConnectionError, DataProcessingError,
    NoDataAvailableError, StreamStartError,
    DEVICE_VID, DEVICE_PID, DEVICE_BAUD_RATE, DEVICE_TIMEOUT,
    DEFAULT_SAMPLE_RATE
)
from .algorithms import (
    process_nirs_data, intensity2optical_density, select_channels
)
from .config import ConfigLoader
from .converters import OnlineLumoConverter

# 配置日志
logger = logging.getLogger(__name__)


class FNIRSProcessor:
    """
    统一的fNIRS数据处理器 v2.0
    
    集成配置系统和转换器，支持动态节点检测和完整info字典生成
    """
    
    def __init__(self, config: Optional[ProcessingConfig] = None, device_profile: Optional[str] = None):
        """
        初始化处理器
        
        参数:
            config: 处理配置，如果为None则使用默认配置
            device_profile: 设备配置名称，如果为None则使用默认配置
        """
        self.config = config or ProcessingConfig()
        
        # 加载设备配置
        self._config_loader = ConfigLoader()
        self._device_profile = device_profile
        self._device_config = None
        self._info_dict = None
        
        # 数据转换器
        self._converter = OnlineLumoConverter()
        self._converter_initialized = False
        
        # 动态配置参数
        self._detected_node_count = 0
        self._dynamic_channel_count = 864  # 默认6节点
        
        # 设备连接状态
        self._device_connected = False
        self._data_stream_active = False
        self._serial_connection = None
        
        # 数据缓存
        self._data_buffer = None
        self._buffer_size = 10000  # 缓存最近10000帧数据
        self._current_frame_id = 0
        self._data_lock = threading.Lock()
        
        # 数据接收线程
        self._receiver_thread = None
        self._stop_event = threading.Event()
        
        # 处理后的数据缓存
        self._processed_data_cache = None
        self._last_processing_frame = -1
        
        logger.info("FNIRSProcessor v2.0 initialized")
    
    def _load_device_config(self, profile_name: Optional[str] = None) -> Dict[str, Any]:
        """
        加载设备配置
        
        参数:
            profile_name: 配置文件名称
            
        返回:
            设备配置字典
        """
        try:
            if profile_name:
                config = self._config_loader.load_device_profile(profile_name)
            else:
                config = self._config_loader.load_device_profile()
            
            logger.info(f"设备配置加载成功: {profile_name or 'default'}")
            return config
            
        except Exception as e:
            logger.error(f"设备配置加载失败: {e}")
            raise DeviceConnectionError(f"配置加载失败: {e}")
    
    def _initialize_converter(self, raw_info: Dict[str, Any]) -> None:
        """
        初始化数据转换器
        
        参数:
            raw_info: 原始设备信息
        """
        try:
            self._converter.init_from_raw_info(raw_info)
            self._converter_initialized = True
            
            # 获取完整的info字典
            self._info_dict, self._sorted_indices = self._converter.get_ndot()
            
            logger.info("数据转换器初始化成功")
            
        except Exception as e:
            logger.error(f"转换器初始化失败: {e}")
            raise DeviceConnectionError(f"转换器初始化失败: {e}")
    
    def _detect_node_count(self) -> int:
        """
        动态检测节点数量
        
        返回:
            检测到的节点数量
        """
        try:
            # 尝试扫描设备获取节点信息
            if self._serial_connection:
                scan_command = bytes([0x01, 0x00, 0x01, 0x00, 0x00, 0x04, 0x04])
                self._serial_connection.write(scan_command)
                
                # 等待响应（简化版本，实际应该解析响应数据）
                time.sleep(0.5)
                
                # 这里应该解析扫描响应来获取实际节点数
                # 现在使用配置文件中的节点数作为默认值
                if self._device_config and 'recordingdata' in self._device_config:
                    variables = self._device_config['recordingdata'].get('variables', {})
                    nodes = variables.get('nodes', [])
                    detected_count = len(nodes) if nodes else 6
                    
                    logger.info(f"检测到节点数: {detected_count}")
                    return detected_count
            
            # 默认返回6节点
            return 6
            
        except Exception as e:
            logger.warning(f"节点检测失败，使用默认值: {e}")
            return 6
    
    def _update_dynamic_config(self, node_count: int) -> None:
        """
        根据检测到的节点数更新动态配置
        
        参数:
            node_count: 检测到的节点数
        """
        self._detected_node_count = node_count
        
        # 根据节点数选择合适的配置
        if node_count <= 6:
            profile_name = "default_6node"
            self._dynamic_channel_count = 864
        elif node_count <= 12:
            profile_name = "12node"
            self._dynamic_channel_count = 3456
        else:
            profile_name = "default_6node"  # 超出范围使用默认
            self._dynamic_channel_count = 864
            logger.warning(f"节点数超出支持范围 ({node_count})，使用默认6节点配置")
        
        # 重新加载配置
        if profile_name != self._device_profile:
            logger.info(f"切换配置: {self._device_profile} -> {profile_name}")
            self._device_profile = profile_name
            self._device_config = self._load_device_config(profile_name)
            
            # 重新初始化转换器
            raw_info = {
                'layout': self._device_config['layout'],
                'hardware': self._device_config['hardware'],
                'recordingdata': self._device_config['recordingdata']
            }
            self._initialize_converter(raw_info)
        
        # 更新数据缓存大小
        if self._data_buffer is not None:
            old_buffer = self._data_buffer
            self._data_buffer = np.zeros((self._dynamic_channel_count, self._buffer_size))
            
            # 如果有旧数据，尝试迁移
            if old_buffer.shape[0] <= self._dynamic_channel_count:
                copy_size = min(old_buffer.shape[1], self._current_frame_id)
                if copy_size > 0:
                    self._data_buffer[:old_buffer.shape[0], :copy_size] = old_buffer[:, :copy_size]
        
        logger.info(f"动态配置更新完成: 节点数={node_count}, 通道数={self._dynamic_channel_count}")
    
    def _apply_config_based_channel_count(self) -> None:
        """
        根据当前配置应用通道数设置
        """
        if self._device_config and 'recordingdata' in self._device_config:
            variables = self._device_config['recordingdata'].get('variables', {})
            config_channels = variables.get('n_chans', None) or variables.get('channels', None)
            
            if config_channels:
                self._dynamic_channel_count = config_channels
                logger.info(f"从配置文件应用通道数: {self._dynamic_channel_count}")
            else:
                # 如果配置中没有明确的通道数，根据节点数计算
                nodes = variables.get('nodes', [])
                if nodes:
                    node_count = len(nodes)
                    if node_count <= 6:
                        self._dynamic_channel_count = 864
                    elif node_count <= 12:
                        self._dynamic_channel_count = 3456
                    else:
                        self._dynamic_channel_count = 864
                    
                    logger.info(f"根据节点数计算通道数: {node_count}节点 -> {self._dynamic_channel_count}通道")
    
    def connect_device(self, auto_detect_nodes: bool = True) -> bool:
        """
        连接fNIRS设备
        
        参数:
            auto_detect_nodes: 是否自动检测节点数
        
        返回:
            True: 连接成功
            False: 连接失败
            
        异常:
            DeviceNotFoundError: 设备未找到
            DeviceConnectionError: 设备连接失败
        """
        if self._device_connected:
            logger.warning("设备已连接")
            return True
        
        try:
            # 加载初始配置
            self._device_config = self._load_device_config(self._device_profile)
            
            # 查找设备
            port = self._find_device()
            if not port:
                raise DeviceNotFoundError("未找到fNIRS设备")
            
            # 建立串口连接
            self._serial_connection = serial.Serial(
                port=port,
                baudrate=DEVICE_BAUD_RATE,
                timeout=DEVICE_TIMEOUT
            )
            
            # 初始化转换器
            raw_info = {
                'layout': self._device_config['layout'],
                'hardware': self._device_config['hardware'],
                'recordingdata': self._device_config['recordingdata']
            }
            self._initialize_converter(raw_info)
            
            # 应用配置中的通道数设置
            self._apply_config_based_channel_count()
            
            # 动态检测节点数
            if auto_detect_nodes:
                detected_nodes = self._detect_node_count()
                self._update_dynamic_config(detected_nodes)
            else:
                # 使用配置文件中的默认值
                if not hasattr(self, '_dynamic_channel_count') or self._dynamic_channel_count == 864:
                    self._apply_config_based_channel_count()
            
            # 初始化数据缓存
            self._data_buffer = np.zeros((self._dynamic_channel_count, self._buffer_size))
            self._current_frame_id = 0
            
            self._device_connected = True
            logger.info(f"设备已连接到端口: {port}, 通道数: {self._dynamic_channel_count}")
            return True
            
        except serial.SerialException as e:
            raise DeviceConnectionError(f"串口连接失败: {e}")
        except Exception as e:
            raise DeviceConnectionError(f"设备连接失败: {e}")
    
    def disconnect_device(self) -> bool:
        """
        断开设备连接
        
        返回:
            True: 断开成功
            False: 断开失败
        """
        if not self._device_connected:
            return True
        
        try:
            # 停止数据流
            if self._data_stream_active:
                self.stop_data_stream()
            
            # 关闭串口连接
            if self._serial_connection:
                self._serial_connection.close()
                self._serial_connection = None
            
            # 重置状态
            self._device_connected = False
            self._converter_initialized = False
            self._info_dict = None
            
            logger.info("设备已断开连接")
            return True
            
        except Exception as e:
            logger.error(f"断开设备连接失败: {e}")
            return False
    
    def start_data_stream(self) -> bool:
        """
        启动实时数据采集
        
        返回:
            True: 启动成功
            False: 启动失败
            
        异常:
            StreamStartError: 数据流启动失败
        """
        if not self._device_connected:
            raise StreamStartError("设备未连接")
        
        if not self._converter_initialized:
            raise StreamStartError("转换器未初始化")
        
        if self._data_stream_active:
            logger.warning("数据流已启动")
            return True
        
        try:
            # 发送采集开始命令
            collect_command = bytes([0x01, 0x00, 0x03, 0x00, 0x00, 0x04, 0x04])
            self._serial_connection.write(collect_command)
            
            # 启动数据接收线程
            self._stop_event.clear()
            self._receiver_thread = threading.Thread(target=self._data_receiver_loop)
            self._receiver_thread.daemon = True
            self._receiver_thread.start()
            
            self._data_stream_active = True
            logger.info("数据流已启动")
            return True
            
        except Exception as e:
            raise StreamStartError(f"数据流启动失败: {e}")
    
    def stop_data_stream(self) -> bool:
        """
        停止数据采集
        
        返回:
            True: 停止成功
            False: 停止失败
        """
        if not self._data_stream_active:
            return True
        
        try:
            # 设置停止标志
            self._stop_event.set()
            
            # 发送停止命令
            if self._serial_connection:
                stop_command = bytes([0x01, 0x00, 0x04, 0x00, 0x00, 0x04, 0x04])
                self._serial_connection.write(stop_command)
            
            # 等待接收线程结束
            if self._receiver_thread:
                self._receiver_thread.join(timeout=2.0)
            
            self._data_stream_active = False
            logger.info("数据流已停止")
            return True
            
        except Exception as e:
            logger.error(f"停止数据流失败: {e}")
            return False
    
    def get_brain_oxygen_data(self) -> BrainOxygenData:
        """
        获取最新的血氧浓度数据
        
        返回:
            BrainOxygenData对象
            
        异常:
            NoDataAvailableError: 无可用数据
            DataProcessingError: 数据处理错误
        """
        if not self._device_connected:
            raise NoDataAvailableError("设备未连接")
        
        if self._current_frame_id == 0:
            raise NoDataAvailableError("暂无数据可用")
        
        try:
            with self._data_lock:
                # 获取最新的原始数据
                current_frame = self._current_frame_id
                if current_frame > self._buffer_size:
                    # 使用滑动窗口的最新数据
                    start_idx = max(0, current_frame - self._buffer_size)
                    end_idx = current_frame
                    raw_data = self._data_buffer[:, start_idx % self._buffer_size:end_idx % self._buffer_size]
                else:
                    raw_data = self._data_buffer[:, :current_frame]
                
                # 检查是否需要重新处理数据
                if (self._processed_data_cache is None or 
                    current_frame != self._last_processing_frame):
                    
                    # 执行完整的数据处理流程
                    if raw_data.shape[1] >= 10:  # 至少需要10个数据点
                        # 使用新的处理流程，传入完整的info字典
                        processed_result = process_nirs_data(raw_data, self._info_dict)
                        
                        # 获取最新时间点的数据
                        latest_hbo = processed_result['HbO'][:, -1]
                        latest_hbr = processed_result['HbR'][:, -1]
                        
                        # 计算衍生指标 (简化版本)
                        latest_hbt = latest_hbo + latest_hbr  # HbT = HbO + HbR
                        # 计算血氧饱和度 SO2 = HbO / (HbO + HbR)
                        hb_total = latest_hbo + latest_hbr
                        latest_so2 = np.where(hb_total != 0, latest_hbo / hb_total, 0)
                        
                        # 创建返回数据
                        brain_data = BrainOxygenData(
                            timestamp=time.time() * 1000,  # 转换为毫秒
                            frame_id=current_frame,
                            HbO=latest_hbo,
                            HbR=latest_hbr,
                            HbT=latest_hbt,
                            SO2=latest_so2,
                            device_status='connected'
                        )
                        
                        # 缓存处理结果
                        self._processed_data_cache = brain_data
                        self._last_processing_frame = current_frame
                        
                    else:
                        # 数据点不足，返回零值数据
                        channel_count = self._dynamic_channel_count // 2  # 每个波长一半通道
                        brain_data = BrainOxygenData(
                            timestamp=time.time() * 1000,
                            frame_id=current_frame,
                            HbO=np.zeros(channel_count),
                            HbR=np.zeros(channel_count),
                            HbT=np.zeros(channel_count),
                            SO2=np.zeros(channel_count),
                            device_status='connected'
                        )
                        self._processed_data_cache = brain_data
                
                return self._processed_data_cache
                
        except Exception as e:
            raise DataProcessingError(f"数据处理失败: {e}")
    
    def get_brain_oxygen_data_json(self) -> str:
        """
        获取JSON格式的血氧数据
        
        返回:
            JSON字符串
        """
        brain_data = self.get_brain_oxygen_data()
        
        # 转换为JSON格式
        data_dict = {
            'timestamp': brain_data.timestamp,
            'frame_id': brain_data.frame_id,
            'HbO': brain_data.HbO.tolist(),
            'HbR': brain_data.HbR.tolist(),
            'HbT': brain_data.HbT.tolist(),
            'SO2': brain_data.SO2.tolist(),
            'device_status': brain_data.device_status,
            'node_count': self._detected_node_count,
            'channel_count': self._dynamic_channel_count
        }
        
        return json.dumps(data_dict)
    
    def get_device_info(self) -> DeviceInfo:
        """
        获取设备信息
        
        返回:
            DeviceInfo对象
        """
        if not self._device_connected:
            raise DeviceConnectionError("设备未连接")
        
        # 从配置中获取实际信息
        hardware_info = self._device_config.get('hardware', {}).get('Hub', {})
        
        return DeviceInfo(
            device_id="fNIRS-001",
            firmware_version=hardware_info.get('firmware_version', '1.0.0'),
            hardware_version=hardware_info.get('hardware_version', '1.0.0'),
            serial_number="SN001",
            sample_rate=hardware_info.get('sampling_rate', DEFAULT_SAMPLE_RATE),
            channel_count=self._dynamic_channel_count,
            wavelengths=self.config.wavelengths,
            node_count=self._detected_node_count
        )
    
    def get_info_dict(self) -> Optional[Dict[str, Any]]:
        """
        获取完整的info字典
        
        返回:
            信息字典，如果未初始化返回None
        """
        return self._info_dict
    
    def get_current_config(self) -> Dict[str, Any]:
        """
        获取当前设备配置
        
        返回:
            设备配置字典
        """
        return {
            'device_profile': self._device_profile,
            'detected_node_count': self._detected_node_count,
            'dynamic_channel_count': self._dynamic_channel_count,
            'converter_initialized': self._converter_initialized,
            'device_config': self._device_config
        }
    
    def _find_device(self) -> Optional[str]:
        """查找fNIRS设备端口"""
        ports = list(serial.tools.list_ports.comports())
        
        for port in ports:
            try:
                if f"{port.vid:04X}" == DEVICE_VID and f"{port.pid:04X}" == DEVICE_PID:
                    return port.device
            except (AttributeError, TypeError):
                continue
        
        return None
    
    def _data_receiver_loop(self):
        """数据接收循环（在独立线程中运行）"""
        try:
            while not self._stop_event.is_set():
                # 简化的数据接收逻辑
                if self._serial_connection and self._serial_connection.in_waiting > 0:
                    try:
                        # 这里应该实现完整的数据包解析逻辑
                        # 现在使用简化版本进行演示
                        raw_bytes = self._serial_connection.read(self._serial_connection.in_waiting)
                        
                        if len(raw_bytes) > 0:
                            # 使用实际的数据处理逻辑
                            self._process_received_data(raw_bytes)
                            
                    except Exception as e:
                        logger.error(f"数据接收错误: {e}")
                
                time.sleep(0.01)  # 短暂休眠避免过度占用CPU
                
        except Exception as e:
            logger.error(f"数据接收循环错误: {e}")
    
    def _process_received_data(self, raw_bytes: bytes):
        """处理接收到的原始数据"""
        try:
            # 这里应该实现完整的数据包解析，基于客户端的process_data函数
            # 现在使用简化逻辑进行演示
            expected_size = self._dynamic_channel_count * 4  # 假设每个通道4字节
            
            if len(raw_bytes) >= expected_size:
                with self._data_lock:
                    # 解析数据（简化版本）
                    frame_data = np.frombuffer(raw_bytes[:expected_size], dtype=np.float32)
                    
                    if len(frame_data) == self._dynamic_channel_count:
                        # 存储到缓冲区
                        buffer_idx = self._current_frame_id % self._buffer_size
                        self._data_buffer[:, buffer_idx] = frame_data
                        self._current_frame_id += 1
                        
                        # 更新转换器的帧数
                        if self._converter_initialized:
                            self._converter.update_frames(self._current_frame_id)
                        
        except Exception as e:
            logger.error(f"数据处理错误: {e}")
    
    def __enter__(self):
        """上下文管理器入口"""
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """上下文管理器出口，确保资源清理"""
        if self._data_stream_active:
            self.stop_data_stream()
        if self._device_connected:
            self.disconnect_device()


# 便捷函数，用于快速测试和验证
def quick_test_connection(auto_detect: bool = True) -> bool:
    """
    快速测试设备连接
    
    参数:
        auto_detect: 是否自动检测节点数
    
    返回:
        True: 设备可用
        False: 设备不可用
    """
    try:
        with FNIRSProcessor() as processor:
            return processor.connect_device(auto_detect_nodes=auto_detect)
    except Exception:
        return False


def collect_test_data(duration_seconds: int = 10, auto_detect: bool = True) -> Optional[BrainOxygenData]:
    """
    采集测试数据
    
    参数:
        duration_seconds: 采集时长（秒）
        auto_detect: 是否自动检测节点数
    
    返回:
        最后一帧的血氧数据，如果失败返回None
    """
    try:
        with FNIRSProcessor() as processor:
            if not processor.connect_device(auto_detect_nodes=auto_detect):
                return None
            
            if not processor.start_data_stream():
                return None
            
            # 等待数据采集
            time.sleep(duration_seconds)
            
            return processor.get_brain_oxygen_data()
            
    except Exception as e:
        logger.error(f"测试数据采集失败: {e}")
        return None


def get_supported_configurations() -> List[str]:
    """
    获取支持的配置列表
    
    返回:
        配置名称列表
    """
    try:
        loader = ConfigLoader()
        return loader.list_available_profiles()
    except Exception:
        return ['default_6node', '12node']