"""
NIRS数据结构

基于客户端版本的Nirs类，提供标准化的NIRS数据结构
"""

from typing import Optional, Dict, Any
import numpy as np


class Nirs:
    """
    NIRS数据结构类
    
    存储近红外光谱数据的标准格式，包括源-检测器信息、数据和元数据
    """
    
    def __init__(
        self,
        aux: Optional[np.ndarray] = None,
        d: Optional[np.ndarray] = None,
        s: Optional[np.ndarray] = None,
        t: Optional[np.ndarray] = None,
        CondNames: Optional[list] = None,
        **kwargs
    ):
        """
        初始化NIRS数据结构
        
        参数:
            aux: 辅助数据数组
            d: 强度数据数组
            s: 刺激标记数组
            t: 时间数组
            CondNames: 条件名称列表
            **kwargs: 其他属性
        """
        # 创建源-检测器配置对象
        self.SD = self.Src2Dst()
        self.SD3D = self.Src2Dst()
        
        # 数据数组
        self.aux = aux
        self.d = d
        self.s = s
        self.t = t
        self.CondNames = CondNames
        
        # 设置其他属性
        for key, value in kwargs.items():
            if key not in self.__dict__:
                setattr(self, key, value)
    
    def filtered_dict(self, cls) -> Dict[str, Any]:
        """
        返回过滤后的字典，不包含None值
        
        参数:
            cls: 要过滤的类实例
            
        返回:
            过滤后的字典
        """
        return {k: v for k, v in cls.__dict__.items() if v is not None}
    
    def to_dict(self) -> Dict[str, Any]:
        """
        转换为字典格式
        
        返回:
            字典格式的NIRS数据
        """
        return {
            "SD": self.filtered_dict(self.SD),
            "SD3D": self.filtered_dict(self.SD3D),
            "aux": self.aux,
            "d": self.d,
            "s": self.s,
            "t": self.t,
            "CondNames": self.CondNames,
        }
    
    class Src2Dst:
        """
        源-检测器配置类
        
        存储光源和检测器的位置、功率等信息
        """
        
        def __init__(
            self,
            nSrcs: Optional[int] = None,
            nDets: Optional[int] = None,
            Lambda: Optional[np.ndarray] = None,
            SpatialUnit: Optional[str] = None,
            SrcPos: Optional[np.ndarray] = None,
            DetPos: Optional[np.ndarray] = None,
            SrcPowers: Optional[np.ndarray] = None,
            Landmarks: Optional[np.ndarray] = None,
            MeasList: Optional[np.ndarray] = None,
            **kwargs
        ):
            """
            初始化源-检测器配置
            
            参数:
                nSrcs: 光源数量
                nDets: 检测器数量
                Lambda: 波长数组
                SpatialUnit: 空间单位
                SrcPos: 光源位置数组
                DetPos: 检测器位置数组
                SrcPowers: 光源功率数组
                Landmarks: 地标位置数组
                MeasList: 测量列表
                **kwargs: 其他属性
            """
            self.nSrcs = nSrcs
            self.nDets = nDets
            self.Lambda = Lambda
            self.SpatialUnit = SpatialUnit
            
            self.SrcPos = SrcPos
            self.DetPos = DetPos
            self.SrcPowers = SrcPowers
            self.Landmarks = Landmarks
            
            self.MeasList = MeasList
            
            # 设置其他属性
            for key, value in kwargs.items():
                if key not in self.__dict__:
                    setattr(self, key, value)