"""
血氧网格处理器

从客户端版本迁移的process_nirs_data核心算法，
提供完整的血氧数据处理流程，包括光密度转换、运动校正和滤波
"""

import numpy as np
import logging
from typing import Dict, Any, List, Optional, Tuple
from scipy import signal
from scipy.ndimage import median_filter
import warnings

logger = logging.getLogger(__name__)


class BrainOxygenProcessor:
    """
    血氧网格处理器
    
    提供从原始光强度数据到血氧浓度的完整处理流程
    """
    
    def __init__(self, sample_rate: float = 8.0):
        """
        初始化血氧处理器
        
        参数:
            sample_rate: 采样率，默认8Hz
        """
        self.sample_rate = sample_rate
        
        # 血红蛋白消光系数矩阵 (波长 x 血红蛋白类型)
        # [735nm, 850nm] x [HbO2, HbR]
        self.extinction_coeffs = np.array([
            [1.6348, 3.1430],  # 735nm: [HbO2, HbR]
            [2.1190, 1.6100]   # 850nm: [HbO2, HbR]
        ])
        
        # 默认路径长度因子
        self.default_ppf = [6.0, 6.0]  # [735nm, 850nm]
        
        logger.debug(f"BrainOxygenProcessor初始化: sample_rate={sample_rate}")
    
    def intensity_to_optical_density(self, intensity_data: np.ndarray, 
                                   baseline_frames: int = 100) -> np.ndarray:
        """
        将光强度数据转换为光密度
        
        参数:
            intensity_data: 光强度数据 (channels, timepoints)
            baseline_frames: 用于计算基线的帧数，默认100
            
        返回:
            optical_density: 光密度数据
        """
        try:
            # 确保数据为浮点类型
            intensity = intensity_data.astype(np.float64)
            
            # 替换零值避免log计算错误
            intensity[intensity <= 0] = 1e-10
            
            # 计算基线（使用前N帧的平均值）
            baseline_frames = min(baseline_frames, intensity.shape[1])
            baseline = np.mean(intensity[:, :baseline_frames], axis=1, keepdims=True)
            
            # 确保基线不为零
            baseline[baseline <= 0] = 1e-10
            
            # 计算光密度: OD = -log(I/I0)
            od_data = -np.log(intensity / baseline)
            
            # 处理无穷大和NaN值
            od_data = self._clean_data(od_data)
            
            logger.debug(f"光密度转换完成: {intensity.shape} -> {od_data.shape}")
            return od_data
            
        except Exception as e:
            logger.error(f"光密度转换失败: {e}")
            raise
    
    def od_to_concentration(self, od_data: np.ndarray, wavelengths: List[float], 
                          info: Dict[str, Any], ppf: Optional[List[float]] = None) -> Dict[str, np.ndarray]:
        """
        将光密度数据转换为血红蛋白浓度
        
        参数:
            od_data: 光密度数据 (channels, timepoints)
            wavelengths: 波长列表
            info: 包含通道信息的字典
            ppf: 路径长度因子，如果为None则使用默认值
            
        返回:
            包含HbO和HbR浓度的字典
        """
        try:
            if ppf is None:
                ppf = self.default_ppf
            
            # 确保有两个波长
            if len(wavelengths) != 2:
                raise ValueError(f"期望2个波长，实际得到{len(wavelengths)}个")
            
            # 分离不同波长的数据
            n_channels = od_data.shape[0]
            n_timepoints = od_data.shape[1]
            
            # 假设数据按波长交替排列：[wave1_ch1, wave2_ch1, wave1_ch2, wave2_ch2, ...]
            if n_channels % 2 != 0:
                raise ValueError("通道数必须是偶数（每个源-检测器对有两个波长）")
            
            n_pairs = n_channels // 2
            
            # 重新组织数据：分离两个波长
            od_735 = od_data[:n_pairs, :]   # 735nm数据
            od_850 = od_data[n_pairs:, :]   # 850nm数据
            
            # 准备消光系数矩阵（根据实际波长顺序）
            if wavelengths[0] == 735 and wavelengths[1] == 850:
                ext_matrix = self.extinction_coeffs
            elif wavelengths[0] == 850 and wavelengths[1] == 735:
                ext_matrix = self.extinction_coeffs[[1, 0], :]
            else:
                logger.warning(f"未知波长组合: {wavelengths}，使用默认消光系数")
                ext_matrix = self.extinction_coeffs
            
            # 计算逆消光系数矩阵
            inv_ext = np.linalg.pinv(ext_matrix)
            
            # 初始化浓度数组
            hbo_concentration = np.zeros((n_pairs, n_timepoints))
            hbr_concentration = np.zeros((n_pairs, n_timepoints))
            
            # 对每个源-检测器对计算浓度
            for i in range(n_pairs):
                # 构建该对的光密度向量 [OD_735, OD_850]
                od_vector = np.vstack([od_735[i, :], od_850[i, :]])
                
                # 应用修正的Beer-Lambert定律
                # ΔC = (1/L) * inv(ε) * ΔOD
                # 这里假设路径长度L已包含在ppf中
                conc_vector = inv_ext @ od_vector
                
                # 应用路径长度因子并转换为μmol/L
                hbo_concentration[i, :] = conc_vector[0, :] / ppf[0] * 1000000
                hbr_concentration[i, :] = conc_vector[1, :] / ppf[1] * 1000000
            
            result = {
                'HbO': hbo_concentration,
                'HbR': hbr_concentration
            }
            
            logger.debug(f"浓度计算完成: {n_pairs}对, HbO range=[{np.min(hbo_concentration):.2f}, {np.max(hbo_concentration):.2f}]")
            
            return result
            
        except Exception as e:
            logger.error(f"浓度计算失败: {e}")
            raise
    
    def tddr_motion_correction(self, data: np.ndarray, sample_rate: float = 8.0) -> np.ndarray:
        """
        TDDR运动伪迹校正
        
        参数:
            data: 血红蛋白浓度数据 (channels, timepoints)
            sample_rate: 采样率
            
        返回:
            校正后的数据
        """
        try:
            if data.size == 0:
                return data
            
            corrected_data = np.copy(data)
            
            # TDDR参数
            std_threshold = 3.0  # 标准差阈值
            window_size = int(sample_rate * 2)  # 2秒窗口
            
            for ch in range(data.shape[0]):
                channel_data = data[ch, :]
                
                # 计算滑动标准差
                moving_std = self._moving_std(channel_data, window_size)
                
                # 检测运动伪迹（标准差超过阈值的点）
                artifact_mask = moving_std > (std_threshold * np.std(channel_data))
                
                # 对检测到的伪迹进行插值校正
                if np.any(artifact_mask):
                    corrected_data[ch, :] = self._interpolate_artifacts(
                        channel_data, artifact_mask
                    )
            
            logger.debug(f"TDDR运动校正完成: {data.shape}")
            return corrected_data
            
        except Exception as e:
            logger.error(f"TDDR运动校正失败: {e}")
            return data  # 返回原始数据作为备选
    
    def bandpass_filter(self, data: Dict[str, np.ndarray], 
                       filter_method: str = 'FFT',
                       hpf: float = 0.01, lpf: float = 0.08,
                       sample_rate: Optional[float] = None) -> Dict[str, np.ndarray]:
        """
        带通滤波
        
        参数:
            data: 包含HbO和HbR数据的字典
            filter_method: 滤波方法，'FFT'或'butterworth'
            hpf: 高通截止频率 (Hz)
            lpf: 低通截止频率 (Hz)
            sample_rate: 采样率，如果为None则使用实例采样率
            
        返回:
            滤波后的数据字典
        """
        try:
            if sample_rate is None:
                sample_rate = self.sample_rate
                
            filtered_data = {}
            
            for key, signal_data in data.items():
                if filter_method.upper() == 'FFT':
                    filtered_data[key] = self._fft_bandpass_filter(
                        signal_data, hpf, lpf, sample_rate
                    )
                elif filter_method.lower() == 'butterworth':
                    filtered_data[key] = self._butterworth_bandpass_filter(
                        signal_data, hpf, lpf, sample_rate
                    )
                else:
                    logger.warning(f"未知滤波方法: {filter_method}，使用FFT")
                    filtered_data[key] = self._fft_bandpass_filter(
                        signal_data, hpf, lpf, sample_rate
                    )
            
            logger.debug(f"带通滤波完成: {filter_method}, {hpf}-{lpf} Hz")
            return filtered_data
            
        except Exception as e:
            logger.error(f"带通滤波失败: {e}")
            return data  # 返回原始数据作为备选
    
    def process_nirs_data(self, intensity_data: np.ndarray, 
                         info: Dict[str, Any],
                         wavelengths: Optional[List[float]] = None) -> Dict[str, np.ndarray]:
        """
        完整的血氧网格数据处理流程
        
        参数:
            intensity_data: 原始光强度数据 (channels, timepoints)
            info: 包含通道和系统信息的字典
            wavelengths: 波长列表，如果为None则从info中获取
            
        返回:
            处理后的血氧浓度数据字典
        """
        try:
            logger.info("开始血氧网格数据处理流程")
            
            # 1. 获取波长信息
            if wavelengths is None:
                if 'pairs' in info and 'lamda' in info['pairs']:
                    wavelengths = np.unique(info['pairs']['lamda'])
                else:
                    wavelengths = [735, 850]  # 默认波长
                    logger.warning("未找到波长信息，使用默认值[735, 850]")
            
            # 处理3波长情况（保留第1和第3个波长）
            if len(wavelengths) == 3:
                wavelengths = [wavelengths[0], wavelengths[2]]
                logger.info(f"检测到3个波长，使用{wavelengths}")
                
                # 重新组织数据：去除中间波长
                channels_per_wavelength = intensity_data.shape[0] // 3
                data = np.vstack([
                    intensity_data[:channels_per_wavelength],
                    intensity_data[2*channels_per_wavelength:]
                ])
            elif len(wavelengths) == 2:
                data = intensity_data
            else:
                raise ValueError(f"不支持的波长数量: {len(wavelengths)}")
            
            # 2. 光密度转换
            logger.debug("执行光密度转换")
            od_data = self.intensity_to_optical_density(data)
            
            # 3. 浓度计算
            logger.debug("执行浓度计算")
            conc_data = self.od_to_concentration(od_data, wavelengths, info, self.default_ppf)
            
            # 4. TDDR运动伪迹校正
            logger.debug("执行TDDR运动校正")
            hbo_data = self.tddr_motion_correction(conc_data['HbO'], self.sample_rate)
            hbr_data = self.tddr_motion_correction(conc_data['HbR'], self.sample_rate)
            
            # 5. FFT带通滤波 (0.01-0.08 Hz)
            logger.debug("执行FFT带通滤波")
            filtered_data = self.bandpass_filter(
                {'HbO': hbo_data, 'HbR': hbr_data},
                filter_method='FFT',
                hpf=0.01,
                lpf=0.08,
                sample_rate=self.sample_rate
            )
            
            logger.info("血氧网格数据处理流程完成")
            return filtered_data
            
        except Exception as e:
            logger.error(f"血氧网格数据处理失败: {e}")
            raise
    
    def _clean_data(self, data: np.ndarray) -> np.ndarray:
        """清理数据中的无穷大和NaN值"""
        # 替换无穷大值
        data[np.isinf(data)] = 0.0
        
        # 处理NaN值
        mask = np.isfinite(data)
        for i in range(data.shape[0]):
            row = data[i]
            row_mask = mask[i]
            
            if not np.all(row_mask):
                valid_indices = np.where(row_mask)[0]
                if len(valid_indices) > 1:
                    invalid_indices = np.where(~row_mask)[0]
                    row[invalid_indices] = np.interp(invalid_indices, valid_indices, row[valid_indices])
                else:
                    # 如果整行都是无效值，设为0
                    row[~row_mask] = 0.0
        
        return data
    
    def _moving_std(self, data: np.ndarray, window_size: int) -> np.ndarray:
        """计算滑动标准差"""
        if window_size >= len(data):
            return np.full(len(data), np.std(data))
        
        moving_std = np.zeros(len(data))
        half_window = window_size // 2
        
        for i in range(len(data)):
            start = max(0, i - half_window)
            end = min(len(data), i + half_window + 1)
            moving_std[i] = np.std(data[start:end])
        
        return moving_std
    
    def _interpolate_artifacts(self, data: np.ndarray, artifact_mask: np.ndarray) -> np.ndarray:
        """插值修复伪迹点"""
        corrected = data.copy()
        artifact_indices = np.where(artifact_mask)[0]
        valid_indices = np.where(~artifact_mask)[0]
        
        if len(valid_indices) > 1:
            corrected[artifact_indices] = np.interp(
                artifact_indices, valid_indices, data[valid_indices]
            )
        
        return corrected
    
    def _fft_bandpass_filter(self, data: np.ndarray, hpf: float, lpf: float, 
                           sample_rate: float) -> np.ndarray:
        """FFT带通滤波"""
        filtered_data = np.zeros_like(data)
        
        for ch in range(data.shape[0]):
            # 对每个通道进行FFT滤波
            signal_data = data[ch, :]
            
            # 执行FFT
            fft_data = np.fft.fft(signal_data)
            freqs = np.fft.fftfreq(len(signal_data), 1/sample_rate)
            
            # 创建滤波掩码
            mask = (np.abs(freqs) >= hpf) & (np.abs(freqs) <= lpf)
            
            # 应用滤波
            fft_filtered = fft_data * mask
            
            # 逆FFT
            filtered_signal = np.real(np.fft.ifft(fft_filtered))
            filtered_data[ch, :] = filtered_signal
        
        return filtered_data
    
    def _butterworth_bandpass_filter(self, data: np.ndarray, hpf: float, lpf: float,
                                   sample_rate: float, order: int = 4) -> np.ndarray:
        """Butterworth带通滤波"""
        nyquist = sample_rate / 2
        low = hpf / nyquist
        high = lpf / nyquist
        
        # 确保频率在有效范围内
        low = max(low, 0.001)
        high = min(high, 0.999)
        
        if low >= high:
            logger.warning(f"无效的频率范围: {hpf}-{lpf} Hz，跳过滤波")
            return data
        
        try:
            sos = signal.butter(order, [low, high], btype='band', output='sos')
            
            filtered_data = np.zeros_like(data)
            for ch in range(data.shape[0]):
                filtered_data[ch, :] = signal.sosfilt(sos, data[ch, :])
            
            return filtered_data
            
        except Exception as e:
            logger.warning(f"Butterworth滤波失败: {e}，返回原始数据")
            return data


def process_nirs_data(intensity_data: np.ndarray, info: Dict[str, Any], 
                     sample_rate: float = 8.0, 
                     wavelengths: Optional[List[float]] = None) -> Dict[str, np.ndarray]:
    """
    便捷函数：完整的血氧网格数据处理
    
    参数:
        intensity_data: 原始光强度数据 (channels, timepoints)
        info: 包含通道和系统信息的字典
        sample_rate: 采样率，默认8Hz
        wavelengths: 波长列表，如果为None则从info中获取
        
    返回:
        处理后的血氧浓度数据字典 {'HbO': array, 'HbR': array}
    """
    processor = BrainOxygenProcessor(sample_rate)
    return processor.process_nirs_data(intensity_data, info, wavelengths)