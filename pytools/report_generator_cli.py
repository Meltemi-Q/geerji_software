import sys
import os
from datetime import datetime
import numpy as np
import matplotlib.pyplot as plt
from matplotlib.patches import Circle
import matplotlib.gridspec as gridspec
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Image, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import PageBreak
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

import tempfile
import shutil
import logging
from scipy.interpolate import griddata
import traceback
import toml
import fitz # PyMuPDF, used indirectly by PDFViewer, not directly needed for CLI generation
import pywt
import scipy.signal as signal
from tqdm.auto import tqdm # tqdm might print to console, consider if this is desired in a pure API
from itertools import combinations
from concurrent.futures import ThreadPoolExecutor, ProcessPoolExecutor

from tools.geerji_info import load_mat2info

# 尝试从 tools 目录导入必要的函数
# 用户需要确保 'tools' 目录在 PYTHONPATH 中或与此脚本位于正确的相对位置
try:
    from tools.data_types import lumo2ndot, load_nirs
    from tools.data_utils import (intensity2optical_density, TDDR_motion_correction,
                                od2conc, nr_filter)
    from tools.geerji_info import load_info, load_mat
except ImportError as e:
    print(f"错误：无法从 'tools' 目录导入模块。请确保 'tools' 目录存在且在 PYTHONPATH 中。详细信息: {e}")
    # 可以选择在这里 sys.exit(1) 如果这些导入是绝对关键的
    # 为了继续定义类和函数结构，暂时忽略错误，但实际运行时会失败
    pass


FS = 10 # 全局采样率

def setup_matplotlib_fonts():
    """设置matplotlib的中文字体"""
    plt.rcParams['font.sans-serif'] = ['SimHei', 'Microsoft YaHei', 'SimSun', 'Arial Unicode MS']
    plt.rcParams['axes.unicode_minus'] = False

def setup_logger(output_dir_name="logs_cli"):
    """设置日志记录器"""
    # 基于脚本文件位置创建日志目录
    script_dir = os.path.dirname(os.path.abspath(__file__))
    log_output_dir = os.path.join(script_dir, output_dir_name)

    log_filename = f"process_log_cli_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
    log_path = os.path.join(log_output_dir, log_filename)
    if not os.path.exists(log_output_dir):
        os.makedirs(log_output_dir)

    logger = logging.getLogger('NIRSReportGeneratorCLI')
    logger.setLevel(logging.INFO)
    
    if logger.handlers:
        logger.handlers.clear()
    
    file_handler = logging.FileHandler(log_path, encoding='utf-8')
    file_handler.setLevel(logging.INFO)
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.INFO)
    
    formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
    file_handler.setFormatter(formatter)
    console_handler.setFormatter(formatter)
    
    logger.addHandler(file_handler)
    logger.addHandler(console_handler)
    
    return logger

# --- 复制 compute_phoebe, merge_events, get_task_point_data from report_system.py ---
def compute_phoebe(raw1, raw2):
    """计算SCI和PSP（严格遵循论文公式）
    input: raw1, raw2 -> 光密度数据
    return: phoebe_score -> 0~1
    """
    b, a = signal.butter(4, [0.25/FS, 2.5/FS], btype='band')
    filtered1 = signal.filtfilt(b, a, raw1)
    filtered2 = signal.filtfilt(b, a, raw2)
    norm1 = (filtered1 - np.mean(filtered1)) / np.std(filtered1)
    norm2 = (filtered2 - np.mean(filtered2)) / np.std(filtered2)
    sci = np.correlate(norm1, norm2, mode='valid')[0] / (len(norm1))
    if np.any(np.abs(sci) > np.finfo(float).eps):
        sci = len(norm1) * abs(sci) / (np.sqrt(np.sum(np.abs(norm1)**2) * np.sum(np.abs(norm2)**2)))
    else:
        print('Saturated signals') # Consider logging this
    f, Pxx = signal.welch(norm1 * norm2, FS, nperseg=256)
    mask = (f >= 0.5) & (f <= 2.0)
    psp = np.max(Pxx[mask]) if np.any(mask) else 0
    sci = sci if psp >0.1 else 0
    return sci

def merge_events(events, islumo):
    '''合并事件标记，合并时间间隔小于time_interval的事件,解决事件标记被错误分割的问题
    events: 事件列表
    time_interval: 事件合并的时间间隔，单位为ms
    '''
    
    if islumo:
        time_interval = 100
    else:
        time_interval = 10
    
    processed_events = []
    i = 0
    while i < len(events):
        current_event = events[i]
        # 检查是否需要与下一个事件合并
        if i + 1 < len(events):
            next_event = events[i + 1]
            current_time = int(current_event['Timestamp'])
            next_time = int(next_event['Timestamp'])
            
            # 如果两个事件的时间间隔很小(比如小于100ms)
            if next_time - current_time < time_interval:
                # 合并事件名称
                merged_name = current_event['name'] + next_event['name']
                processed_events.append({
                    'name': merged_name,
                    'Timestamp': current_event['Timestamp']
                })
                i += 2  # 跳过下一个事件
                continue
                
        processed_events.append(current_event)
        i += 1
        
    return processed_events
def get_task_point_data(processed_events, islumo, task_name: str, data=None) -> np.ndarray:
    """获取事件中任务的开始和结束时间点
    
    Args:
        events: 包含事件信息的字典
        task_name: 任务类型名称,可选值:
            - 'rest': 长静息态
            - 'rest_front': 前静息态
            - 'rest_end': 后静息态
            - 'say': 说物阶段  
            - 'listen': 听物阶段
            - 'rest3.5': 3.5min静息态
            - 'say_and_rest': 3.5min静息后的完整说物范式
        data: 可选的数据参数(暂未使用)
    
    Return:以下情况之一
        None: 如果未找到任务time_point
        data(np.ndarray): 若输入data不为None,则返回任务时间内的数据data[:,start_time:end_time]
        time_points(np.ndarray): 任务的起止时间点数组,shape为(2),包含(start_time, end_time)
    """
    # 定义任务2型对应的事件标记
    TASK_EVENTS = {
        'all': [
            ('r1S', 'End', '从开始到结束'),
            ('re1S', 'End', '从开始到结束'),
        ],
        'rest': [
            ('ret1S', 'End', '长静息态'),
        ],
        'rest_front': [
            ('r1S', 'r2E', '前静息态'),
             ('r2S', 'r3E', '3.5min后的前静息态'), 
        ],
        'rest_end': [
            ('FS', 'End', '后静息态')
        ],
        'say': [
            ('wt2S', 'FS', '说话任务'),
            ('wt3S', 'wt6E', '3.5min后的说话任务')

        ],
        'say_and_rest': [
            ('r1S', 'End', '3.5min静息后的完整说物范式'),
            ('r2S', 'End', '3.5min静息后的完整说物范式')
        ],
        'listen': [
            ('d1S', 'd3E', '听物任务')
        ],
        'raise': [
            ('ra2S', 'ra7E' or 'FS', '平举任务'),
            ('re2S', 'ra8E' or 'FS', '平举任务')
        ],
        'magic': [
            ('cb2S', 'cb5E'or 'FS', '魔方任务')
        ],
        'rest3.5': [
            ('rr1S', 'rr2E', '3.5min静息态')
        ],

    }
    
    if task_name not in TASK_EVENTS:
        print("任务名称错误")
        return None
    
    time_points = []
    started = None
    
    if islumo:
        tinterval = 1000//FS # 单位为ms，100ms为 1帧
    else:
        tinterval = 1 # 帧数
    
    # 遍历事件寻找任务起止点
    for event in processed_events:
        for start_mark, end_mark, desc in TASK_EVENTS[task_name]:
            if event['name'] == start_mark and started is None:
                start_time = int(event['Timestamp'])//tinterval 
                started = start_mark
            elif event['name'] == end_mark and started == start_mark:
                end_time = int(event['Timestamp'])//tinterval
                started = None
                print(f"{start_mark} -> {end_mark} 的{desc}：{start_time} -> {end_time}")
                time_points.append(start_time)
                time_points.append(end_time)
                if data is not None:
                    data = data[:,start_time:end_time]

    if not time_points:
        print(f'未找到 {task_name} 任务')
        return None
    if data is not None:
        return data
    return {'total':[start_time-30*FS,end_time+70*FS],'task':time_points}


# --- Copied BrainActivityAnalyzer and FunctionalConnectivityAnalyzer ---
class BrainActivityAnalyzer:
    def __init__(self, fs=10,wavelet='cmor1.5-1.0',freq=np.linspace(0.01,0.08,25),
                 left_channels = [243,109,113,301,279,350,234], # Default, might need adjustment based on info
                 right_channels = [408,45,41,19,385,313,64], logger_instance=None): # Default
        self.sampling_rate = fs
        self.wavelet = wavelet
        self.freq = freq
        self.left_channels = left_channels
        self.right_channels = right_channels
        self.logger = logger_instance or logging.getLogger(__name__)
        self.logger.info(f"BrainActivityAnalyzer initialized. Left: {self.left_channels}, Right: {self.right_channels}")

    def calculate_wavelet_amplitude(self, data, freq=None):
        if freq is None: freq = self.freq
        scales = pywt.frequency2scale(self.wavelet, freq) * self.sampling_rate
        try:
            coef, _ = pywt.cwt(data, scales, self.wavelet, sampling_period=1/self.sampling_rate,method='fft')
            return np.abs(coef), freq
        except Exception as e:
            self.logger.error(f"小波变换计算失败: {str(e)}")
            raise ValueError(f"小波变换计算失败: {str(e)}")

    def calculate_cortical_activity(self, signals, window_size=200):
        try:
            signals = signal.detrend(signals)
            if len(signals) < window_size : # Handle short signals
                if len(signals) == 0: return 0.0
                window_size = len(signals)

            n_windows = len(signals) // window_size
            if n_windows == 0: # If signal is shorter than window_size but not 0
                 windows = [signals]
            else:
                 windows = signals[:n_windows * window_size].reshape(n_windows, window_size)
            
            WAs = []
            for window_idx, window in enumerate(windows):
                if len(window) == 0: continue
                wa, _ = self.calculate_wavelet_amplitude(window)
                WAs.append(np.mean(wa, axis=1))
            
            return np.array(WAs).mean() if WAs else 0.0
            
        except Exception as e:
            self.logger.error(f"皮质活动计算失败: {str(e)}")
            raise ValueError(f"皮质活动计算失败: {str(e)}")
        
    def calculate_laterality(self, data, left_idx=None, right_idx=None):
        left_idx = left_idx if left_idx is not None else self.left_channels
        right_idx = right_idx if right_idx is not None else self.right_channels
        self.logger.info(f"Calculating laterality. Left idx: {left_idx}, Right idx: {right_idx}")
        
        # Filter out invalid channel indices
        valid_left_idx = [i for i in left_idx if i < data.shape[0]]
        valid_right_idx = [i for i in right_idx if i < data.shape[0]]

        if not valid_left_idx: self.logger.warning("No valid left channels for laterality.")
        if not valid_right_idx: self.logger.warning("No valid right channels for laterality.")

        try:
            with ThreadPoolExecutor() as executor:
                left_future = executor.submit(self._calculate_hemispheric_activity, data, valid_left_idx)
                right_future = executor.submit(self._calculate_hemispheric_activity, data, valid_right_idx)
                left_wa = left_future.result()
                right_wa = right_future.result()
            self.logger.info(f"Laterality calculated. Left WA: {left_wa.mean() if isinstance(left_wa, np.ndarray) else left_wa}, Right WA: {right_wa.mean() if isinstance(right_wa, np.ndarray) else right_wa}")
            return left_wa, right_wa
        except Exception as e:
            self.logger.error(f"偏侧化计算失败: {str(e)}")
            raise ValueError(f"偏侧化计算失败: {str(e)}")
    
    def _calculate_hemispheric_activity(self, data, channels):
        if not channels: return np.array([]) # Return empty array if no channels
        # Use memory view to potentially avoid data copying if underlying data is C-contiguous
        # data_view = data # Assuming data is already preprocessed as needed
        activities = []
        for channel_idx in channels:
            if channel_idx < data.shape[0]: # Double check index
                 activities.append(self.calculate_cortical_activity(data[channel_idx]))
            else:
                self.logger.warning(f"Channel index {channel_idx} out of bounds for data shape {data.shape}")
        return np.array(activities)


class FunctionalConnectivityAnalyzer:
    def __init__(self, fs=10,wavelet='cmor1.5-1.0',freq=np.linspace(0.01,0.08,25),
                left_channels=[243,109,113,301,279,350,234], right_channels=[408,45,41,19,385,313,64], logger_instance=None):
        self.sampling_rate = fs
        self.wavelet = wavelet
        self.freq = freq
        self.left_channels = left_channels
        self.right_channels = right_channels
        self.logger = logger_instance or logging.getLogger(__name__)
        self.logger.info(f"FunctionalConnectivityAnalyzer initialized. Left: {self.left_channels}, Right: {self.right_channels}")
          
    def calculate_phase_coherence(self, signal1, signal2, freq=None):
        if freq is None: freq = self.freq
        try:
            signal1_dt = signal.detrend(signal1)
            signal2_dt = signal.detrend(signal2)
            scales = pywt.frequency2scale(self.wavelet, freq) * self.sampling_rate
            coef1, _ = pywt.cwt(signal1_dt, scales, self.wavelet, sampling_period=1/self.sampling_rate,method='fft')
            coef2, _ = pywt.cwt(signal2_dt, scales, self.wavelet, sampling_period=1/self.sampling_rate,method='fft')
            phase_diff = np.angle(coef1) - np.angle(coef2)
            coherence = np.abs(np.mean(np.exp(1j * phase_diff), axis=1))
            return coherence, freq
        except Exception as e:
            self.logger.error(f"相位相干性计算失败: {str(e)}")
            raise ValueError(f"相位相干性计算失败: {str(e)}")

    def calculate_connectivity(self, hbo_data): # Removed left_channels, right_channels as params, use self.
        # Use self.left_channels and self.right_channels which are set during __init__
        # These might need to be updated based on actual channels from `info` if they are not fixed.
        # For now, assuming they are fixed or correctly passed to __init__.
        all_channels_indices = self.left_channels + self.right_channels
        
        # Filter out invalid channel indices from all_channels_indices based on hbo_data shape
        valid_channels_indices = [idx for idx in all_channels_indices if idx < hbo_data.shape[0]]
        if len(valid_channels_indices) < 2:
            self.logger.warning("Not enough valid channels to calculate connectivity matrix.")
            return np.array([]) # Return empty or handle appropriately

        n_channels = len(valid_channels_indices)
        connectivity_matrix = np.ones((n_channels, n_channels))
        
        # Map original indices to new matrix indices if some channels were filtered out
        original_to_matrix_idx_map = {orig_idx: new_idx for new_idx, orig_idx in enumerate(valid_channels_indices)}

        try:
            # Select data for valid channels only
            nirs_data_valid_channels = hbo_data[valid_channels_indices, :]
            nirs_data_detrended = signal.detrend(nirs_data_valid_channels) # Detrend selected channels
            
            channel_pairs = list(combinations(range(n_channels), 2)) # Use new indices (0 to n_channels-1)
            pair_data = [(i,j, nirs_data_detrended[i], nirs_data_detrended[j]) for i, j in channel_pairs]
            
            n_cores = max(1, int(os.cpu_count() * 0.9 if os.cpu_count() else 1))
            with ProcessPoolExecutor(max_workers=n_cores) as executor:
                # tqdm might not be ideal for a library, consider removing or making optional
                results = list(tqdm(
                    executor.map(self._calculate_channel_pair_connectivity, pair_data),
                    total=len(pair_data),
                    desc="Calculating Functional Connectivity" 
                ))
            
            for i, j, mean_wpco in results:
                connectivity_matrix[i,j] = connectivity_matrix[j,i] = mean_wpco
  
            return connectivity_matrix
                
        except Exception as e:
            self.logger.error(f"功能连接计算失败: {str(e)}")
            raise ValueError(f"功能连接计算失败: {str(e)}")

    def _calculate_channel_pair_connectivity(self,args):
        i,j, signal1_data, signal2_data = args
        coherence, _ = self.calculate_phase_coherence(signal1_data, signal2_data)
        return i, j, np.mean(coherence)
  
    def _load_or_calculate_connectivity(self, hbo_data=None, data_file_path=None):
        # data_file_path is used to generate fc_path (e.g., dir of .LUMO or .mat file)
        if data_file_path is None:
            self.logger.warning("data_file_path is None, cannot determine path for cached FC matrix.")
            fc_path = None
        else:
            base_path = os.path.dirname(data_file_path) if data_file_path.endswith(('.mat', '.nirs')) else data_file_path
            fc_path = os.path.join(base_path, "fc_cli.npy") # Use a different name for CLI version
        
        try:
            if fc_path and os.path.exists(fc_path):
                # Add logic to confirm if recalculation is needed, or just load
                fc_matrix = np.load(fc_path)
                self.logger.info(f'加载已存在的功能连接矩阵: {fc_path}, mean={fc_matrix.mean(axis=1) if fc_matrix.size > 0 else "empty"}')
                return fc_matrix
            
            if hbo_data is None:
                self.logger.error("hbo_data is None, cannot calculate connectivity.")
                raise ValueError("hbo_data is required to calculate connectivity if not loading from cache.")

            fc_matrix = self.calculate_connectivity(hbo_data) # Uses self.left_channels, self.right_channels
            
            if fc_path and fc_matrix.size > 0 : # Only save if path is valid and matrix is not empty
                os.makedirs(os.path.dirname(fc_path), exist_ok=True)
                np.save(fc_path, fc_matrix)
                self.logger.info(f'计算并保存新的功能连接矩阵: {fc_path}, mean={fc_matrix.mean(axis=1)}')
            elif fc_matrix.size == 0:
                 self.logger.warning("Calculated FC matrix is empty, not saving.")
            
            return fc_matrix
            
        except Exception as e:
            self.logger.error(f"功能连接矩阵处理失败: {str(e)}")
            raise

    def _extract_connectivity_metrics(self, fc_matrix:np.ndarray):
        # n_left_channels needs to be determined based on self.left_channels
        # that were *actually used* in fc_matrix calculation (i.e., valid ones)
        # This is tricky if fc_matrix was loaded and we don't know its original channel list.
        # Assuming fc_matrix corresponds to self.left_channels + self.right_channels (valid ones)
        # For simplicity, assuming self.left_channels has the count of left channels in the fc_matrix
        # This might require fc_matrix to be generated with a known structure or passing channel info.
        
        # To make it more robust: determine n_left_channels based on the *valid* left channels
        # that would have contributed to the fc_matrix if it was just calculated.
        # This is still an approximation if loading a cached matrix.
        # A better way would be to save channel info with fc_matrix.
        
        # Simplification: use length of self.left_channels, assuming they are all valid and present in order.
        n_left_channels_in_fc = len(self.left_channels) # This is an assumption.
        
        if fc_matrix.size == 0:
            self.logger.warning("FC matrix is empty, cannot extract metrics.")
            return np.array([]), np.array([]), np.array([]), np.array([])

        n_total_in_fc = fc_matrix.shape[0]
        if n_left_channels_in_fc > n_total_in_fc :
             self.logger.warning(f"n_left_channels ({n_left_channels_in_fc}) > fc_matrix dim ({n_total_in_fc}). Adjusting.")
             n_left_channels_in_fc = n_total_in_fc // 2 # Fallback

        try:
            if n_total_in_fc == 0: return (np.array([]),np.array([]),np.array([]),np.array([]))
            
            # Ensure indices are within bounds
            ll_slice_rows = slice(0, min(n_left_channels_in_fc, n_total_in_fc))
            ll_slice_cols = slice(0, min(n_left_channels_in_fc, n_total_in_fc))
            
            lr_slice_rows = slice(0, min(n_left_channels_in_fc, n_total_in_fc))
            lr_slice_cols = slice(min(n_left_channels_in_fc, n_total_in_fc), n_total_in_fc)
            
            rr_slice_rows = slice(min(n_left_channels_in_fc, n_total_in_fc), n_total_in_fc)
            rr_slice_cols = slice(min(n_left_channels_in_fc, n_total_in_fc), n_total_in_fc)

            rl_slice_rows = slice(min(n_left_channels_in_fc, n_total_in_fc), n_total_in_fc)
            rl_slice_cols = slice(0, min(n_left_channels_in_fc, n_total_in_fc))


            LL_matrix = fc_matrix[ll_slice_rows, ll_slice_cols]
            LR_matrix = fc_matrix[lr_slice_rows, lr_slice_cols]
            RR_matrix = fc_matrix[rr_slice_rows, rr_slice_cols]
            RL_matrix = fc_matrix[rl_slice_rows, rl_slice_cols]
            
            # Avoid division by zero if only one channel in a hemisphere
            ll_sum = (LL_matrix.sum(axis=1) - np.diag(LL_matrix)) / (LL_matrix.shape[1] - 1) if LL_matrix.shape[1] > 1 else np.zeros(LL_matrix.shape[0])
            rr_sum = (RR_matrix.sum(axis=1) - np.diag(RR_matrix)) / (RR_matrix.shape[1] - 1) if RR_matrix.shape[1] > 1 else np.zeros(RR_matrix.shape[0])

            lr_mean = LR_matrix.mean(axis=1) if LR_matrix.size > 0 else np.zeros(LR_matrix.shape[0])
            rl_mean = RL_matrix.mean(axis=1) if RL_matrix.size > 0 else np.zeros(RL_matrix.shape[0])
            
            return ll_sum, lr_mean, rr_sum, rl_mean
            
        except Exception as e:
            self.logger.error(f"连接性指标提取失败: {str(e)}")
            raise

def analyze_brain_state(wa_l, wa_r, LL, LR, RR, RL, wa_threshold=0.1,fc_threshold=0.05, logger_instance=None):
    logger = logger_instance or logging.getLogger(__name__)
    
    wa_l_mean = wa_l.mean() if isinstance(wa_l, np.ndarray) and wa_l.size > 0 else 0
    wa_r_mean = wa_r.mean() if isinstance(wa_r, np.ndarray) and wa_r.size > 0 else 0
    ll_mean = LL.mean() if isinstance(LL, np.ndarray) and LL.size > 0 else 0
    lr_mean = LR.mean() if isinstance(LR, np.ndarray) and LR.size > 0 else 0
    rr_mean = RR.mean() if isinstance(RR, np.ndarray) and RR.size > 0 else 0
    rl_mean = RL.mean() if isinstance(RL, np.ndarray) and RL.size > 0 else 0

    metrics = {
        'wa_mean': (wa_r_mean + wa_l_mean) / 2 if (wa_r_mean + wa_l_mean) != 0 else 0,
        'wa_laterality': (wa_r_mean - wa_l_mean) / (wa_r_mean + wa_l_mean) if (wa_r_mean + wa_l_mean) != 0 else 0,
        'fc_laterality': (rr_mean - ll_mean) / (rr_mean + ll_mean) if (rr_mean + ll_mean) != 0 else 0,
        'left_autonomy': ll_mean - lr_mean,
        'right_autonomy': rr_mean - rl_mean
    }
    
    activity_desc = "左右前额叶皮质活动程度相当"
    if metrics['wa_laterality'] > wa_threshold: activity_desc = "右前额叶皮质活动更强"
    elif metrics['wa_laterality'] < -wa_threshold: activity_desc = "左前额叶皮质活动更强"
    
    connectivity_desc = "左右前额叶区连接模式待分析"
    if metrics['left_autonomy'] > 0 and metrics['right_autonomy'] > 0:
        connectivity_desc = "左右前额叶区均表现出较强的功能独立性"
    elif metrics['left_autonomy'] < 0 and metrics['right_autonomy'] < 0:
        connectivity_desc = "左右前额叶区呈现明显的协同作用"
    else:
        if metrics['left_autonomy'] > 0: connectivity_desc = "左前额叶区表现出较强的功能独立性，右前额叶区倾向于协同"
        else: connectivity_desc = "右前额叶区表现出较强的功能独立性，左前额叶区倾向于协同"
    
    integration = "左右前额叶区整体表现均衡"
    if abs(metrics['wa_laterality']) > wa_threshold:
        integration = f"{activity_desc}，且功能连接也呈现明显的偏侧化" if abs(metrics['fc_laterality']) > fc_threshold else f"{activity_desc}，但功能连接的偏侧化不明显"
    else:
        integration = "皮质活动强度相当，但功能连接呈现偏侧化" if abs(metrics['fc_laterality']) > fc_threshold else "左右前额叶区整体表现均衡"
    
    logger.info(f"Brain state analysis: WA Lat={metrics['wa_laterality']:.4f}, FC Lat={metrics['fc_laterality']:.4f}, Integration: {integration}")
    return {
        'metrics': metrics,
        'activity_description': activity_desc,
        'connectivity_description': connectivity_desc,
        'integration': integration
    }
# --- End of copied Analyzers ---


class NIRSReportGeneratorCLI:
    def __init__(self, user_info, file_path, filter_enabled=True, tddr_enabled=True, 
                 fc_enabled=False, laterality_enabled=False, description=""):
        setup_matplotlib_fonts()
        self.logger = setup_logger() # Uses default "logs_cli" sub-directory

        self.user_info = user_info # dict: {'name': '', 'id': '', 'gender': '', 'age': ''}
        self.file_path = file_path
        self.description_input_text = description

        self.filter_enabled = filter_enabled
        self.tddr_enabled = tddr_enabled
        self.fc_enabled = fc_enabled
        self.laterality_enabled = laterality_enabled

        self.figures = []
        self.analyses = []
        self.info = None # Will be loaded
        self.data = None # Will be loaded
        self.events = None # Will be loaded
        self.temp_img_dir = None

        # Default channel lists for analyzers, can be overridden if info provides specific ones
        # These defaults are from the original BrainActivityAnalyzer/FunctionalConnectivityAnalyzer
        # It might be better to extract these from self.info if available and relevant
        self.default_left_channels = [243,109,113,301,279,350,234]
        self.default_right_channels = [408,45,41,19,385,313,64]


    def preprocess_nirs_data(self, data_segment, current_info):
        """数据预处理，适配CLI选项"""
        wavelengths = np.unique(current_info['pairs']['lamda'])
        if len(wavelengths) == 3: # Handle 3-wavelength data
            self.logger.info("Detected 3 wavelengths, selecting 1st and 3rd.")
            channels_per_wavelength = data_segment.shape[0] // 3
            data_segment = np.vstack([
                data_segment[:channels_per_wavelength],
                data_segment[2*channels_per_wavelength:]
            ])
        
        #将data_segment中的0值替换为1e-10
        data_segment[data_segment == 0] = 1e-8 
        od_data = intensity2optical_density(data_segment)
        
        # ppf might need to be configurable or derived from info
        ppf = [6, 6] # Default from original code
        conc_data = od2conc(od_data, wavelengths, current_info, ppf)
        
        hbo_data_processed = conc_data['HbO']
        hbr_data_processed = conc_data['HbR']

        if self.tddr_enabled:
            self.logger.info("Applying TDDR motion correction.")
            hbo_data_processed = TDDR_motion_correction(hbo_data_processed, FS)
            hbr_data_processed = TDDR_motion_correction(hbr_data_processed, FS)
        
        if self.filter_enabled:
            self.logger.info("Applying bandpass filter.")
            # Filter parameters from original code
            processed_filtered_data = nr_filter(
                {'HbO': hbo_data_processed, 'HbR': hbr_data_processed},
                filter_method='FFT', filter_model=2, filter_order=3,
                hpf=0.01/FS, lpf=0.1/FS, sample_rate=FS
            )
            hbo_data_processed = processed_filtered_data['HbO']
            hbr_data_processed = processed_filtered_data['HbR']
        
        return hbo_data_processed, hbr_data_processed

    # def get_pulse_times_wrapper(self, current_events):
    #     """Wraps get_pulse_times for easier calling, using self.logger"""
    #     # This method might seem redundant but centralizes passing the logger
    #     if isinstance(current_events, str): # Path to events.toml
    #         if os.path.exists(os.path.join(current_events, "events.toml")):
    #             loaded_events_data = toml.load(os.path.join(current_events, "events.toml"))
    #             processed_events_list = merge_events(loaded_events_data.get("events", []))
    #         else: # Path to a toml file directly
    #              loaded_events_data = toml.load(current_events)
    #              processed_events_list = merge_events(loaded_events_data.get("events", []))
    #     elif isinstance(current_events, dict) and "events" in current_events: # dict containing events list
    #         processed_events_list = merge_events(current_events["events"])
    #     elif isinstance(current_events, list): # Already a list of event dicts
    #         processed_events_list = merge_events(current_events)
    #     else:
    #         self.logger.error(f"Events data type error: {type(current_events)}")
    #         return None, None

    #     # Define task types to iterate through
    #     task_keys = ['all', 'say', 'listen', 'raise', 'magic'] # 'all' is custom, others are paradigms
    #     pulse_names_list = ['全部时间', '说物范式期间', '分听范式期间', '平举范式期间', '魔方范式期间']
    #     pulse_times_list = []

    #     # For 'all' task, use total data length if self.data is available
    #     if 'all' in task_keys and self.data is not None:
    #          pulse_times_list.append({'total': [0, self.data.shape[1]], 'task': [0, 0]}) # task [0,0] for 'all' means no specific sub-task duration
    #     else: # If self.data not yet loaded, or 'all' not first, this might be problematic.
    #          pulse_times_list.append(None) # Placeholder if 'all' cannot be determined

    #     for task_key in task_keys[1:]: # Skip 'all' as it's handled
    #         task_data = get_task_point_data(processed_events_list, task_name=task_key, logger_instance=self.logger)
    #         pulse_times_list.append(task_data)
            
    #     return pulse_times_list, pulse_names_list


    def get_pulse_times(self,events,islumo):
        processed_events = merge_events(events, islumo)
        print("processed_events",processed_events)
        # 获取全部时间
        pulse0_times = {'total':[0,len(self.data[0])],'task':[0,0]}
        #获取说物之间的时间段
        pulse1_times = get_task_point_data(processed_events, islumo, task_name='say')
        # 获取分听的时间段
        pulse2_times = get_task_point_data(processed_events, islumo, task_name='listen')
        # 获取平举的时间段
        pulse3_times = get_task_point_data(processed_events, islumo, task_name='raise')
        # 获取玩魔方的时间段
        pulse4_times = get_task_point_data(processed_events, islumo, task_name='magic')


        return [pulse0_times,pulse1_times,pulse2_times,pulse3_times,pulse4_times],['全部时间','说物范式期间','分听范式期间','平举范式期间','魔方范式期间']

    def handle_results(self, pulse_times, pulse_names):
        """处理数据处理结果"""
        try:
            self.figures = []
            self.analyses = []
            
            for idx, pulsetime in enumerate(pulse_times):
                if pulsetime is None:
                    continue
                
                fig = plt.figure(figsize=(12, 6))
                gs = gridspec.GridSpec(1, 2, width_ratios=[4, 3])
                
                data = self.data[:, pulsetime['total'][0]:pulsetime['total'][1]]
                hbo_data, hbr_data = self.preprocess_nirs_data(data, self.info)
                
                ax1 = fig.add_subplot(gs[0])
                current_pulsetime = self.plot_concentration_curves(ax1, hbo_data, hbr_data, 
                                                                self.info, pulsetime, pulse_names[idx])
                
                gs_right = gridspec.GridSpecFromSubplotSpec(2, 1, subplot_spec=gs[1])
                ax2_top = fig.add_subplot(gs_right[0])
                ax2_bottom = fig.add_subplot(gs_right[1])
                
                if len(current_pulsetime) == 2 and current_pulsetime[0] != current_pulsetime[1] and current_pulsetime[0] != 0:
                    start_time, end_time = current_pulsetime
                    hbo_values = np.mean(hbo_data[:, start_time:end_time], axis=1)
                    hbr_values = np.mean(hbr_data[:, start_time:end_time], axis=1)
                else:
                    hbo_values = np.mean(hbo_data, axis=1)
                    hbr_values = np.mean(hbr_data, axis=1)
                
                self.create_nirs_topograph(self.info, hbo_values, ax2_top, '含氧血红蛋白变化情况')
                self.create_nirs_topograph(self.info, hbr_values, ax2_bottom, '脱氧血红蛋白变化情况')
                
                fig.tight_layout()
                self.figures.append(fig)
                
                # 根据选项执行分析
                analysis = {'name': pulse_names[idx]}
                
                if self.laterality_enabled or self.fc_enabled:
                    if not self.path_input.text().endswith('.LUMO'):
                        savepath = self.path_input.text().split('.')[0]
                    else:
                        savepath = self.path_input.text()
                    
                    laterality_report = []
                    brain_metrics = {}
                    
                    # 执行偏侧化分析
                    if self.laterality_enabled:
                        activity_analyzer = BrainActivityAnalyzer()
                        left_wa, right_wa = activity_analyzer.calculate_laterality(hbo_data)
                        wa_mean = (right_wa.mean() + left_wa.mean()) / 2
                        wa_laterality = (right_wa.mean() - left_wa.mean()) / (right_wa.mean() + left_wa.mean())
                        
                        if abs(wa_laterality) > 0.1:
                            activity_desc = "右前额叶皮质活动更强" if wa_laterality > 0 else "左前额叶皮质活动更强"
                        else:
                            activity_desc = "左右前额叶皮质活动程度相当"
                        
                        laterality_report.append(f"皮质活动强度的偏侧化指数：{wa_laterality:.4f} -> {activity_desc}")
                        brain_metrics.update({
                            'wa_mean': wa_mean,
                            'wa_laterality': wa_laterality,
                            'activity_description': activity_desc
                        })
                    
                    # 执行功能连接分析
                    if self.fc_enabled:
                        connectivity_analyzer = FunctionalConnectivityAnalyzer()
                        fc_matrix = connectivity_analyzer._load_or_calculate_connectivity(hbo_data, savepath)
                        LL, LR, RR, RL = connectivity_analyzer._extract_connectivity_metrics(fc_matrix)
                        
                        left_autonomy = LL.mean() - LR.mean()
                        right_autonomy = RR.mean() - RL.mean()
                        fc_laterality = (RR.mean() - LL.mean()) / (RR.mean() + LL.mean())
                        
                        if left_autonomy > 0 and right_autonomy > 0:
                            connectivity_desc = "左右前额叶区均表现出较强的功能独立性"
                        elif left_autonomy < 0 and right_autonomy < 0:
                            connectivity_desc = "左右前额叶区呈现明显的协同作用"
                        else:
                            connectivity_desc = ("左前额叶区表现出较强的功能独立性，右前额叶区倾向于协同" 
                                               if left_autonomy > 0 
                                               else "右前额叶区表现出较强的功能独立性，左前额叶区倾向于协同")
                        
                        laterality_report.append(
                            f"左前额叶自主性：{left_autonomy:.4f},右前额叶自主性：{right_autonomy:.4f},"
                            f"功能连接偏侧化指数：{fc_laterality:.4f} -> {connectivity_desc}"
                        )
                        brain_metrics.update({
                            'fc_laterality': fc_laterality,
                            'left_autonomy': left_autonomy,
                            'right_autonomy': right_autonomy,
                            'connectivity_description': connectivity_desc
                        })
                    
                    # 生成综合分析结果
                    if self.laterality_enabled and self.fc_enabled:
                        # 完整的脑状态分析
                        brain_state = analyze_brain_state(left_wa, right_wa, LL, LR, RR, RL)
                        integration = brain_state['integration']
                    else:
                        # 根据可用的分析生成简化的综合结果
                        if self.laterality_enabled:
                            integration = f"{activity_desc}，整体活动水平正常"
                        elif self.fc_enabled:
                            integration = f"{connectivity_desc}，功能连接模式正常"
                    
                    brain_metrics['integration'] = integration
                    analysis.update({
                        'report': '\n'.join(laterality_report),
                        'analysis': brain_metrics
                    })

                self.analyses.append(analysis)
                
        except Exception as e:
            print(f"处理生成报告数据时出错: {str(e)}")
            traceback.print_exc()

    def plot_concentration_curves(self, ax, hbo_data, hbr_data, info, pulsetime, pulse_names):
        """
        绘制血红蛋白浓度变化曲线，包含距离筛选和时间段标记
        
        Parameters:
        -----------
        ax : matplotlib.axes.Axes
            绘图区域
        hbo_data : ndarray
            HbO数据
        hbr_data : ndarray
            HbR数据
        info : dict
            包含实验信息的字典
        """
        try:
            # 选择合适距离的通道
            stable_channels = [301,235,280,351,132,271,295,89] + [335,376,403,357,20,387,315,65]     
           
            stable_channels = self.select_channels(mode='channel_distance',channel_idxs=range(len(hbo_data)),channel_distance=self.info['pairs']['r3d'],distance_range=[25,35])
            stable_channels = self.select_channels(mode='channel_snr',channel_idxs=stable_channels,signal1=self.data[0:len(self.data)//2],top_n=30)
            selected_channels = self.select_channels(mode='signal_couple',channel_idxs=stable_channels,signal1=self.data[0:len(self.data)//2],signal2=self.data[len(self.data)//2:],top_n=15)
            if not selected_channels:
                ax.text(0.5, 0.5, '没有找到信噪比合适的通道\n(28-32mm)',
                    ha='center', va='center', transform=ax.transAxes)
                return [pulsetime['task'][0]-pulsetime['total'][0],pulsetime['task'][1]-pulsetime['total'][0]]
            else:
                print('selected_channels:',selected_channels)
            # 获取数据
            hbo_selected = hbo_data[selected_channels]
            hbr_selected = hbr_data[selected_channels]
            # print(hbo_selected.shape)

            hbo_mean = np.mean(hbo_selected, axis=0)
            hbr_mean = np.mean(hbr_selected, axis=0)
            
            # 计算总血红蛋白
            hbt_mean = hbo_mean + hbr_mean
            
            # 获取时间轴
            sample_rate = info['system']['framerate']
            # time = np.arange(len(hbo_mean)) / sample_rate
            # start = max(0,pulse_times[0]-300)
            # if pulse_times[1] == -1:
            #     end = len(hbo_mean)
            # else:
            #     end = min(len(hbo_mean),pulse_times[1]+700)
            start = pulsetime['total'][0]
            end = pulsetime['total'][1]
            # 绘制曲线
            ax.plot(np.arange(start,end)/FS, hbo_mean, 'r-', label='HbO', linewidth=2, alpha=0.5)
            ax.plot(np.arange(start,end)/FS, hbr_mean, 'b-', label='HbR', linewidth=2, alpha=0.5)
            ax.plot(np.arange(start,end)/FS, hbt_mean, 'g-', label='HbT', linewidth=2, alpha=0.5)
            
            # # 获取r3E之后和FS之前的时间段
            # pulse_times = self.get_pulse_times(hbo_data.shape[1], info, lumo_dir)
            # print(pulse_times)


            if len(pulsetime['task']) == 2 and pulsetime['task'][0] != pulsetime['task'][1] and pulsetime['task'][0] != 0:
                
                start_frame = pulsetime['task'][0]
                end_frame = pulsetime['task'][1]
                
                start_time = start_frame / sample_rate
                end_time = end_frame / sample_rate
                # 添加绿色半透明区域标记
                ax.axvspan(start_time, end_time, color='r', alpha=0.08)
                
            # 设置图表属性
            ax.set_xlabel('时间 (s)')
            ax.set_ylabel('浓度变化 (μmol/L)')
            ax.legend(loc='upper right')
            # ax.grid(True, alpha=0.3)
            
            # 添加标题，显示选中的通道数
            ax.set_title(f'{pulse_names}血红蛋白浓度变化')

            return [pulsetime['task'][0]-pulsetime['total'][0],pulsetime['task'][1]-pulsetime['total'][0]]
            
        except Exception as e:
            self.logger.error(f"Error plotting concentration curves: {e}")
            traceback.print_exc()
            ax.text(0.5, 0.5, '绘图错误\n请检查数据',
                    ha='center', va='center', transform=ax.transAxes)
            return None

    def select_channels(self,mode,channel_idxs,**kwargs):
        '''
        根据不同条件选择通道
        mode:
            channel_distance: 根据通道距离选择
            signal_couple: 根据信号耦合选择
            channel_std: 根据通道标准差选择
        channel_idxs: 通道索引
        kwargs: 参数
            当mode为channel_distance时，需要输入channel_distance（shape：(channel_num,1)）和distance_range（[min,max]）
             当mode为signal_couple时，需要输入signal1,signal2,top_n（返回信号耦合指数前top_n个通道的索引）
            当mode为channel_std时，需要输入channel_std（shape：(channel_num,1)）
        return: 选择的通道索引
        '''
        if mode == 'channel_distance':
            assert 'channel_distance' in kwargs,'请输入通道距离: channel_distance = ?'
            assert 'distance_range' in kwargs,'请输入距离范围: distance_range = ?'
            channel_distance = kwargs['channel_distance']
            distance_range = kwargs['distance_range']
            selected_idxs = np.where((distance_range[1] >= channel_distance[channel_idxs]) & (distance_range[0] <= channel_distance[channel_idxs]))[0]
            return selected_idxs
        elif mode == 'signal_couple':
            assert 'signal1' in kwargs,'请输入信号1: signal1 = ?'
            assert 'signal2' in kwargs,'请输入信号2: signal2 = ?'
            assert 'top_n' in kwargs,'请输入top_n: top_n = ?'
            signals1 = kwargs['signal1']
            signals2 = kwargs['signal2']
            top_n = kwargs['top_n']
            signal_couples = []
            for idx in channel_idxs:
                sci = compute_phoebe(signals1[idx],signals2[idx])
                if sci > 0.65:
                    signal_couples.append((idx,sci))
            signal_couples = sorted(signal_couples,key=lambda x:x[1],reverse=True)
            return [x[0] for x in signal_couples[:top_n]]
        elif mode == 'channel_snr':
            assert 'signal1' in kwargs,'请输入信号1: signal1 = ?'
            assert 'top_n' in kwargs,'请输入top_n: top_n = ?'
            signals1 = kwargs['signal1']
            top_n = kwargs['top_n']
            # 添加SNR计算
            b, a = signal.butter(3, 0.1)
            snr_values = []
            snr2 = []
            for idx in channel_idxs:
                trend = signal.filtfilt(b, a, signals1[idx])
                noise = signals1[idx] - trend
                snr = np.var(trend) / np.var(noise)
                snr_db = 10 * np.log10(snr)
                if snr_db > -10:
                    snr_values.append((idx, snr_db))
                    if snr_db > 0:
                        snr2.append((idx, snr_db))
            if len(snr2) >= 10:
                snr_values = snr2
            # 按SNR排序并返回前top_n个通道
            snr_values.sort(key=lambda x: x[1], reverse=True)
            print('channel snr_values:',snr_values)
            return [idx for idx, _ in snr_values[:top_n]]
        else: 
            print('筛选通道的方式错误')
            return None

    def create_nirs_topograph(self, info, channel_values, ax, title='NIRS Topograph'):
        """
        创建NIRS热力图
        
        Parameters:
        -----------
        info : dict
            包含source和detector位置信息的字典
        channel_values : array-like
            每个通道的值
        ax : matplotlib.axes.Axes, optional
            绘图轴，如果为None则创建新的
        title : str
            图表标题
        """
        # if ax is None:
        #     fig, ax = plt.subplots(figsize=(10, 8))
        
        # 设置图形范围
        radius = 1
        ax.set_xlim(-1.5, 1.5)
        ax.set_ylim(-1.5, 1.5)
        
        # 绘制头部轮廓
        # 圆形（头部）
        head = Circle((0, 0), radius, fill=False, color='black', linewidth=2)
        ax.add_patch(head)
        
        ax.plot(0, 1.1, marker='^', color='black', markersize=15, 
            markerfacecolor='none', markeredgewidth=2, clip_on=False)
        
        # 耳朵（使用椭圆）
        from matplotlib.patches import Ellipse
        left_ear = Ellipse((-1.1, 0), 0.2, 0.4, angle=0, 
                        fill=False, edgecolor='black', linewidth=2)
        right_ear = Ellipse((1.1, 0), 0.2, 0.4, angle=0, 
                        fill=False, edgecolor='black', linewidth=2)
        ax.add_patch(left_ear)
        ax.add_patch(right_ear)
        
        # 筛选合适的通道
        selected_channels = self.select_channels_for_topograph(info)
        
        # 获取通道位置
        sources = info['optodes']['spos2']
        detectors = info['optodes']['dpos2']
        channel_positions = []
        selected_values = []
        
        for ch_idx in selected_channels:
            if channel_values[ch_idx] == 0 or np.any(np.isnan(channel_values[ch_idx])):
                continue
            source_idx = info['pairs']['Src'][ch_idx]-1
            detector_idx = info['pairs']['Det'][ch_idx]-1
            x = (sources[source_idx][0] + detectors[detector_idx][0]) / 2
            y = (sources[source_idx][1] + detectors[detector_idx][1]) / 2
            channel_positions.append([x, y])
            selected_values.append(channel_values[ch_idx])
        
        channel_positions = np.array(channel_positions)
        selected_values = np.array(selected_values)
        
        # 自动计算缩放和位置调整
        # 找到通道位置的范围
        x_min, x_max = np.min(channel_positions[:, 0]), np.max(channel_positions[:, 0])
        y_min, y_max = np.min(channel_positions[:, 1]), np.max(channel_positions[:, 1])
        
        # 计算中心点和范围
        x_center = (x_max + x_min) / 2
        y_center = (y_max + y_min) / 2
        x_range = x_max - x_min
        y_range = y_max - y_min
        
        base_scale = 0.7
        # 计算缩放因子（确保数据在圆内，并留有边距）
        scale = base_scale * 2 / max(x_range, y_range)  # 0.7为缩放系数，可调整
        
        # 调整位置（将前额叶区域移到靠近鼻子的位置）
        y_offset = 0.5  # 向上偏移量，可调整
        
        # 应用缩放和偏移
        channel_positions = (channel_positions - [x_center, y_center]) * scale
        channel_positions[:, 1] += y_offset  # 向上偏移
        
        # # 创建插值网格
        # grid_x, grid_y = np.mgrid[-1:1:200j, -1:1:200j]
        # grid_values = griddata(channel_positions, selected_values, 
        #                       (grid_x, grid_y), method='cubic')
        
        # 分析通道位置分布来决定热力图形状
        positions_std = np.std(channel_positions, axis=0)
        aspect_ratio = positions_std[0] / positions_std[1]
        
        # 创建前额叶区域的圆形mask
        # 计算mask中心位置（靠近额头位置）
        mask_center_y = 0.3  # 向上偏移
        mask_radius = 0.3    # 调整大小
        
        # 归一化位置坐标到[-1, 1]范围
        max_coord = np.max(np.abs(channel_positions))
        channel_positions = channel_positions / max_coord
        
        # 创建插值网格和热力图    缩放大小 -1:1  -1:1  -0.7:0.7  -0.7:0.7
        grid_x, grid_y = np.mgrid[-0.75:0.85:500j, -0.75:0.85:500j]
        grid_values = griddata(channel_positions, selected_values, 
                            (grid_x, grid_y), method='cubic')
        
        # # 创建圆形mask
        # mask = (grid_x**2 + grid_y**2) <= 1

        from scipy.ndimage import gaussian_filter
        
        # Create smooth circular mask with anti-aliasing
        y, x = np.ogrid[-0.85:0.85:500j, -0.85:0.85:500j]
        mask_radius = 0.65  # Slightly smaller than the grid to ensure containment
        # mask = x*x + y*y <= mask_radius*mask_radius   
        mask = (grid_x**2 + (grid_y-mask_center_y)**2) <= mask_radius**2 

        # Apply Gaussian smoothing
        sigma = 3.0  # Adjust this value to control smoothing amount
        grid_values = gaussian_filter(grid_values, sigma)

        # Create smooth transition at the edges
        mask_smooth = gaussian_filter((mask).astype(float), sigma=2.0)
        mask_smooth = mask_smooth / mask_smooth.max()  # Normalize
        grid_values = grid_values * mask_smooth
        grid_values[~mask] = np.nan  # Set outside values to NaN

        # 绘制热力图
        im = ax.imshow(grid_values.T, origin='lower', 
                    extent=[-0.85, 0.85, -0.85, 0.85], 
                    cmap='jet',
                    aspect='equal',
                    interpolation='gaussian',
                    filternorm=True,
                    resample=True)
        
        # 添加颜色标尺
        plt.colorbar(im, ax=ax)
        
        # 设置标题和其他属性
        ax.set_title(title)
        ax.axis('off')
        
        return ax

    def select_channels_for_topograph(self, info, target_distance=30):
        """
        筛选合适的通道用于热力图绘制
        
        Parameters:
        -----------
        info : dict
            包含通道信息的字典
        target_distance : float
            目标距离（毫米），默认30mm
        
        Returns:
        --------
        list
            选中通道的索引列表
        """
        sources = info['optodes']['spos2']
        detectors = info['optodes']['dpos2']
        selected_channels = []
        
        # 计算所有通道的距离和位置
        channels_info = []
        for ch_idx in range(len(info['pairs']['Src'])):
            source_idx = info['pairs']['Src'][ch_idx]-1
            detector_idx = info['pairs']['Det'][ch_idx]-1
            
            # 计算source和detector之间的距离
            dx = sources[source_idx][0] - detectors[detector_idx][0]
            dy = sources[source_idx][1] - detectors[detector_idx][1]
            dz = sources[source_idx][2] - detectors[detector_idx][2]
            distance = np.sqrt(dx**2 + dy**2 + dz**2)
            
            # 计算通道中点位置
            x = (sources[source_idx][0] + detectors[detector_idx][0]) / 2
            y = (sources[source_idx][1] + detectors[detector_idx][1]) / 2
            
            channels_info.append({
                'index': ch_idx,
                'distance': distance,
                'position': (x, y),
                'source': source_idx,
                'detector': detector_idx
            })
        
        # 按距离接近30mm的程度排序
        channels_info.sort(key=lambda x: abs(x['distance'] - target_distance))
        
        # 筛选通道，避免重叠
        used_positions = set()
        position_threshold = 10  # 毫米，用于判断通道是否重叠
        
        for channel in channels_info:
            # 检查是否与已选通道重叠
            is_overlapping = False
            for used_pos in used_positions:
                dx = channel['position'][0] - used_pos[0]
                dy = channel['position'][1] - used_pos[1]
                if np.sqrt(dx**2 + dy**2) < position_threshold:
                    is_overlapping = True
                    break
            
            if not is_overlapping:
                selected_channels.append(channel['index'])
                used_positions.add(channel['position'])
        
        return selected_channels

    def generate_cli_report(self, output_pdf_path):
        """生成报告的核心逻辑（CLI版）"""
        temp_main_dir = None
        node_num = 6
        try:
            # Use a sub-directory in the output PDF's directory for temp images
            output_dir = os.path.dirname(output_pdf_path)
            if not output_dir: output_dir = "." # If output_pdf_path is just a filename
            os.makedirs(output_dir, exist_ok=True)

            temp_main_dir = tempfile.mkdtemp(dir=output_dir, prefix="nirs_report_temp_")
            self.temp_img_dir = os.path.join(temp_main_dir, "images")
            os.makedirs(self.temp_img_dir, exist_ok=True)
            
            self.logger.info(f"开始生成报告，数据路径: {self.file_path}")
            self.logger.info(f"用户信息: {self.user_info}")
            self.logger.info(f"选项: Filter={self.filter_enabled}, TDDR={self.tddr_enabled}, FC={self.fc_enabled}, Laterality={self.laterality_enabled}")

            # 加载数据
            if self.file_path.lower().endswith('.lumo'):
                self.info, self.data = lumo2ndot(self.file_path)
                events_toml_path = os.path.join(self.file_path, "events.toml")
                if os.path.exists(events_toml_path):
                    self.events = toml.load(events_toml_path) # self.events is now the full dict
                    self.events = self.events['events'] # self.events is now the list of dicts
                    islumo = True 
                else:
                    msg = f"LUMO目录 {self.file_path} 中未找到 events.toml"
                    self.logger.error(msg)
                    raise FileNotFoundError(msg)
            elif self.file_path.lower().endswith('.mat'):
                islumo = False
                if node_num == 12:
                    # Try to load .npy info file if exists
                    npy_info_path = self.file_path.replace('.mat', '.npy').replace('.MAT', '.npy')
                    if os.path.exists(npy_info_path):
                        self.info = load_info(npy_info_path)
                    else:
                        self.info = load_info() # Default info (e.g. coords only)
                    self.data, self.events = load_mat(self.file_path) # self.events from load_mat
                elif node_num == 6:
                    self.info, _ = lumo2ndot('addfiles')
                    self.data, self.events = load_mat(self.file_path)
                    # self.info, self.data, self.events = load_mat2info(self.file_path) # self.events from load_mat
                    
            elif self.file_path.lower().endswith('.nirs'):
                self.info, self.data = load_nirs(self.file_path)
                # .nirs files might not have separate event files in the same way.
                # self.events might be part of self.info or need custom handling.
                # Assuming self.info or self.data contains event markers if applicable.
                # For now, if self.events is None, get_pulse_times_wrapper needs to handle it.
                if self.events is None and 'events' in self.info: # Check if info has events
                    self.events = self.info['events']
                elif self.events is None:
                    self.logger.warning(f".nirs file loaded. Event handling might be basic. Attempting to use info.hdr.marker if exists.")
                    # Placeholder: MNE-NIRS often stores markers in info.hdr.annotations or similar
                    # This part needs to be adapted based on how load_nirs structures event data.
                    # For now, assuming get_pulse_times_wrapper can handle self.events being None initially for .nirs
                    # or that load_nirs populates self.events correctly.
                    # If self.events remains None, some paradigms might not be found.
                    pass # Let get_pulse_times_wrapper handle it.

            else:
                msg = f"不支持的文件格式: {self.file_path}"
                self.logger.error(msg)
                raise ValueError(msg)
            
            self.logger.info("数据加载完成.")

            # Get pulse times using the wrapper
            pulse_times, pulse_names = self.get_pulse_times(self.events,islumo) # Pass loaded events
            self.logger.info("脉冲/范式时间点获取完成.")

            self.handle_results(pulse_times, pulse_names)
            self.logger.info("结果处理和图像生成完成.")
            
            # Replace the original generate_pdf_report with the CLI version for this instance
            # self.generate_pdf_report = self._generate_pdf_report_cli_version

            self.generate_pdf_report(self.analyses, output_pdf_path, self.temp_img_dir)
            
            self.logger.info(f"报告已生成: {output_pdf_path}")
            return output_pdf_path

        except Exception as e:
            self.logger.error(f"生成报告时出错: {str(e)}\n{traceback.format_exc()}")
            raise
        finally:
            if self.temp_img_dir and os.path.exists(self.temp_img_dir):
                try:
                    shutil.rmtree(self.temp_img_dir)
                except Exception as e_rm_img:
                    self.logger.error(f"清理临时图像目录失败: {e_rm_img}")
            if temp_main_dir and os.path.exists(temp_main_dir):
                try:
                    shutil.rmtree(temp_main_dir)
                except Exception as e_rm_main:
                    self.logger.error(f"清理临时主目录失败: {e_rm_main}")
            self.logger.info("临时文件清理尝试完成.")

    def generate_pdf_report(self, analyses, pdf_path, img_dir):
        """生成PDF报告
        
        Args:
            analyses: 分析结果列表
            pdf_path: PDF输出路径
            img_dir: 临时图像目录路径
        """
        # 创建PDF文档
        doc = SimpleDocTemplate(pdf_path, pagesize=landscape(A4))
        story = []
        
        # 注册字体文件
        pdfmetrics.registerFont(TTFont('SimHei', 'SimHei.ttf'))
        pdfmetrics.registerFont(TTFont('SimSun', 'SimSun.ttf'))

        # 设置样式
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Title'],
            fontName='SimHei',
            fontSize=16,
            leading=20,
            alignment=1
        )

        # 定义正文样式
        normal_style = ParagraphStyle(
            'CustomNormal',
            parent=styles['Normal'],
            fontName='SimSun',
            fontSize=10,
            leading=14,
        )
        
        # 定义小标题样式
        heading_style = ParagraphStyle(
            'CustomHeading',
            parent=styles['Heading2'],
            fontName='SimHei',
            fontSize=12,
            leading=16,
            spaceBefore=10,
            spaceAfter=6
        )

        # 添加标题和基本信息（第一页）
        story.append(Paragraph("近红外脑功能检查报告", title_style))
        story.append(Spacer(1, 10))
        
        # 添加受试者信息
        # data = [
        #     ['姓名', self.name_input.text(), 
        #      '性别', self.gender_input.text(),
        #      '年龄', self.age_input.text(), 
        #      '检查号', self.id_input.text()]
        # ]
        
        data = [
            ['姓名', self.user_info.get('name', ' '), '性别', self.user_info.get('gender', ' ')],
            ['年龄', self.user_info.get('age', ' '), '检查号', self.user_info.get('id', ' ')]
        ]
        
        # 设置表格样式
        info_table = Table(data, colWidths=[doc.width/8]*8)
        info_table.setStyle(TableStyle([
            ('GRID', (0,0), (-1,-1), 0.5, colors.grey),
            ('ALIGN', (0,0), (-1,-1), 'LEFT'),
            ('FONTNAME', (0,0), (-1,-1), 'SimSun'),
            ('FONTSIZE', (0,0), (-1,-1), 10),
        ]))
        story.append(info_table)
        story.append(Spacer(1, 10))
        
        # # 添加检查描述到第一页
        # if self.description_input.toPlainText().strip():
        #     story.append(Paragraph("检查描述", heading_style))
        #     story.append(Paragraph(self.description_input.toPlainText(), normal_style))
        #     story.append(Spacer(1, 10))

        # 添加检查描述（用框框起来）
        story.append(Paragraph("检查描述", heading_style))
        
        # 创建检查描述的表格，使用框将其框起来
        description_text = " "
        description_table = Table([[description_text]], colWidths=[600], rowHeights=[280])
        description_table.setStyle(TableStyle([
            ('BOX', (0, 0), (-1, -1),  0.5, colors.grey),  # 添加边框
            ('FONTNAME', (0, 0), (-1, -1), 'SimSun'),
            ('ALIGNMENT', (0, 0), (-1, -1), 'LEFT'),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('LEFTPADDING', (0, 0), (-1, -1), 6),
            ('RIGHTPADDING', (0, 0), (-1, -1), 6),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ]))
        
        story.append(description_table)
        
        # 添加足够的空间，将数据处理说明放在页面底部
        story.append(Spacer(1, 10))
        # 将数据处理说明放在页面底部
        processing_info = "数据采集：NIRS脑功能成像系统"
        if self.filter_enabled:
            processing_info += "，已进行带通滤波"
        if self.tddr_enabled:
            processing_info += "，已进行TDDR运动伪迹校正"
            
        # story.append(Paragraph("数据处理说明", heading_style))
        story.append(Paragraph(processing_info, normal_style))
        
        # 添加检查日期，放在右侧
        time_style = ParagraphStyle(
            'Date',
            parent=normal_style,
            alignment=2  # 右对齐
        )
        date_info = f"检查日期：{datetime.now().strftime('%Y-%m-%d %H:%M')}"
        story.append(Paragraph(date_info, time_style))
        
        # 为每个范式创建单独的页面
        for idx, fig in enumerate(self.figures):
            try:
                # 获取当前范式的分析结果
                current_analysis = analyses[idx]

                # 添加分页符，确保每个范式从新页面开始
                story.append(PageBreak())
                # 添加范式名称作为子标题
                story.append(Paragraph(f"{current_analysis['name']}", title_style))
                story.append(Spacer(1, 5))
                
                # 保存图像到临时目录
                img_path = os.path.join(img_dir, f"visualization_{idx}.png")
                fig.savefig(img_path, dpi=300, bbox_inches='tight')
                plt.close(fig)
                
                if not os.path.exists(img_path):
                    raise FileNotFoundError(f"临时图像文件未能创建: {img_path}")
                
                # 调整图像大小以适应页面
                img = Image(img_path)
                available_height = doc.height * 0.7
                img_aspect_ratio = fig.get_figheight() / fig.get_figwidth()
                img.drawWidth = doc.width * 0.95
                img.drawHeight = img.drawWidth * img_aspect_ratio
                
                if img.drawHeight > available_height:
                    img.drawHeight = available_height
                    img.drawWidth = img.drawHeight / img_aspect_ratio
                
                story.append(img)
                story.append(Spacer(1, 5))
                
                # 根据选项添加分析结果和结论
                if self.laterality_enabled or self.fc_enabled:
                    if 'report' in current_analysis and 'analysis' in current_analysis:
                        diagnosis_result = [
                            current_analysis['report'],
                            current_analysis['analysis']['integration'] + "；未见明显异常。"
                        ]
                    else:
                        # 如果没有偏侧化或功能连接分析结果，使用简单描述
                        diagnosis_result = ["", "数据采集正常。"]
                        if self.filter_enabled:
                            diagnosis_result[0] += "已进行带通滤波处理。"
                        if self.tddr_enabled:
                            diagnosis_result[0] += "已进行运动伪迹校正。"

                    bottom_data = [
                        ['数据处理与分析', Paragraph(diagnosis_result[0], normal_style),
                         '结论', Paragraph(diagnosis_result[1], normal_style)],
                        ['报告日期', datetime.now().strftime('%Y-%m-%d %H:%M'), '', '']
                    ]
                else:
                    # 如果未选择任何分析选项，只显示基本信息
                    processing_desc = "数据采集正常。"
                    if self.filter_enabled:
                        processing_desc += "已进行带通滤波处理。"
                    if self.tddr_enabled:
                        processing_desc += "已进行运动伪迹校正。"

                    bottom_data = [
                        ['数据处理说明', Paragraph(processing_desc, normal_style),
                         '结论', Paragraph("数据采集正常。", normal_style)],
                        ['报告日期', datetime.now().strftime('%Y-%m-%d %H:%M'), '', '']
                    ]
                
                # 计算列宽
                col_widths = [doc.width*0.15, doc.width*0.35, doc.width*0.15, doc.width*0.35]
                
                bottom_table = Table(bottom_data, colWidths=col_widths)
                bottom_table.setStyle(TableStyle([
                    ('GRID', (0,0), (-1,-1), 0.5, colors.grey),
                    ('ALIGN', (0,0), (-1,-1), 'LEFT'),
                    ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
                    ('FONTNAME', (0,0), (-1,-1), 'SimSun'),
                    ('FONTSIZE', (0,0), (-1,-1), 10),
                    ('SPAN', (1,1), (3,1)),
                ]))
                story.append(bottom_table)
                
            except Exception as e:
                print(f"处理图像 {idx} 时出错: {str(e)}")
                raise

        # 生成PDF
        try:
            doc.build(story)
        except Exception as e:
            print(f"PDF生成错误: {str(e)}")
            try:
                title_style.fontName = 'Helvetica-Bold'
                normal_style.fontName = 'Helvetica'
                doc.build(story)
            except Exception as e:
                print(f"使用备用字体后仍然出错: {str(e)}")

        return pdf_path

    def _generate_pdf_report_cli_version(self, current_analyses, pdf_path, img_dir_path):
        """内部方法：生成PDF报告（CLI版）"""
        doc = SimpleDocTemplate(pdf_path, pagesize=landscape(A4))
        story = []
        
        try:
            # Try to register fonts. If they are not found, ReportLab might use a fallback or error.
            font_paths = {
                'SimHei': 'SimHei.ttf', # Expected in script dir or system path
                'SimSun': 'SimSun.ttf'  # Expected in script dir or system path
            }
            for name, filename in font_paths.items():
                try:
                    # Check if font file exists in common locations if not found by default
                    if os.path.exists(filename):
                         pdfmetrics.registerFont(TTFont(name, filename))
                    # else try to find it in a 'fonts' subdirectory
                    elif os.path.exists(os.path.join(os.path.dirname(__file__), 'fonts', filename)):
                         pdfmetrics.registerFont(TTFont(name, os.path.join(os.path.dirname(__file__), 'fonts', filename)))
                    else: # Rely on system search or default ReportLab behavior
                         pdfmetrics.registerFont(TTFont(name, filename)) # May fail if not found
                except Exception as font_e:
                     self.logger.warning(f"注册字体 {name} ({filename}) 失败: {font_e}. PDF可能无法正确显示中文。")
                     # Fallback to a standard font if SimHei/SimSun are critical and fail
                     # styles = getSampleStyleSheet() will use Helvetica by default.

        except Exception as e_font:
            self.logger.error(f"字体注册过程中发生严重错误: {e_font}")
            # Proceed with default fonts if custom registration fails broadly

        styles = getSampleStyleSheet() # Get styles after font registration attempt

        # Define styles using registered font names if available, else they'll use ReportLab defaults
        title_style = ParagraphStyle('CustomTitle', parent=styles['Title'], fontName='SimHei', fontSize=18, leading=22, alignment=1, spaceAfter=12)
        normal_style = ParagraphStyle('CustomNormal', parent=styles['Normal'], fontName='SimSun', fontSize=10, leading=14)
        heading_style = ParagraphStyle('CustomHeading', parent=styles['Heading2'], fontName='SimHei', fontSize=12, leading=16, spaceBefore=10, spaceAfter=6)

        # First Page: Basic Info and Description
        story.append(Paragraph("近红外脑功能检查报告", title_style))
        
        user_data_table = [
            ['姓名', self.user_info.get('name', ' '), '性别', self.user_info.get('gender', ' ')],
            ['年龄', self.user_info.get('age', ' '), '检查号', self.user_info.get('id', ' ')]
        ]
        info_table_obj = Table(user_data_table, colWidths=[doc.width/4.5]*4) # Adjusted colWidths
        info_table_obj.setStyle(TableStyle([
            ('GRID', (0,0), (-1,-1), 0.5, colors.grey), ('ALIGN', (0,0), (-1,-1), 'LEFT'),
            ('FONTNAME', (0,0), (-1,-1), 'SimSun'), ('FONTSIZE', (0,0), (-1,-1), 10),
            ('LEFTPADDING', (0,0), (-1,-1), 5), ('RIGHTPADDING', (0,0), (-1,-1), 5),
             ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ]))
        story.append(info_table_obj)
        story.append(Spacer(1, 12))

        story.append(Paragraph("检查描述", heading_style))
        desc_text = self.description_input_text if self.description_input_text else "无"
        # Wrap description text in a Paragraph for better formatting within the table cell
        desc_paragraph = Paragraph(desc_text.replace('\\n', '<br/>'), normal_style)
        desc_table_obj = Table([[desc_paragraph]], colWidths=[doc.width * 0.9], rowHeights=[doc.height * 0.25]) # Adjust height as needed
        desc_table_obj.setStyle(TableStyle([
            ('BOX', (0,0), (-1,-1), 0.5, colors.grey), ('PADDING', (0,0), (-1,-1), 6),
            ('VALIGN', (0,0), (-1,-1), 'TOP')
        ]))
        story.append(desc_table_obj)
        story.append(Spacer(1, 12))

        proc_info_text = "数据采集：NIRS脑功能成像系统"
        if self.filter_enabled: proc_info_text += "；已进行带通滤波"
        if self.tddr_enabled: proc_info_text += "；已进行TDDR运动伪迹校正"
        story.append(Paragraph(proc_info_text, normal_style))
        
        date_style = ParagraphStyle('DateStyle', parent=normal_style, alignment=2) # Right align
        story.append(Paragraph(f"检查日期：{datetime.now().strftime('%Y-%m-%d %H:%M')}", date_style))

        # Subsequent Pages: One per figure/analysis
        for fig_idx, fig_obj in enumerate(self.figures):
            if fig_idx >= len(current_analyses): # Safety check
                self.logger.warning(f"图表数量 ({len(self.figures)}) 与分析结果数量 ({len(current_analyses)}) 不匹配。跳过图表 {fig_idx}。")
                continue
            
            analysis_item = current_analyses[fig_idx]
            story.append(PageBreak())
            story.append(Paragraph(f"{analysis_item.get('name', '未命名范式')}分析结果", title_style))
            
            img_file_path = os.path.join(img_dir_path, f"visualization_{fig_idx}.png")
            try:
                fig_obj.savefig(img_file_path, dpi=200, bbox_inches='tight') # Lower DPI for potentially smaller file
                plt.close(fig_obj) # Close figure after saving
            except Exception as e_save_fig:
                self.logger.error(f"保存图像 {img_file_path} 失败: {e_save_fig}")
                story.append(Paragraph(f"错误：无法加载范式 {analysis_item.get('name', '')} 的图像。", normal_style))
                continue # Skip this paradigm's page if image fails

            if not os.path.exists(img_file_path):
                story.append(Paragraph(f"错误：图像文件 {img_file_path} 未找到。", normal_style))
                continue

            img_width, img_height = A4[1]*0.9, A4[0]*0.55 # Landscape A4 dimensions for image size estimation
            try:
                report_img = Image(img_file_path, width=img_width, height=img_height, kind='bound')
                story.append(report_img)
            except Exception as e_img_load: # PIL might error on some files
                 self.logger.error(f"加载图像到PDF失败 {img_file_path}: {e_img_load}")
                 story.append(Paragraph(f"错误：无法在PDF中显示图像 {analysis_item.get('name', '')}。", normal_style))
            
            story.append(Spacer(1, 10))

            # Analysis text and conclusion
            analysis_text_content = analysis_item.get('report', "未提供分析文本。")
            integration_text_content = analysis_item.get('analysis', {}).get('integration', "未提供综合结论。")
            
            # Ensure content is string and handle None
            analysis_text_content = str(analysis_text_content if analysis_text_content is not None else "无")
            integration_text_content = str(integration_text_content if integration_text_content is not None else "无")


            bottom_table_data = [
                [Paragraph('数据处理与分析:', heading_style), Paragraph(analysis_text_content.replace('\\n', '<br/>'), normal_style)],
                [Paragraph('结论:', heading_style), Paragraph(integration_text_content.replace('\\n', '<br/>'), normal_style)],
                [Paragraph('报告日期:', heading_style), Paragraph(datetime.now().strftime('%Y-%m-%d %H:%M'), normal_style)]
            ]
            # Span the content cells
            bottom_table_obj = Table(bottom_table_data, colWidths=[doc.width*0.2, doc.width*0.75])
            bottom_table_obj.setStyle(TableStyle([
                ('GRID', (0,0), (-1,-1), 0.5, colors.grey),
                ('VALIGN', (0,0), (-1,-1), 'TOP'),
                ('FONTNAME', (0,0), (0,-1), 'SimHei'), # Heading font for first column
                ('FONTNAME', (1,0), (1,-1), 'SimSun'), # Content font for second column
                ('LEFTPADDING', (0,0), (-1,-1), 6),
                ('RIGHTPADDING', (0,0), (-1,-1), 6),
                ('TOPPADDING', (0,0), (-1,-1), 6),
                ('BOTTOMPADDING', (0,0), (-1,-1), 6),
            ]))
            story.append(bottom_table_obj)

        try:
            doc.build(story)
        except Exception as e_pdf_build:
            self.logger.error(f"PDF生成最后步骤失败: {e_pdf_build}\n{traceback.format_exc()}")
            # Try with default fonts if specific ones caused issues.
            # This is a bit late, as styles are already defined.
            # A more robust solution would be to check font availability earlier.
            # For now, just log and re-raise.
            raise
        return pdf_path

# --- 主函数 ---
def generate_lumo_report_cli(user_info: dict, lumo_dir_path: str, output_pdf_path: str, 
                             filter_enabled: bool = True, tddr_enabled: bool = True, 
                             fc_enabled: bool = False, laterality_enabled: bool = False, 
                             description: str = ""):
    """
    为LUMO数据生成NIRS报告（命令行接口）
    Args:
        user_info (dict): 包含 'name', 'id', 'gender', 'age' 的字典
        lumo_dir_path (str): LUMO目录的路径
        output_pdf_path (str): 生成的PDF报告的保存路径
        filter_enabled (bool): 是否启用带通滤波
        tddr_enabled (bool): 是否启用TDDR运动伪迹校正
        fc_enabled (bool): 是否启用功能连接分析
        laterality_enabled (bool): 是否启用偏侧化分析
        description (str): 报告的检查描述内容
    Returns:
        str: 成功则返回生成的PDF报告路径，否则返回None
    """
    logger_cli = setup_logger() # Setup a logger for this run
    logger_cli.info(f"调用 generate_lumo_report_cli: LUMO路径='{lumo_dir_path}', 输出PDF='{output_pdf_path}'")
    try:
        # Default description if not provided
        final_description = description or f"对LUMO数据文件夹 {os.path.basename(lumo_dir_path)} 的自动分析报告。"
        
        generator = NIRSReportGeneratorCLI(
            user_info, lumo_dir_path, filter_enabled, tddr_enabled, 
            fc_enabled, laterality_enabled, final_description
        )
        report_file = generator.generate_cli_report(output_pdf_path)
        logger_cli.info(f"LUMO报告生成成功: {report_file}")
        return report_file
    except Exception as e:
        logger_cli.error(f"生成LUMO报告失败: {e}\n{traceback.format_exc()}", exc_info=False) # exc_info=True to log traceback
        return None

def generate_mat_report_cli(user_info: dict, mat_file_path: str, output_pdf_path: str,
                            filter_enabled: bool = True, tddr_enabled: bool = True,
                            fc_enabled: bool = False, laterality_enabled: bool = False,
                            description: str = ""):
    """
    为.mat文件数据生成NIRS报告（命令行接口）
    Args:
        user_info (dict): 包含 'name', 'id', 'gender', 'age' 的字典
        mat_file_path (str): .mat文件的路径
        output_pdf_path (str): 生成的PDF报告的保存路径
        filter_enabled (bool): 是否启用带通滤波
        tddr_enabled (bool): 是否启用TDDR运动伪迹校正
        fc_enabled (bool): 是否启用功能连接分析
        laterality_enabled (bool): 是否启用偏侧化分析
        description (str): 报告的检查描述内容
    Returns:
        str: 成功则返回生成的PDF报告路径，否则返回None
    """
    logger_cli = setup_logger()
    logger_cli.info(f"调用 generate_mat_report_cli: MAT路径='{mat_file_path}', 输出PDF='{output_pdf_path}'")
    try:
        final_description = description or f"对MAT数据文件 {os.path.basename(mat_file_path)} 的自动分析报告。"
                                                                          
        generator = NIRSReportGeneratorCLI(
            user_info, mat_file_path, filter_enabled, tddr_enabled, 
            fc_enabled, laterality_enabled, final_description
        )
        report_file = generator.generate_cli_report(output_pdf_path)
        logger_cli.info(f".mat报告生成成功: {report_file}")
        return report_file
    except Exception as e:
        logger_cli.error(f"生成.mat报告失败: {e}\n{traceback.format_exc()}", exc_info=False)
        return None

if __name__ == "__main__":
    
    from report_generator_cli import generate_mat_report_cli

    # user_details = {'name': '张三', 'id': '001', 'gender': '男', 'age': '35'}
    # mat_file = r"D:\phone\act_app_rehab\fnirs_data\6node_20250401_165403.mat"
    # output_report = "./6node_20250401_165403.pdf"
    
    user_details = {'name': '小白', 'id': '010', 'gender': '男', 'age': '18'}
    mat_file = 'fnirs_reports/rawdata_20250512_110201.mat'
    output_report = 'fnirs_reports/rawdata_20250512_110201.pdf' 
    # mat_file = 'fnirs_data/test7-5-2025_13-5.LUMO'
    # output_report = 'fnirs_reports/test_20250507_155147.pdf'
    
    report_description = " "

    pdf_path = generate_mat_report_cli(
        user_info=user_details,
        mat_file_path=mat_file,
        output_pdf_path=output_report,
        filter_enabled=True,
        tddr_enabled=True,
        fc_enabled=False,
        laterality_enabled=False,
        description=report_description
    )

    if pdf_path:
        print(f"报告已成功生成: {pdf_path}")
    else:
        print("报告生成失败。")


