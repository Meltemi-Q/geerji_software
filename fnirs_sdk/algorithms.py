"""
fNIRS SDK核心算法实现

基于客户端验证的数据处理算法，确保结果的一致性
"""

import numpy as np
from typing import Dict, List, Tuple, Optional
from scipy import signal
import warnings

from .data_types import HB_EXTINCTION_COEFFS, DEFAULT_PPF, DEFAULT_WAVELENGTHS


def process_data(data, n_node, max_node_num=6):
    """处理光学测量设备的原始数据 - 支持动态节点数（客户端验证版本）
    
    参数:
    data (bytes): 原始字节数据
    n_node (int): 从数据包解析的节点总数（可能小于实际系统节点数）
    max_node_num (int): 系统最大支持的节点数，默认6（决定返回数组大小）
    
    返回:
    tuple: (result, result, node_list)
        - result: 固定大小数组（基于max_node_num），实际节点数据映射到正确位置
        - result: 相同的数组（保持兼容性）
        - node_list: 检测到的有效节点列表
    
    关键改进：
    - 始终返回基于max_node_num的固定大小数组（如864维）
    - 支持1-6个节点的动态映射
    - 将实际节点数据映射到在完整系统中的正确位置
    """
    # 常量定义
    N_DET = 4           # 每节点的探测器数
    N_SOURCE = 3        # 每节点的光源数
    N_WAVELENGTH = 2    # 波长数
    BYTES_PER_VALUE = 3 + 1 # 每个数值占用的字节数
    
    def extract_node_source(byte_data, offset):
        """从字节数据中提取节点号和光源号"""
        hex_value = hex(byte_data[offset])[2:].zfill(2)
        return int(hex_value[0], 16), int(hex_value[1], 16)
    
    def bytes_to_float(byte_data, start_idx):
        """将3字节数据转换为浮点数"""
        value = (byte_data[start_idx + 2] << 16) + \
                (byte_data[start_idx + 1] << 8) + \
                byte_data[start_idx]
        return value / 8388608.0
    
    try:
        # 1. 提取节点和光源信息
        node_data_bytes = n_node * N_DET * BYTES_PER_VALUE
        valid_nodes_sources = []
        node_list = []
        
        n = 0
        
        while (3 + node_data_bytes * n) < len(data):
            node, source = extract_node_source(data, 3 + node_data_bytes * n)
            
            # 跳过无效的节点号（节点号应该在1-12范围内）
            if node == 0 or node > 12:
                n += 1
                continue
                
            valid_nodes_sources.append((node, source))
            if node not in node_list:
                node_list.append(node)
            n += 1
            
        # 2. 数据转换
        new_data = [bytes_to_float(data, i) 
                   for i in range(0, len(data), BYTES_PER_VALUE)]
        
        # 3. 初始化结果数组 - 使用max_node_num确保固定大小
        total_channels = N_SOURCE * N_WAVELENGTH * max_node_num * max_node_num * N_DET
        result = np.zeros(total_channels)
        
        # 4. 获取所有通道对应的【光源、检测器、波长】通道列表（基于max_node_num的完整系统）
        all_chanslist = []
        for w in [735,850]:
            for s in range(N_SOURCE*max_node_num):
                for d in range(N_DET*max_node_num):
                    all_chanslist.append([s+1,d+1,w]) #目标格式：[all光源，all检测器，波长1][all光源，all检测器，波长2]
                    
        # 5.连通的光源和检测器（实际采集到的数据）
        node_array = np.array(node_list)
        source_array = sorted(np.concatenate((node_array*3-2,node_array*3-1,node_array*3)))
        det_array = sorted(np.concatenate((node_array*4-3,node_array*4-2,node_array*4-1,node_array*4)))
        
        # 5创建真实通道列表并构建查找表（使用字典提高查找效率）
        truth_chanslist = []
        truth_chans_dict = {}  # 用于快速查找的字典
        
        # 重要：实际数据的顺序是 波长->光源->探测器
        # 根据调试输出，数据按这个顺序排列：前12个是735nm，后12个是850nm
        data_idx = 0
        for w in [735, 850]:  # 波长优先
            for s in source_array:  # 然后光源
                for d in det_array:  # 最后探测器
                    chan = [s, d, w]
                    truth_chanslist.append(chan)
                    truth_chans_dict[(s, d, w)] = data_idx
                    data_idx += 1
        
        # 6.将 实际采集到的数据 映射到 理论通道（满节点时）
        mapped_count = 0
        for ch_idx, chan in enumerate(all_chanslist):
            # 将列表转换为元组用于字典查找替代列表搜索，大幅提高性能
            chan_tuple = (chan[0], chan[1], chan[2])
            if truth_chans_dict.get(chan_tuple) is not None:
                # 直接获取索引，O(1)
                truth_idx = truth_chans_dict.get(chan_tuple)
                result[ch_idx] = new_data[truth_idx]
                mapped_count += 1
        
        return result, result, node_list
        
    except Exception as e:
        raise RuntimeError(f"数据处理错误: {str(e)}")


def intensity2optical_density(intensity: np.ndarray) -> np.ndarray:
    """
    将光强度数据转换为光密度数据（与客户端完全一致）
    
    参数:
        intensity: 光强度数据，形状为(通道数, 时间点数)
        
    返回:
        光密度数据，形状与输入相同
    """
    if intensity.ndim != 2:
        raise ValueError("强度数据必须是2D NumPy数组，形状为(通道数, 时间点数)")
    
    # 检查是否有小于等于0的值（与客户端一致）
    if np.any(intensity <= 0):
        import warnings
        warnings.warn('WARNING: Some data points in intensity are zero or negative.')
    
    # 计算每个通道的光强均值作为I0（与客户端完全一致）
    # dm = np.mean(np.abs(intensity[:,0:100]), axis=1)
    baseline_points = min(100, intensity.shape[1])
    dm = np.mean(np.abs(intensity[:, :baseline_points]), axis=1)
    
    # 将dm转换为列向量以便广播（与客户端一致）
    dm = dm[:, np.newaxis]
    
    # 计算光密度（与客户端完全一致）
    od = -np.log(np.abs(intensity) / dm)
    
    return od


def get_extinctions(wavelength):
    """
    获取HbO和HbR的消光系数（与客户端完全一致）
    
    参数:
        wavelength: 单个波长值或波长数组
    
    返回:
        numpy数组: shape为(n,2)，第一列是HbO，第二列是HbR
        单位: [cm^-1/(moles/liter)]
    """
    # 消光系数查找表（基于客户端实际数据）
    extinction_data = np.array([
        [650.0, 506.0, 3743.0],
        [735.0, 525.9, 1289.5],  # 基于客户端数据插值计算
        [850.0, 1097.0, 781.0], # 客户端实际数据
        # 可以根据需要添加更多波长点
    ])
    
    wavelengths = extinction_data[:, 0]
    hbo_coeffs = extinction_data[:, 1]
    hbr_coeffs = extinction_data[:, 2]
    
    # 处理单个波长或数组
    if np.isscalar(wavelength):
        wavelength = np.array([wavelength])
    
    wavelength = np.array(wavelength)
    results = np.zeros((len(wavelength), 2))
    
    for i, wl in enumerate(wavelength):
        # 查找最接近的波长
        idx = np.argmin(np.abs(wavelengths - wl))
        results[i, 0] = hbo_coeffs[idx]  # HbO
        results[i, 1] = hbr_coeffs[idx]  # HbR
    
    return results


def od2conc(od_data: np.ndarray, wavelengths: List[int], info: Dict, ppf, dist_type='r2d') -> Dict[str, np.ndarray]:
    """
    将光密度数据转换为血红蛋白浓度（与客户端算法完全一致）
    
    参数:
        od_data: 光密度数据 (n_channels, n_timepoints)
        wavelengths: 波长列表，如[735, 850]
        info: 设备信息字典
        ppf: 路径长度因子列表，如[6.0, 6.0]
        dist_type: 距离类型，默认'r2d'
    
    返回:
        字典包含'HbO'和'HbR'浓度数据
    """
    # 处理ppf参数：确保是列表格式
    if isinstance(ppf, (int, float)):
        ppf_values = [ppf, ppf]  # 对两个波长使用相同的PPF
    elif isinstance(ppf, (list, tuple)):
        if len(ppf) >= len(wavelengths):
            ppf_values = list(ppf[:len(wavelengths)])
        else:
            ppf_values = list(ppf) + [ppf[-1]] * (len(wavelengths) - len(ppf))
    else:
        ppf_values = [6.0, 6.0]  # 默认值
        
    # 参数验证（与客户端一致）
    if len(ppf_values) != len(wavelengths):
        raise ValueError(f"PPF长度({len(ppf_values)})必须与波长数量({len(wavelengths)})相匹配")
    
    # 获取基本参数（与客户端一致）
    n_channels = od_data.shape[0] // len(wavelengths)  # 每个波长的通道数
    n_time = od_data.shape[1]
    
    # 获取消光系数（转换为/mm）（与客户端一致）
    e = get_extinctions(wavelengths)
    e = e[:, :2] / 10  # 转换从/cm到/mm，只取HbO和HbR
    print(f'消光系数: {e}')
    
    # 计算消光系数矩阵的逆（与客户端一致）
    einv = np.linalg.inv(e.T @ e) @ e.T
    
    # 创建结果矩阵（与客户端一致）
    HbO = np.zeros((n_channels, n_time))
    HbR = np.zeros((n_channels, n_time))
    
    # 对每个源-探测器对进行处理（与客户端完全一致）
    for idx in range(n_channels):
        # 获取两个波长的数据
        y1 = od_data[idx, :]          # 波长1的数据
        y2 = od_data[idx + n_channels, :]  # 波长2的数据
        
        # 获取源-探测器距离（与客户端一致）
        if isinstance(info, dict) and 'pairs' in info and dist_type in info['pairs']:
            if idx < len(info['pairs'][dist_type]):
                rho = info['pairs'][dist_type][idx]
            else:
                rho = 30.0  # 默认距离30mm
        else:
            rho = 30.0  # 默认距离30mm
            
        # 组合两个波长的数据并考虑距离和ppf的影响（与客户端完全一致）
        y_temp = np.vstack([
            y1 / (rho * ppf_values[0]),
            y2 / (rho * ppf_values[1])
        ])
        
        # 计算浓度（与客户端一致）
        conc = (einv @ y_temp).T  # shape: (time_points, 2)
        
        # 存储结果（与客户端一致）
        HbO[idx, :] = conc[:, 0]     # HbO
        HbR[idx, :] = conc[:, 1]     # HbR
    
    return {
        'HbO': HbO,
        'HbR': HbR
    }


def TDDR_motion_correction(data: np.ndarray, sample_rate: int) -> np.ndarray:
    """
    TDDR运动伪迹校正（完整客户端算法实现，修复kernel_size错误）
    
    参数:
        data: 血红蛋白浓度数据 (n_channels, n_timepoints)
        sample_rate: 采样率，默认8Hz
    
    返回:
        校正后的数据，形状与输入相同
    """
    if data.ndim != 2:
        raise ValueError("数据必须是2D数组")
    
    corrected_data = data.copy()
    
    # 对每个通道应用完整的TDDR算法
    for ch in range(data.shape[0]):
        channel_data = data[ch, :]
        # 只处理非零数据
        if np.any(channel_data):
            corrected_data[ch, :] = _tddr_single_channel(channel_data, sample_rate)
    
    return corrected_data


def _tddr_single_channel(data: np.ndarray, sample_rate: int) -> np.ndarray:
    """
    对单个通道应用TDDR算法（完整客户端实现）
    
    参数:
        data: 单通道数据 (n_timepoints,)
        sample_rate: 采样率
        
    返回:
        校正后的单通道数据
    """
    # 预处理：分离高频和低频分量
    filter_cutoff = 0.5
    filter_order = 3
    Fc = filter_cutoff * 2 / sample_rate
    
    data_mean = np.mean(data)
    data_centered = data - data_mean
    
    if Fc < 1:
        # 创建低通滤波器
        fb, fa = signal.butter(filter_order, Fc)
        data_low = signal.filtfilt(fb, fa, data_centered, padlen=0)
    else:
        data_low = data_centered
    
    data_high = data_centered - data_low
    
    # 初始化TDDR算法参数
    tune = 4.685
    D = np.sqrt(np.finfo(data.dtype).eps)
    mu = np.inf
    iteration = 0
    
    # 第1步：计算时间导数
    deriv = np.diff(data_low)
    
    # 第2步：初始化观测权重
    w = np.ones(deriv.shape)
    
    # 第3步：迭代估计鲁棒权重
    while iteration < 50:
        iteration += 1
        mu0 = mu
        
        # 第3a步：估计加权均值
        mu = np.sum(w * deriv) / np.sum(w)
        
        # 第3b步：计算估计的绝对残差
        dev = np.abs(deriv - mu)
        
        # 第3c步：残差标准偏差的鲁棒估计
        sigma = 1.4826 * np.median(dev)
        
        # 避免除零错误
        if sigma == 0:
            sigma = 1e-10
        
        # 第3d步：通过标准偏差和调优参数缩放偏差
        r = dev / (sigma * tune)
        
        # 第3e步：根据Tukey双权重函数计算新权重
        w = ((1 - r**2) * (r < 1)) ** 2
        
        # 第3f步：如果新估计在旧估计的机器精度范围内则终止
        if abs(mu - mu0) < D * max(abs(mu), abs(mu0)):
            break
    
    # 第4步：将鲁棒权重应用于中心化导数
    new_deriv = w * (deriv - mu)
    
    # 第5步：积分校正导数
    data_low_corrected = np.cumsum(np.insert(new_deriv, 0, 0.0))
    
    # 后处理：中心化校正信号
    data_low_corrected = data_low_corrected - np.mean(data_low_corrected)
    
    # 后处理：与未校正的高频分量合并
    data_corrected = data_low_corrected + data_high + data_mean
    
    return data_corrected


def nr_filter(data: Dict[str, np.ndarray], 
              filter_method: str = 'FFT',
              filter_model: int = 3,
              filter_order: Optional[int] = None,
              hpf: float = 0.01,
              lpf: float = 0.08,
              sample_rate: int = 8) -> Dict[str, np.ndarray]:
    """
    带通滤波函数（与客户端nr_filter完全一致）
    
    参数:
        data: 包含'HbO'和'HbR'键的字典
        filter_method: 滤波方法，'FFT'或'Butterworth'
        filter_model: 滤波模型，3表示带通滤波
        filter_order: 滤波器阶数
        hpf: 高通滤波频率 (Hz)
        lpf: 低通滤波频率 (Hz)
        sample_rate: 采样率 (Hz)
    
    返回:
        滤波后的数据字典
    """
    filtered_data = {}
    
    for key, values in data.items():
        if filter_method == 'FFT':
            # FFT带通滤波
            filtered_data[key] = _fft_bandpass_filter(values, hpf, lpf, sample_rate)
        else:
            # Butterworth带通滤波
            filtered_data[key] = _butterworth_bandpass_filter(values, hpf, lpf, sample_rate, filter_order)
    
    return filtered_data


def _fft_bandpass_filter(data: np.ndarray, hpf: float, lpf: float, sample_rate: int) -> np.ndarray:
    """FFT带通滤波实现"""
    filtered_data = np.zeros_like(data)
    
    for ch in range(data.shape[0]):
        signal_data = data[ch, :]
        
        # FFT变换
        fft_data = np.fft.fft(signal_data)
        freqs = np.fft.fftfreq(len(signal_data), 1/sample_rate)
        
        # 创建滤波器掩码
        mask = (np.abs(freqs) >= hpf) & (np.abs(freqs) <= lpf)
        
        # 应用滤波器
        fft_filtered = fft_data * mask
        
        # 逆FFT变换
        filtered_signal = np.fft.ifft(fft_filtered).real
        filtered_data[ch, :] = filtered_signal
    
    return filtered_data


def _butterworth_bandpass_filter(data: np.ndarray, hpf: float, lpf: float, 
                                sample_rate: int, order: Optional[int] = None) -> np.ndarray:
    """Butterworth带通滤波实现"""
    if order is None:
        order = 4
    
    # 设计Butterworth带通滤波器
    nyquist = sample_rate / 2
    low = hpf / nyquist
    high = lpf / nyquist
    
    if high >= 1.0:
        high = 0.99
    if low <= 0:
        low = 0.01
    
    b, a = signal.butter(order, [low, high], btype='band')
    
    # 应用滤波器
    filtered_data = np.zeros_like(data)
    for ch in range(data.shape[0]):
        filtered_data[ch, :] = signal.filtfilt(b, a, data[ch, :])
    
    return filtered_data


def process_nirs_data(intensity_data: np.ndarray, 
                     wavelengths: List[int] = None,
                     info: Dict = None,
                     ppf: List[float] = None) -> Dict[str, np.ndarray]:
    """
    完整的血氧网格数据处理流程（与客户端process_nirs_data完全一致）
    
    参数:
        intensity_data: 原始光强度数据 (864, n_timepoints)
        wavelengths: 波长列表，默认[735, 850]
        info: 设备信息字典
        ppf: 路径长度因子，默认[6, 6]
    
    返回:
        包含处理后HbO和HbR数据的字典
    """
    if wavelengths is None:
        wavelengths = DEFAULT_WAVELENGTHS
    if ppf is None:
        ppf = DEFAULT_PPF
    if info is None:
        # 创建基本的info结构
        info = {'system': {'framerate': 8}}
    
    # 步骤1: 波长选择（如果有3个波长，选择735nm和850nm）
    if intensity_data.shape[0] == 1296:  # 3波长数据 (432*3)
        channels_per_wavelength = intensity_data.shape[0] // 3
        # 选择735nm(第1个)和850nm(第3个)波长的数据
        selected_data = np.vstack([
            intensity_data[:channels_per_wavelength],           # 735nm
            intensity_data[2*channels_per_wavelength:]          # 850nm
        ])
    else:
        selected_data = intensity_data
    
    # 步骤2: 光密度转换
    od_data = intensity2optical_density(selected_data)
    
    # 步骤3: 血氧浓度计算
    conc_data = od2conc(od_data, wavelengths, info, ppf)
    
    # 步骤4: TDDR运动校正 (暂时禁用以调试血氧数值)
    # hbo_corrected = TDDR_motion_correction(conc_data['HbO'], 8)
    # hbr_corrected = TDDR_motion_correction(conc_data['HbR'], 8)
    
    # 临时跳过TDDR校正，直接使用od2conc结果
    hbo_corrected = conc_data['HbO']
    hbr_corrected = conc_data['HbR']
    
    # 步骤5: FFT带通滤波 (暂时禁用以调试血氧数值)
    # processed_data = nr_filter(
    #     {'HbO': hbo_corrected, 'HbR': hbr_corrected},
    #     filter_method='FFT',
    #     filter_model=3,  # 带通滤波
    #     hpf=0.01,
    #     lpf=0.08,
    #     sample_rate=8
    # )
    
    # 临时跳过滤波步骤，直接返回TDDR校正后的数据
    processed_data = {
        'HbO': hbo_corrected,
        'HbR': hbr_corrected
    }
    
    return processed_data


def select_channels(info: Dict, distance_range: Optional[Tuple[float, float]] = None) -> List[int]:
    """
    选择要显示的通道（与客户端select_channels一致）
    
    参数:
        info: 通道信息字典
        distance_range: (min, max) 距离范围，单位mm
    
    返回:
        选中的通道索引列表
    """
    if info is None or 'pairs' not in info or 'r2d' not in info['pairs']:
        return []
    
    # 获取波长数和实际通道数
    try:
        waves_num = len(np.unique(info['pairs']['WL']))
        total_channels = len(info['pairs']['r2d'])
        real_channels = int(total_channels / waves_num)
    except:
        # 如果info结构不完整，返回默认通道
        return list(range(432))
    
    # 自动模式：根据通道数量决定策略
    if distance_range is None:
        if real_channels < 50:
            return list(range(real_channels))
        else:
            distance_range = (28, 32)  # 默认距离范围
    
    # 根据距离范围选择通道
    selected_channels = []
    for i, distance in enumerate(info['pairs']['r2d'][:real_channels]):
        if distance_range[0] <= distance <= distance_range[1]:
            selected_channels.append(i)
    
    # 如果没有选中任何通道，返回所有通道
    if not selected_channels:
        return list(range(real_channels))
    
    return selected_channels


# 已移除calculate_derived_metrics函数
# 康莲SDK只需要HbO和HbR基础指标，不需要衍生指标计算
# 如果需要HbT可通过 HbT = HbO + HbR 简单计算