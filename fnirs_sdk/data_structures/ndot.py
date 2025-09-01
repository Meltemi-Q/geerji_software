"""
NDot数据结构

基于客户端版本的NDot类，提供标准化的DOT数据结构
"""

from typing import Optional, Dict, Any
import numpy as np
from dataclasses import dataclass


@dataclass
class NDot:
    """
    NDot数据结构类
    
    存储DOT(Diffuse Optical Tomography)数据的标准格式
    """
    
    def __init__(
        self,
        io: Optional['NDot.Io'] = None,
        system: Optional['NDot.System'] = None,
        misc: Optional['NDot.Misc'] = None,
        paradigm: Optional['NDot.Paradigm'] = None,
        optodes: Optional['NDot.Optodes'] = None,
        pairs: Optional['NDot.Pairs'] = None,
        tissue: Optional['NDot.Tissue'] = None,
        **kwargs
    ):
        """
        初始化NDot数据结构
        
        参数:
            io: IO参数
            system: 系统参数
            misc: 其他参数
            paradigm: 范式参数
            optodes: 光极参数
            pairs: 对参数
            tissue: 组织参数
            **kwargs: 其他属性
        """
        self.io = self.Io()
        self.system = self.System()
        self.misc = self.Misc()
        self.paradigm = self.Paradigm()
        self.optodes = self.Optodes()
        self.pairs = self.Pairs()
        self.tissue = self.Tissue()
        
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
            字典格式的NDot数据
        """
        return {
            "io": self.filtered_dict(self.io),
            "system": self.filtered_dict(self.system),
            "misc": self.filtered_dict(self.misc),
            "paradigm": self.filtered_dict(self.paradigm),
            "optodes": self.filtered_dict(self.optodes),
            "pairs": self.filtered_dict(self.pairs),
            "tissue": self.filtered_dict(self.tissue),
        }
    
    class Io:
        """IO参数类"""
        
        def __init__(self):
            self.Nd: Optional[int] = None      # 检测器数量
            self.Ns: Optional[int] = None      # 光源数量
            self.Nwl: Optional[int] = None     # 波长数量
            self.nframe: Optional[int] = None  # 帧数
    
    class System:
        """系统参数类"""
        
        def __init__(self):
            self.framerate: Optional[float] = None  # 帧率
            self.startTime: Optional[float] = None  # 开始时间
    
    class Misc:
        """其他参数类"""
        
        def __init__(self):
            self.startTime: Optional[float] = None  # 开始时间
    
    class Paradigm:
        """范式参数类"""
        
        def __init__(self):
            self.synchpts: Optional[np.ndarray] = None    # 同步点
            self.synchtype: Optional[np.ndarray] = None   # 同步类型
            self.synchtimes: Optional[np.ndarray] = None  # 同步时间
    
    class Optodes:
        """光极参数类"""
        
        def __init__(self):
            self.spos3: Optional[np.ndarray] = None              # 光源3D位置
            self.dpos3: Optional[np.ndarray] = None              # 检测器3D位置
            self.spos2: Optional[np.ndarray] = None              # 光源2D位置  
            self.dpos2: Optional[np.ndarray] = None              # 检测器2D位置
            self.plot3orientation: Optional[Dict[str, str]] = None  # 3D绘图方向
    
    class Pairs:
        """对参数类"""
        
        def __init__(self):
            self.Src: Optional[np.ndarray] = None     # 光源索引
            self.Det: Optional[np.ndarray] = None     # 检测器索引
            self.NN: Optional[np.ndarray] = None      # 最近邻分组
            self.WL: Optional[np.ndarray] = None      # 波长索引
            self.Mod: Optional[list] = None           # 调制类型
            self.r3d: Optional[np.ndarray] = None     # 3D距离
            self.g: Optional[np.ndarray] = None       # 增益
            self.r2d: Optional[np.ndarray] = None     # 2D距离
            self.lamda: Optional[np.ndarray] = None   # 波长值
    
    class Tissue:
        """组织参数类"""
        
        def __init__(self):
            self.affine: Optional[np.ndarray] = None           # 仿射变换矩阵
            self.affine_target: Optional[str] = None           # 仿射变换目标坐标系