"""
LUMO数据转换器

从客户端版本迁移的OnlineLumo类，适应SDK架构
提供实时数据处理和格式转换功能
"""

import numpy as np
import logging
from copy import deepcopy
from typing import Dict, Any, List, Optional, Tuple

from ..data_structures import Nirs, NDot
from ..processing.node_processor import NodeDataProcessor

logger = logging.getLogger(__name__)


class OnlineLumoConverter:
    """
    在线LUMO数据转换器
    
    从原始设备信息构建标准化的数据结构，用于实时数据处理
    """
    
    def __init__(self):
        """初始化转换器"""
        self.nirs = Nirs()  # 使用SDK标准的数据结构
        self.dot = NDot()   # 使用SDK标准的数据结构
        
        # 原始配置信息
        self.raw_info = None
        self.raw_data = []
        self.events = []
        
        # 基本参数
        self.chansList = None
        self.fs = None
        self.nFrames = 0
        self.nodes = None
        self.docks = None
        self.recordings_per_frame = None
        
        # 处理参数
        self.SDS_noise = 70
        self.max_buffer_size = 1000
        self.data_buffer = []
        
        # 构建状态标志
        self.nirs_built = False
        self.dot_built = False
        
        # 动态节点处理器
        self.node_processor = NodeDataProcessor(max_node_num=6)
        self.max_node_num = 6  # 默认最大节点数
        self.current_node_mapping = None
        self.current_frame_count = 0
        
        logger.debug("OnlineLumoConverter 初始化完成")
    
    def init_from_raw_info(self, raw_info: Dict[str, Any]) -> None:
        """
        从原始设备信息初始化转换器
        
        参数:
            raw_info: 包含layout、hardware、recordingdata的原始信息字典
        """
        try:
            self.raw_info = raw_info
            logger.debug("开始从原始信息初始化转换器")
            
            # 提取录制数据配置
            if 'recordingdata' in raw_info and 'variables' in raw_info['recordingdata']:
                variables = raw_info['recordingdata']['variables']
                self.fs = variables.get('framerate')
                self.nodes = variables.get('nodes')
                self.chansList = variables.get('chans_list')
                
                logger.debug(f"录制配置提取成功: fs={self.fs}, nodes={self.nodes}, channels={len(self.chansList) if self.chansList else 0}")
            else:
                logger.warning("原始信息中缺少recordingdata/variables配置")
            
            # 提取布局信息
            if 'layout' in raw_info:
                self.docks = raw_info['layout'].get('docks')
                logger.debug(f"布局信息提取成功: docks={len(self.docks) if self.docks else 0}")
            else:
                logger.warning("原始信息中缺少layout配置")
            
            logger.info("转换器初始化完成")
            
        except Exception as e:
            logger.error(f"初始化转换器失败: {e}")
            raise
    
    def build_nirs(self) -> np.ndarray:
        """
        构建NIRS数据结构
        
        返回:
            sorted_indices: 通道排序索引
        """
        try:
            logger.debug("开始构建NIRS数据结构")
            
            self.calc_nirs_t()
            sorted_indices = self.calc_nirs_SD()
            self.calc_nirs_SD3d()
            self.calc_nirs_d()
            self.calc_nirs_aux()
            self.calc_nirs_s_and_CondNames()
            
            self.nirs_built = True
            logger.info("NIRS数据结构构建完成")
            
            return sorted_indices
            
        except Exception as e:
            logger.error(f"构建NIRS数据结构失败: {e}")
            raise
    
    def build_dot(self) -> None:
        """构建DOT数据结构"""
        try:
            logger.debug("开始构建DOT数据结构")
            
            self.calc_dot_io()
            self.calc_dot_system()
            self.calc_dot_paradigm()
            self.calc_dot_optodes()
            self.calc_dot_pairs()
            self.calc_dot_tissue()
            
            self.dot_built = True
            logger.info("DOT数据结构构建完成")
            
        except Exception as e:
            logger.error(f"构建DOT数据结构失败: {e}")
            raise
    
    def calc_nirs_t(self) -> None:
        """计算NIRS时间轴"""
        if self.fs is None:
            raise ValueError("采样率(fs)未设置，请先调用init_from_raw_info")
        
        self.nirs.t = np.arange(self.nFrames) / self.fs
        logger.debug(f"时间轴计算完成: {len(self.nirs.t)} 个时间点")
    
    def calc_nirs_SD(self) -> np.ndarray:
        """
        计算NIRS源-检测器配置
        
        返回:
            sorted_indices: 通道排序索引
        """
        try:
            SD = self.nirs.SD
            
            # 设置基本参数
            SD.nSrcs = self.raw_info['recordingdata']['variables']['n_srcs']
            SD.nDets = self.raw_info['recordingdata']['variables']['n_dets'] 
            SD.Lambda = np.array(self.raw_info['recordingdata']['variables']['wavelength'])
            SD.SpatialUnit = 'mm'
            
            logger.debug(f"SD基本参数: nSrcs={SD.nSrcs}, nDets={SD.nDets}, Lambda={SD.Lambda}")
            
            # 获取激活测量列表
            MLAtmp = self.raw_info['recordingdata']['variables']['chans_list_act']
            
            # 初始化位置和功率数组
            SD.SrcPos = np.zeros((SD.nSrcs, 3))
            SD.DetPos = np.zeros((SD.nDets, 3))
            SD.SrcPowers = np.zeros((SD.nSrcs * 2, 2))
            SD.SrcPowers[:SD.nSrcs, 1] = 1
            SD.SrcPowers[SD.nSrcs:, 1] = 2
            
            # 根据节点配置设置位置
            for n, nid in enumerate(self.nodes):
                nid = nid - 1  # 转换为0基索引
                
                # 设置检测器位置
                for det in range(4):
                    SD.DetPos[det + n * 4, :2] = [
                        self.docks[nid]["optodes"][det]["coordinates_2d"]["x"],
                        self.docks[nid]["optodes"][det]["coordinates_2d"]["y"]
                    ]
                
                # 设置光源位置和功率
                for src in range(3):
                    SD.SrcPos[src + n * 3, :2] = [
                        self.docks[nid]["optodes"][src + 4]["coordinates_2d"]["x"],
                        self.docks[nid]["optodes"][src + 4]["coordinates_2d"]["y"]
                    ]
                    
                    # 设置光源功率
                    SD.SrcPowers[src + n * 3, 0] = self.raw_info['hardware']["Hub"]["Group"]["Node"][n]["Source"][src * 2]["Source_power"]
                    SD.SrcPowers[src + n * 3 + SD.nSrcs, 1] = self.raw_info['hardware']["Hub"]["Group"]["Node"][n]["Source"][src * 2 + 1]["Source_power"]
            
            # 处理通道列表
            self.chansList = np.array(self.chansList)
            
            # 创建测量列表
            SD.MeasList = np.ones((self.chansList.shape[0], 4), dtype=int)
            SD.MeasList[:, :2] = self.chansList[:, :2]
            SD.MeasList[:, 3] = self.chansList[:, 2]
            
            # 排序测量列表
            sort_keys = (SD.MeasList[:, 3], SD.MeasList[:, 0], SD.MeasList[:, 1])
            sorted_indices = np.lexsort(sort_keys[::-1])
            SD.MeasList = SD.MeasList[sorted_indices]
            SD.MeasListAct = np.ones((SD.MeasList.shape[0], 1))
            
            # 处理激活状态
            MLAtmp = np.array(MLAtmp)[sorted_indices]
            SD.MeasListActSat = MLAtmp
            
            # 设置数据
            self.nirs.d = np.array(self.raw_data).T
            
            logger.debug(f"SD配置完成: MeasList shape={SD.MeasList.shape}")
            
            return sorted_indices
            
        except Exception as e:
            logger.error(f"计算NIRS SD配置失败: {e}")
            raise
    
    def calc_nirs_SD3d(self) -> None:
        """计算NIRS 3D源-检测器配置"""
        try:
            self.nirs.SD3D = deepcopy(self.nirs.SD)
            SD3d = self.nirs.SD3D
            
            # 设置3D位置
            for n, nid in enumerate(self.nodes):
                nid = nid - 1  # 转换为0基索引
                
                # 设置检测器3D位置
                for det in range(4):
                    SD3d.DetPos[det + n * 4] = [
                        self.docks[nid]["optodes"][det]["coordinates_3d"]["x"],
                        self.docks[nid]["optodes"][det]["coordinates_3d"]["y"],
                        self.docks[nid]["optodes"][det]["coordinates_3d"]["z"]
                    ]
                
                # 设置光源3D位置
                for src in range(3):
                    SD3d.SrcPos[src + n * 3] = [
                        self.docks[nid]["optodes"][src + 4]["coordinates_3d"]["x"],
                        self.docks[nid]["optodes"][src + 4]["coordinates_3d"]["y"],
                        self.docks[nid]["optodes"][src + 4]["coordinates_3d"]["z"]
                    ]
            
            # 处理地标信息
            if "Landmarks" in self.raw_info['layout']:
                SD3d.Landmarks = np.array([
                    [lm["x"], lm["y"], lm["z"]] 
                    for lm in self.raw_info['layout']["Landmarks"]
                ])
            elif "landmarks" in self.raw_info['layout']:
                SD3d.Landmarks = np.array([
                    [lm["x"], lm["y"], lm["z"]] 
                    for lm in self.raw_info['layout']["landmarks"]
                ])
            
            logger.debug("3D SD配置完成")
            
        except Exception as e:
            logger.error(f"计算3D SD配置失败: {e}")
            raise
    
    def calc_nirs_d(self) -> None:
        """计算NIRS数据"""
        try:
            self.nirs.d = np.array(self.raw_data).T
            
            # 处理零值
            mean_d = np.mean(self.nirs.d, axis=0)
            dist_3d = self.get_SD_dists(self.nirs.SD3D)
            n_zeros = np.sum(self.nirs.d == 0)
            
            if n_zeros > 0:
                if max(dist_3d) > self.SDS_noise:
                    above_idxs = np.where(dist_3d > self.SDS_noise)[0]
                    self.nirs.d[self.nirs.d == 0] = np.mean(mean_d[above_idxs])
                else:
                    self.nirs.d[self.nirs.d == 0] = 1e-6
                    
                logger.debug(f"处理了 {n_zeros} 个零值")
            
        except Exception as e:
            logger.error(f"计算NIRS数据失败: {e}")
            raise
    
    def calc_nirs_aux(self) -> None:
        """计算NIRS辅助数据"""
        self.nirs.aux = np.zeros((self.nFrames, 8))
        logger.debug("辅助数据初始化完成")
    
    def calc_nirs_s_and_CondNames(self) -> None:
        """计算NIRS刺激信号和条件名称"""
        try:
            if not self.events:
                self.nirs.s = np.zeros((len(self.nirs.t), 1))
                self.nirs.CondNames = [""]
                logger.debug("无事件，创建空的刺激信号")
            else:
                timeStamp = [event["Timestamp"] * 1e-3 for event in self.events]
                self.nirs.CondNames = [event["name"] for event in self.events]
                self.nirs.s = np.zeros((len(self.nirs.t), len(self.nirs.CondNames)))
                
                for i, timeStampTmp in enumerate(timeStamp):
                    indTmp = np.argmin(np.abs(self.nirs.t - timeStampTmp))
                    self.nirs.s[indTmp, i] = 1
                
                logger.debug(f"处理了 {len(self.events)} 个事件")
                
        except Exception as e:
            logger.error(f"计算刺激信号失败: {e}")
            raise
    
    def calc_dot_io(self) -> None:
        """计算DOT IO参数"""
        self.dot.io = NDot.Io()
        self.dot.io.Nd = self.nirs.SD.nDets
        self.dot.io.Ns = self.nirs.SD.nSrcs
        self.dot.io.Nwl = len(self.nirs.SD.Lambda)
        self.dot.io.nframe = len(self.nirs.t)
        
        logger.debug(f"DOT IO参数: Nd={self.dot.io.Nd}, Ns={self.dot.io.Ns}, Nwl={self.dot.io.Nwl}")
    
    def calc_dot_system(self) -> None:
        """计算DOT系统参数"""
        self.dot.system = NDot.System()
        self.dot.system.framerate = self.fs
        self.dot.system.startTime = 0
        
        logger.debug(f"DOT系统参数: framerate={self.dot.system.framerate}")
    
    def calc_dot_paradigm(self) -> None:
        """计算DOT范式参数"""
        try:
            self.dot.paradigm = NDot.Paradigm()
            num_stim = self.nirs.s.shape[1]
            num_synchs = np.sum(self.nirs.s == 1)
            
            if num_synchs != 0:
                synchs = [np.where(self.nirs.s[:, i] == 1)[0] + 1 for i in range(num_stim)]
                synchTot = np.unique(np.sort(np.concatenate(synchs, axis=0)))
                
                self.dot.paradigm.synchpts = synchTot
                self.dot.paradigm.synchtype = np.zeros_like(synchTot)
                
                for k in range(num_stim):
                    field_name = f"Pulse_{k + 1}"
                    setattr(self.dot.paradigm, field_name, np.where(synchTot == synchs[k])[0][0] + 1)
                    self.dot.paradigm.synchtype[getattr(self.dot.paradigm, field_name) - 1] = k + 1
                    
                self.dot.paradigm.synchtimes = synchTot / self.dot.system.framerate
                
                logger.debug(f"DOT范式参数: {num_synchs} 个同步点")
            else:
                logger.debug("无同步点，跳过范式参数计算")
                
        except Exception as e:
            logger.error(f"计算DOT范式参数失败: {e}")
            raise
    
    def calc_dot_optodes(self) -> None:
        """计算DOT光极参数"""
        try:
            self.dot.optodes = NDot.Optodes()
            spos3 = self.nirs.SD3D.SrcPos
            dpos3 = self.nirs.SD3D.DetPos
            spos2 = self.nirs.SD.SrcPos
            dpos2 = self.nirs.SD.DetPos
            
            # 计算源-检测器分离距离
            SD_sep = [np.linalg.norm(spos3[s - 1] - dpos3[d - 1]) 
                     for s, d in self.nirs.SD.MeasList[:, :2]]
            SD_sep = np.array(SD_sep)
            avg_SD_sep = np.mean(SD_sep)
            min_SD_sep = np.min(SD_sep)
            
            # 确定缩放因子
            if (avg_SD_sep >= 10 and avg_SD_sep < 100) or (min_SD_sep >= 1 and min_SD_sep < 100):
                mult = 1
            elif (avg_SD_sep >= 1 and avg_SD_sep < 10) or (min_SD_sep > 0.1 and min_SD_sep < 10):
                mult = 10
            elif (avg_SD_sep >= 0.1 and avg_SD_sep < 1) or (min_SD_sep >= 0.01 and min_SD_sep < 1):
                mult = 100
            elif (avg_SD_sep >= 0.01 and avg_SD_sep < 0.1) or (min_SD_sep >= 0.001 and min_SD_sep < 0.1):
                mult = 1000
            else:
                mult = 1
                
            # 应用缩放
            self.dot.optodes.spos3 = spos3 * mult
            self.dot.optodes.dpos3 = dpos3 * mult
            self.dot.optodes.spos2 = spos2 * mult
            self.dot.optodes.dpos2 = dpos2 * mult
            
            self.dot.optodes.plot3orientation = {
                "i": "R2L",
                "j": "P2A", 
                "k": "D2V",
            }
            
            logger.debug(f"DOT光极参数计算完成，缩放因子: {mult}")
            
        except Exception as e:
            logger.error(f"计算DOT光极参数失败: {e}")
            raise
    
    def calc_dot_pairs(self) -> None:
        """计算DOT对参数"""
        try:
            self.dot.pairs = NDot.Pairs()
            r3darray = []
            r2darray = []
            lamdaArray = []
            
            # 计算距离和波长数组
            for i in range(len(self.nirs.SD.MeasList)):
                # 3D距离
                r3darray.append(
                    np.linalg.norm(
                        self.dot.optodes.spos3[self.nirs.SD.MeasList[i, 0] - 1, :] - 
                        self.dot.optodes.dpos3[self.nirs.SD.MeasList[i, 1] - 1, :]
                    )
                )
                
                # 2D距离
                r2darray.append(
                    np.linalg.norm(
                        self.dot.optodes.spos2[self.nirs.SD.MeasList[i, 0] - 1, :] - 
                        self.dot.optodes.dpos2[self.nirs.SD.MeasList[i, 1] - 1, :]
                    )
                )
                
                # 波长
                if self.nirs.SD.MeasList[i, 3] == 1:
                    lamdaArray.append(self.nirs.SD.Lambda[0])
                else:
                    lamdaArray.append(self.nirs.SD.Lambda[1])
            
            # 设置对参数
            self.dot.pairs.Src = self.nirs.SD.MeasList[:, 0]
            self.dot.pairs.Det = self.nirs.SD.MeasList[:, 1]
            self.dot.pairs.WL = self.nirs.SD.MeasList[:, 3]
            self.dot.pairs.Mod = ["CW" for _ in range(len(self.nirs.SD.MeasList))]
            self.dot.pairs.r3d = np.array(r3darray)
            self.dot.pairs.lamda = np.array(lamdaArray)
            self.dot.pairs.r2d = np.array(r2darray)
            self.dot.pairs.NN = self.calc_dot_nn()
            
            logger.debug(f"DOT对参数计算完成: {len(self.dot.pairs.r3d)} 个对")
            
        except Exception as e:
            logger.error(f"计算DOT对参数失败: {e}")
            raise
    
    def calc_dot_tissue(self) -> None:
        """计算DOT组织参数"""
        self.dot.tissue = NDot.Tissue()
        self.dot.tissue.affine = np.eye(4)
        self.dot.tissue.affine_target = "MNI"
        
        logger.debug("DOT组织参数设置完成")
    
    def calc_dot_nn(self, dr: int = 10) -> np.ndarray:
        """
        计算最近邻分组
        
        参数:
            dr: 距离分组间隔
            
        返回:
            NN: 最近邻分组数组
        """
        try:
            Nm = len(self.dot.pairs.r3d)
            NN = np.zeros(Nm)
            
            RadMaxR = np.ceil(np.max(self.dot.pairs.r3d))
            
            d = c = 0
            
            while RadMaxR > d:
                if (d == 0 and dr > 9):
                    nnkeep = (self.dot.pairs.r3d >= d) & (self.dot.pairs.r3d < (d + 2 * dr))
                    d += dr
                else:
                    nnkeep = (self.dot.pairs.r3d >= d) & (self.dot.pairs.r3d < (d + dr))
                    
                if nnkeep.any():
                    c += 1
                    NN[nnkeep] = c
                    if c > RadMaxR: 
                        break
                        
                d += dr
            
            logger.debug(f"最近邻分组计算完成: {c} 个分组")
            return NN
            
        except Exception as e:
            logger.error(f"计算最近邻分组失败: {e}")
            raise
    
    def get_SD_dists(self, sd) -> np.ndarray:
        """
        计算源-检测器距离
        
        参数:
            sd: SD配置对象
            
        返回:
            distances: 距离数组
        """
        try:
            indices = np.where(sd.MeasList[:, 3] == 1)[0]
            dists = [
                np.sqrt(np.sum((sd.SrcPos[s - 1] - sd.DetPos[d - 1]) ** 2))
                for s, d in sd.MeasList[indices, :2]
            ]
            return np.array(dists)
            
        except Exception as e:
            logger.error(f"计算SD距离失败: {e}")
            raise
    
    def get_ndot(self) -> Tuple[Dict[str, Any], np.ndarray]:
        """
        获取NDot格式的info和排序索引
        
        返回:
            (info_dict, sorted_indices): 信息字典和排序索引
        """
        try:
            if not self.dot_built:
                logger.debug("DOT未构建，开始构建")
                
            sorted_indices = self.build_nirs()
            self.build_dot()
            
            info = self.dot.to_dict()
            logger.info("NDot数据获取成功")
            
            return info, sorted_indices
            
        except Exception as e:
            logger.error(f"获取NDot数据失败: {e}")
            raise
    
    def process_data_frame(self, data_bytes: bytes, n_node: int, frame_count: int) -> Tuple[np.ndarray, Dict[str, Any]]:
        """
        处理单帧数据并更新info
        
        参数:
            data_bytes: 原始字节数据
            n_node: 数据包中的节点数
            frame_count: 当前帧数
            
        返回:
            (processed_data, updated_info): 处理后的数据和更新的info
        """
        try:
            # 使用NodeDataProcessor处理数据
            processed_data, node_list, mapping_info = self.node_processor.process_data_packet(data_bytes, n_node)
            
            # 更新当前节点映射
            self.current_node_mapping = mapping_info
            self.current_frame_count = frame_count
            
            # 更新帧数
            self.update_frames(frame_count)
            
            # 生成或更新info字典
            if not hasattr(self, 'info') or self.info is None:
                self.info = {}
            
            # 使用NodeDataProcessor更新info
            self.info = self.node_processor.update_info_dict(self.info, mapping_info, frame_count)
            
            # 添加系统信息
            if 'system' not in self.info:
                self.info['system'] = {}
            self.info['system']['framerate'] = self.fs if self.fs else 8
            self.info['system']['startTime'] = 0
            
            logger.debug(f"数据帧处理完成: frame={frame_count}, nodes={node_list}")
            return processed_data, self.info
            
        except Exception as e:
            logger.error(f"处理数据帧失败: {e}")
            raise
    
    def get_active_channel_indices(self) -> List[int]:
        """
        获取当前活动通道的索引
        
        返回:
            活动通道索引列表
        """
        if self.current_node_mapping and 'active_nodes' in self.current_node_mapping:
            return self.node_processor.get_node_channel_indices(
                self.current_node_mapping['active_nodes']
            )
        return []
    
    def get_node_mapping_info(self) -> Dict[str, Any]:
        """
        获取当前节点映射信息
        
        返回:
            节点映射信息字典
        """
        return self.current_node_mapping if self.current_node_mapping else {}
    
    def update_frames(self, new_frame_count: int) -> None:
        """
        更新帧数
        
        参数:
            new_frame_count: 新的帧数
        """
        if new_frame_count != self.nFrames:
            self.nFrames = new_frame_count
            # 重新计算时间轴
            if self.fs is not None:
                self.nirs.t = np.arange(self.nFrames) / self.fs
                logger.debug(f"帧数更新为: {self.nFrames}")
    
    def add_event(self, event: Dict[str, Any]) -> None:
        """
        添加事件
        
        参数:
            event: 事件字典，包含Timestamp和name字段
        """
        self.events.append(event)
        logger.debug(f"添加事件: {event.get('name', 'unknown')}")
    
    def clear_data(self) -> None:
        """清空数据缓存"""
        self.raw_data = []
        self.events = []
        self.data_buffer = []
        self.nFrames = 0
        self.nirs_built = False
        self.dot_built = False
        self.current_node_mapping = None
        self.current_frame_count = 0
        
        logger.debug("数据缓存已清空")