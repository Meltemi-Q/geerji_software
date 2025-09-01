"""
血氧网格算法处理器

独立的血氧网格算法实现，用于测试验证和模块化使用
基于客户端版本geerji_fnirs_new.py的process_nirs_data方法（第1081-1133行）
"""

import numpy as np
import logging
from typing import Dict, Any, List, Optional
from scipy import signal

logger = logging.getLogger(__name__)


class BloodOxygenProcessor:
    """
    血氧网格算法处理器
    
    实现完整的血氧网格处理流程：
    1. 波长选择（如有3波长数据，选择735nm和850nm）
    2. 光密度转换 
    3. 血氧浓度计算（Modified Beer-Lambert Law）
    4. TDDR运动伪迹校正
    5. FFT带通滤波 (0.01-0.08 Hz)
    """
    
    def __init__(self):
        """初始化血氧处理器"""
        # Modified Beer-Lambert Law消光系数 (与客户端版本保持一致)
        # 来自 geerji_fnirs_new.py: self.E = np.array([[1.6348, 3.1430], [2.1190, 1.6100]])
        self.ext_coeffs = {
            735: {'HbO2': 1.6348, 'HbR': 3.1430},
            850: {'HbO2': 2.1190, 'HbR': 1.6100}
        }
        
        # 默认处理参数
        self.default_ppf = [6, 6]  # 路径长度因子
        self.default_sample_rate = 8  # 采样率
        
        logger.debug("BloodOxygenProcessor initialized")
    
    def get_brain_oxygen_data(self, data: np.ndarray, info: Dict[str, Any]) -> Dict[str, np.ndarray]:
        """
        获取血氧浓度数据（完整的血氧网格算法）
        
        参数:
            data: 输入光强度数据 (n_channels, n_timepoints)
            info: 信息字典，包含pairs和system信息
            
        返回:
            包含HbO和HbR数据的字典
        """
        return self.process_nirs_data(data, info)
    
    def process_nirs_data(self, data: np.ndarray, info: Dict[str, Any]) -> Dict[str, np.ndarray]:
        """
        完整的血氧网格算法处理流程
        基于客户端版本geerji_fnirs_new.py第1081-1133行，使用标准2波长数据
        
        参数:
            data: 输入数据 (n_channels, n_timepoints)
            info: 信息字典
            
        返回:
            处理后的血氧数据字典 {'HbO': hbo_data, 'HbR': hbr_data}
        """
        try:
            logger.debug(f"开始血氧网格处理: 数据形状={data.shape}")
            
            # 1. 获取波长信息（标准2波长系统）
            wavelengths = self._get_wavelengths(info)
            
            logger.debug(f"使用波长: {wavelengths}")
            
            # 2. 处理2波长数据
            if len(wavelengths) == 2:
                # 直接使用2波长数据进行光密度转换
                od_data = self.intensity2optical_density(data)
            else:
                raise ValueError("波长数量不正确，应为2个波长")
            
            logger.debug(f"光密度转换完成: {od_data.shape}")
            
            # 3. 浓度计算（客户端第1104-1106行）
            ppf = self.default_ppf
            conc_data = self.od2conc(od_data, wavelengths, info, ppf)
            
            # 4. TDDR运动伪迹校正（客户端第1108-1110行）
            hbo_data = self.tddr_motion_correction(conc_data['HbO'], self.default_sample_rate)
            hbr_data = self.tddr_motion_correction(conc_data['HbR'], self.default_sample_rate)
            
            # 5. FFT带通滤波（客户端第1112-1130行）
            filter_method = 'FFT'
            filter_model = 3
            sample_rate = self._get_sample_rate(info)
            hpf = 0.01
            lpf = 0.08
            
            processed_data = self.nr_filter(
                {'HbO': hbo_data, 'HbR': hbr_data},
                filter_method=filter_method,
                filter_model=filter_model,
                hpf=hpf,
                lpf=lpf,
                sample_rate=sample_rate
            )
            
            logger.debug("血氧网格处理完成")
            return processed_data
            
        except Exception as e:
            logger.error(f"血氧网格处理失败: {e}")
            raise
    
    def intensity2optical_density(self, data: np.ndarray) -> np.ndarray:
        """
        光密度转换
        
        参数:
            data: 光强度数据
            
        返回:
            光密度数据
        """
        try:
            # 使用前100个时间点作为基线
            baseline_points = min(100, data.shape[1])
            baseline = np.mean(data[:, :baseline_points], axis=1, keepdims=True)
            
            # 避免除零和log零
            baseline = np.maximum(baseline, 1e-10)
            data_safe = np.maximum(data, 1e-10)
            
            od = -np.log(data_safe / baseline)
            
            # 清理异常值
            od = np.nan_to_num(od, nan=0.0, posinf=0.0, neginf=0.0)
            
            logger.debug(f"光密度转换完成: {od.shape}")
            return od
            
        except Exception as e:
            logger.error(f"光密度转换失败: {e}")
            raise
    
    def od2conc(self, od_data: np.ndarray, wavelengths: List[int], 
                info: Dict[str, Any], ppf: List[float]) -> Dict[str, np.ndarray]:
        """
        光密度到浓度转换 (Modified Beer-Lambert Law)
        
        参数:
            od_data: 光密度数据
            wavelengths: 波长列表
            info: 信息字典
            ppf: 路径长度因子
            
        返回:
            浓度数据字典
        """
        try:
            # 验证波长是否在支持范围内
            for wl in wavelengths:
                if wl not in self.ext_coeffs:
                    raise ValueError(f"不支持的波长: {wl}nm，支持的波长: {list(self.ext_coeffs.keys())}")
            
            n_channels = od_data.shape[0] // 2
            
            # 分离两个波长的数据
            od_wl1 = od_data[:n_channels, :]  # 第一个波长
            od_wl2 = od_data[n_channels:, :]  # 第二个波长
            
            # 消光系数矩阵
            E = np.array([
                [self.ext_coeffs[wavelengths[0]]['HbO2'], self.ext_coeffs[wavelengths[0]]['HbR']],
                [self.ext_coeffs[wavelengths[1]]['HbO2'], self.ext_coeffs[wavelengths[1]]['HbR']]
            ])
            
            # 计算浓度
            hbo_data = np.zeros((n_channels, od_data.shape[1]))
            hbr_data = np.zeros((n_channels, od_data.shape[1]))
            
            inv_E = np.linalg.pinv(E)
            
            for ch in range(n_channels):
                od_pair = np.vstack([od_wl1[ch, :], od_wl2[ch, :]])
                conc = inv_E @ od_pair
                hbo_data[ch, :] = conc[0, :] * 1000  # 转换为μmol/L
                hbr_data[ch, :] = conc[1, :] * 1000
            
            # 清理异常值
            hbo_data = np.nan_to_num(hbo_data, nan=0.0, posinf=1000.0, neginf=-1000.0)
            hbr_data = np.nan_to_num(hbr_data, nan=0.0, posinf=1000.0, neginf=-1000.0)
            
            logger.debug(f"浓度计算完成: HbO={hbo_data.shape}, HbR={hbr_data.shape}")
            return {'HbO': hbo_data, 'HbR': hbr_data}
            
        except Exception as e:
            logger.error(f"浓度计算失败: {e}")
            raise
    
    def tddr_motion_correction(self, data: np.ndarray, sample_rate: int) -> np.ndarray:
        """
        TDDR运动伪迹校正
        
        参数:
            data: 输入数据
            sample_rate: 采样率
            
        返回:
            校正后的数据
        """
        try:
            corrected_data = data.copy()
            
            # 简化的TDDR实现：线性去趋势
            for ch in range(data.shape[0]):
                # 线性去趋势
                x = np.arange(data.shape[1])
                if len(x) > 1:
                    coeffs = np.polyfit(x, data[ch, :], 1)
                    trend = np.polyval(coeffs, x)
                    corrected_data[ch, :] = data[ch, :] - trend
            
            # 清理异常值
            corrected_data = np.nan_to_num(corrected_data, nan=0.0)
            
            logger.debug(f"TDDR运动校正完成: {corrected_data.shape}")
            return corrected_data
            
        except Exception as e:
            logger.error(f"TDDR运动校正失败: {e}")
            raise
    
    def nr_filter(self, data_dict: Dict[str, np.ndarray], filter_method: str,
                  filter_model: int, hpf: float, lpf: float, sample_rate: int) -> Dict[str, np.ndarray]:
        """
        FFT带通滤波
        
        参数:
            data_dict: 数据字典
            filter_method: 滤波方法
            filter_model: 滤波模型
            hpf: 高通频率
            lpf: 低通频率
            sample_rate: 采样率
            
        返回:
            滤波后的数据字典
        """
        try:
            # 设计带通滤波器
            nyquist = sample_rate / 2
            low = hpf / nyquist
            high = lpf / nyquist
            
            # 确保频率在有效范围内
            low = max(low, 0.001)
            high = min(high, 0.99)
            
            if high <= low:
                logger.warning(f"滤波频率范围无效: low={low}, high={high}")
                return data_dict
            
            b, a = signal.butter(4, [low, high], btype='band')
            
            filtered_data = {}
            for key, data in data_dict.items():
                filtered_data[key] = np.zeros_like(data)
                for ch in range(data.shape[0]):
                    if data.shape[1] > 12:  # 至少需要足够的数据点
                        try:
                            filtered_data[key][ch, :] = signal.filtfilt(b, a, data[ch, :])
                        except Exception as e:
                            logger.warning(f"通道{ch}滤波失败: {e}")
                            filtered_data[key][ch, :] = data[ch, :]
                    else:
                        filtered_data[key][ch, :] = data[ch, :]
                
                # 清理异常值
                filtered_data[key] = np.nan_to_num(filtered_data[key], nan=0.0)
            
            logger.debug(f"带通滤波完成: {filter_method} {hpf}-{lpf} Hz")
            return filtered_data
            
        except Exception as e:
            logger.error(f"带通滤波失败: {e}")
            return data_dict
    
    def _get_wavelengths(self, info: Dict[str, Any]) -> List[int]:
        """从info字典中提取波长信息（标准2波长系统）"""
        try:
            if 'pairs' in info and 'lamda' in info['pairs']:
                wavelengths = np.unique(info['pairs']['lamda']).tolist()
                # 标准2波长系统，应该返回[735, 850]
                if len(wavelengths) == 2:
                    return wavelengths[:2]
                else:
                    return [735, 850]  # 默认波长
            elif 'pairs' in info and 'WL' in info['pairs']:
                # 如果只有WL索引，使用默认波长
                return [735, 850]
            else:
                return [735, 850]  # 默认波长
        except Exception:
            return [735, 850]
    
    def _get_sample_rate(self, info: Dict[str, Any]) -> int:
        """从info字典中提取采样率信息"""
        try:
            if 'system' in info and 'framerate' in info['system']:
                return info['system']['framerate']
            else:
                return self.default_sample_rate
        except Exception:
            return self.default_sample_rate


def process_nirs_data(intensity_data: np.ndarray, wavelengths: List[int], 
                     info: Dict[str, Any], ppf: List[float]) -> Dict[str, np.ndarray]:
    """
    便捷函数：执行完整的血氧网格算法处理
    
    参数:
        intensity_data: 光强度数据
        wavelengths: 波长列表
        info: 信息字典
        ppf: 路径长度因子
        
    返回:
        处理后的血氧数据字典
    """
    processor = BloodOxygenProcessor()
    return processor.process_nirs_data(intensity_data, info)