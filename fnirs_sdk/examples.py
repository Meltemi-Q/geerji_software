#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
康莲fNIRS SDK使用示例
演示如何在康复设备中集成fNIRS脑血氧监测
"""

import time
import json
import numpy as np
from typing import Dict, List, Optional, Tuple
import threading
from datetime import datetime


class KanglianFNIRSDemo:
    """康莲fNIRS集成演示"""
    
    def __init__(self):
        """初始化演示系统"""
        self.fnirs_processor = None
        self.is_monitoring = False
        self.brain_data_buffer = []
        self.motion_data_buffer = []
        self.current_session_id = None
        
        print("康莲fNIRS SDK演示系统初始化...")
        self._initialize_fnirs_sdk()
    
    def _initialize_fnirs_sdk(self):
        """初始化fNIRS SDK"""
        try:
            # 导入SDK（在康莲环境中使用）
            from fnirs_sdk.processor import FNIRSProcessor
            
            # 创建处理器实例
            # 注意：康莲环境中会自动使用预采集的真实血氧数据
            self.fnirs_processor = FNIRSProcessor()
            
            print("✓ fNIRS SDK初始化成功")
            
        except ImportError as e:
            print(f"✗ fNIRS SDK导入失败: {e}")
            print("请确保已正确安装 fnirs-sdk-kanglian")
        except Exception as e:
            print(f"✗ fNIRS SDK初始化失败: {e}")
    
    def start_rehabilitation_session(self, patient_id: str) -> bool:
        """
        开始康复训练会话
        
        Args:
            patient_id: 患者ID
            
        Returns:
            bool: 是否成功启动
        """
        try:
            print(f"\n=== 开始康复训练会话 ===")
            print(f"患者ID: {patient_id}")
            
            # 1. 连接fNIRS设备（SDK内部处理）
            print("1. 连接fNIRS设备...")
            if not self.fnirs_processor.connect_device():
                print("✗ 设备连接失败")
                return False
            print("✓ 设备连接成功")
            
            # 2. 启动数据采集
            print("2. 启动脑血氧数据采集...")
            if not self.fnirs_processor.start_data_stream():
                print("✗ 数据采集启动失败")
                return False
            print("✓ 数据采集已启动 (8Hz)")
            
            # 3. 初始化会话
            self.current_session_id = f"rehab_{patient_id}_{int(time.time())}"
            self.is_monitoring = True
            
            print(f"✓ 康复会话已启动: {self.current_session_id}")
            return True
            
        except Exception as e:
            print(f"✗ 启动会话失败: {e}")
            return False
    
    def send_rehabilitation_data(self, force_data: List[float], moment_data: List[float],
                               joint_pos: List[float], joint_speed: List[float],
                               training_params: Dict) -> bool:
        """
        发送康复训练数据到fNIRS系统
        
        Args:
            force_data: 7维力数据 [F1, F2, ..., F7]
            moment_data: 7维力矩数据 [M1, M2, ..., M7]
            joint_pos: 7维关节位置 [P1, P2, ..., P7]
            joint_speed: 7维关节速度 [V1, V2, ..., V7]
            training_params: 训练参数字典
            
        Returns:
            bool: 是否发送成功
        """
        try:
            if not self.is_monitoring:
                return False
            
            # 构建4x7矩阵
            motion_matrix = np.array([
                force_data,      # 第0行：力数据
                moment_data,     # 第1行：力矩数据
                joint_pos,       # 第2行：关节位置
                joint_speed      # 第3行：关节速度
            ], dtype=np.float32)
            
            # 发送到fNIRS SDK
            success = self.fnirs_processor.add_motion_data_matrix(
                motion_matrix=motion_matrix,
                user_id=f"patient_{self.current_session_id.split('_')[1]}",
                params=training_params
            )
            
            if success:
                # 缓存数据用于分析
                self.motion_data_buffer.append({
                    'timestamp': time.time(),
                    'force': force_data,
                    'moment': moment_data,
                    'joint_pos': joint_pos,
                    'joint_speed': joint_speed,
                    'params': training_params
                })
            
            return success
            
        except Exception as e:
            print(f"发送康复数据失败: {e}")
            return False
    
    def get_brain_oxygen_for_heatmap(self) -> Optional[Dict]:
        """
        获取脑血氧数据用于热力图显示
        
        Returns:
            Dict: 包含血氧数据的字典，或None如果获取失败
        """
        try:
            if not self.is_monitoring:
                return None
            
            # 获取最新的血氧数据
            brain_data = self.fnirs_processor.get_oxygen_data()
            
            # 为康莲热力图准备数据
            heatmap_data = {
                'timestamp': brain_data.timestamp,
                'frame_id': brain_data.frame_id,
                'device_status': brain_data.device_status,
                
                # 血氧数据 (432通道)
                'hbo_values': brain_data.HbO.tolist(),
                'hbr_values': brain_data.HbR.tolist(),
                
                # 统计信息
                'hbo_stats': {
                    'mean': float(np.mean(brain_data.HbO)),
                    'std': float(np.std(brain_data.HbO)),
                    'min': float(np.min(brain_data.HbO)),
                    'max': float(np.max(brain_data.HbO))
                },
                'hbr_stats': {
                    'mean': float(np.mean(brain_data.HbR)),
                    'std': float(np.std(brain_data.HbR)),
                    'min': float(np.min(brain_data.HbR)),
                    'max': float(np.max(brain_data.HbR))
                },
                
                # 血氧饱和度指标
                'oxygenation_level': self._calculate_oxygenation_level(
                    brain_data.HbO, brain_data.HbR
                )
            }
            
            # 缓存数据
            self.brain_data_buffer.append(heatmap_data)
            
            # 保持缓存大小（最近100个数据点）
            if len(self.brain_data_buffer) > 100:
                self.brain_data_buffer = self.brain_data_buffer[-100:]
            
            return heatmap_data
            
        except Exception as e:
            print(f"获取脑血氧数据失败: {e}")
            return None
    
    def get_brain_oxygen_json(self) -> Optional[str]:
        """
        获取JSON格式的脑血氧数据（网络传输专用）
        
        Returns:
            str: JSON格式的血氧数据字符串
        """
        try:
            if not self.is_monitoring:
                return None
            
            # 直接从SDK获取JSON数据
            json_data = self.fnirs_processor.get_oxygen_data_json()
            return json_data
            
        except Exception as e:
            print(f"获取JSON血氧数据失败: {e}")
            return None
    
    def _calculate_oxygenation_level(self, hbo: np.ndarray, hbr: np.ndarray) -> float:
        """计算整体血氧化水平（基于HbO/HbR比值，不计算SO2）"""
        try:
            # 使用HbO和HbR的相对水平作为血氧化指标
            # 避免计算SO2，改用简化的血氧化评估
            hbo_mean = np.mean(hbo)
            hbr_mean = np.mean(np.abs(hbr))
            
            # 血氧化水平 = HbO相对强度
            # 归一化到[0,1]范围，0.5为中性水平
            if hbo_mean + hbr_mean > 0:
                level = (hbo_mean + 0.5) / (hbo_mean + hbr_mean + 1.0)
            else:
                level = 0.5
                
            # 限制在[0.2, 0.8]范围内，避免极端值
            return float(np.clip(level, 0.2, 0.8))
            
        except Exception:
            return 0.5  # 默认值
    
    def end_rehabilitation_session(self) -> bool:
        """
        结束康复训练会话
        
        Returns:
            bool: 是否成功结束
        """
        try:
            print(f"\n=== 结束康复训练会话 ===")
            
            if not self.is_monitoring:
                print("当前没有活跃的会话")
                return True
            
            # 1. 结束SDK会话
            print("1. 结束fNIRS会话...")
            session_success = self.fnirs_processor.finish_session(self.current_session_id)
            if session_success:
                print("✓ fNIRS会话已结束")
            else:
                print("⚠ fNIRS会话结束异常")
            
            # 2. 停止数据采集
            print("2. 停止数据采集...")
            self.fnirs_processor.stop_data_stream()
            self.fnirs_processor.disconnect_device()
            print("✓ 数据采集已停止")
            
            # 3. 生成会话报告
            self._generate_session_report()
            
            # 4. 重置状态
            self.is_monitoring = False
            self.current_session_id = None
            
            print("✓ 康复训练会话已完成")
            return True
            
        except Exception as e:
            print(f"✗ 结束会话失败: {e}")
            return False
    
    def _generate_session_report(self):
        """生成会话报告"""
        try:
            report = {
                'session_id': self.current_session_id,
                'end_time': datetime.now().isoformat(),
                'data_summary': {
                    'brain_data_points': len(self.brain_data_buffer),
                    'motion_data_points': len(self.motion_data_buffer),
                },
                'brain_oxygen_summary': {},
                'motion_summary': {}
            }
            
            # 血氧数据统计
            if self.brain_data_buffer:
                hbo_means = [d['hbo_stats']['mean'] for d in self.brain_data_buffer]
                hbr_means = [d['hbr_stats']['mean'] for d in self.brain_data_buffer]
                
                report['brain_oxygen_summary'] = {
                    'avg_hbo': float(np.mean(hbo_means)),
                    'avg_hbr': float(np.mean(hbr_means)),
                    'hbo_range': [float(np.min(hbo_means)), float(np.max(hbo_means))],
                    'hbr_range': [float(np.min(hbr_means)), float(np.max(hbr_means))]
                }
            
            # 运动数据统计
            if self.motion_data_buffer:
                force_magnitudes = [np.linalg.norm(d['force']) for d in self.motion_data_buffer]
                report['motion_summary'] = {
                    'avg_force_magnitude': float(np.mean(force_magnitudes)),
                    'max_force_magnitude': float(np.max(force_magnitudes)),
                    'total_movements': len(self.motion_data_buffer)
                }
            
            # 保存报告
            report_file = f"rehab_report_{self.current_session_id}.json"
            with open(report_file, 'w', encoding='utf-8') as f:
                json.dump(report, f, indent=2, ensure_ascii=False)
            
            print(f"✓ 会话报告已保存: {report_file}")
            
        except Exception as e:
            print(f"生成报告失败: {e}")


def run_kanglian_demo():
    """运行康莲演示程序"""
    print("=" * 60)
    print("康莲fNIRS SDK集成演示")
    print("=" * 60)
    
    # 创建演示实例
    demo = KanglianFNIRSDemo()
    
    # 模拟康复训练过程
    patient_id = "DEMO_001"
    
    # 1. 开始会话
    if not demo.start_rehabilitation_session(patient_id):
        print("会话启动失败，退出演示")
        return
    
    # 2. 模拟康复训练过程（30秒）
    print(f"\n=== 模拟康复训练过程 ===")
    training_duration = 30  # 30秒演示
    sample_rate = 8  # 8Hz
    
    for i in range(training_duration * sample_rate):
        # 模拟康莲设备生成的运动数据
        t = i / sample_rate
        
        # 生成逼真的康复运动数据
        force_data = [
            2.5 + 1.0 * np.sin(0.1 * t),      # Fx
            -1.2 + 0.8 * np.cos(0.15 * t),    # Fy
            150 + 20 * np.sin(0.05 * t),      # Fz
            90 + 15 * np.cos(0.08 * t),       # Mx  
            65 + 10 * np.sin(0.12 * t),       # My
            105 + 12 * np.cos(0.1 * t),       # Mz
            80 + 8 * np.sin(0.2 * t)          # F7
        ]
        
        moment_data = [
            3.8 + 0.5 * np.sin(0.3 * t),      # M1
            5.2 + 0.8 * np.cos(0.25 * t),     # M2
            3.2 + 0.6 * np.sin(0.4 * t),      # M3
            45 + 5 * np.cos(0.2 * t),         # M4
            12 + 3 * np.sin(0.35 * t),        # M5
            130 + 10 * np.cos(0.15 * t),      # M6
            42 + 4 * np.sin(0.45 * t)         # M7
        ]
        
        joint_pos = [
            1.0 + 0.2 * np.sin(0.1 * t),      # J1
            80 + 10 * np.cos(0.08 * t),       # J2
            9.5 + 2 * np.sin(0.15 * t),       # J3
            21 + 3 * np.cos(0.12 * t),        # J4
            75 + 8 * np.sin(0.18 * t),        # J5
            740 + 50 * np.cos(0.05 * t),      # J6
            72 + 6 * np.sin(0.22 * t)         # J7
        ]
        
        joint_speed = [
            1.5 + 0.3 * np.sin(0.2 * t),      # V1
            0.12 + 0.05 * np.cos(0.3 * t),    # V2
            3.2 + 0.4 * np.sin(0.25 * t),     # V3
            2.6 + 0.3 * np.cos(0.18 * t),     # V4
            1.0 + 0.2 * np.sin(0.35 * t),     # V5
            910 + 20 * np.cos(0.1 * t),       # V6
            2.1 + 0.25 * np.sin(0.28 * t)     # V7
        ]
        
        training_params = {
            "kl_Param": "30/5/0",
            "kl_Mode": 1,
            "kl_SpasmVal": 110,
            "kl_SpasmNum": 0,
            "kl_Status": 1
        }
        
        # 发送康复数据
        success = demo.send_rehabilitation_data(
            force_data, moment_data, joint_pos, joint_speed, training_params
        )
        
        # 获取脑血氧数据
        if success:
            brain_data = demo.get_brain_oxygen_for_heatmap()
            if brain_data:
                # 每2秒打印一次状态
                if i % 16 == 0:  # 8Hz * 2s = 16
                    print(f"训练进度: {t:.1f}s | "
                          f"血氧化水平: {brain_data['oxygenation_level']:.3f} | "
                          f"平均HbO: {brain_data['hbo_stats']['mean']:.4f}")
        
        # 模拟8Hz采样率
        time.sleep(0.125)
    
    # 3. 结束会话
    demo.end_rehabilitation_session()
    
    print(f"\n=== 康莲fNIRS SDK演示完成 ===")


def run_integration_test():
    """运行集成测试"""
    print("运行康莲fNIRS SDK集成测试...")
    
    try:
        # 导入测试模块
        from test_fnirs_kanglian_complete import FNIRSKanglianIntegrationTester
        
        # 运行测试
        tester = FNIRSKanglianIntegrationTester()
        results = tester.run_complete_test()
        
        return results
        
    except ImportError:
        print("测试模块未找到")
        return None


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "test":
        run_integration_test()
    else:
        run_kanglian_demo()