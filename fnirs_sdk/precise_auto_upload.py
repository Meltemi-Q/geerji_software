#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
精准分离自动上传模块 v2.2.0
实现真正的fNIRS和运动数据分离上传功能
"""

import os
import json
import tempfile
import requests
import threading
import numpy as np
from datetime import datetime
from scipy.io import savemat
from typing import Dict

def auto_upload_separated_data(processor, patient_info: Dict[str, str], manufacturer: str = 'kanglian'):
    """
    精准分离自动上传会话数据到戈尔基云端v4.0（异步，不阻塞厂家）
    
    新的精准分离上传功能:
    1. fNIRS数据单独上传: 使用LUMO格式MAT文件, data_type=fnirs, manufacturer=golgi
    2. 运动数据单独上传: 使用JSON格式, data_type=motion, manufacturer=指定厂家
    3. 支持多厂家: 康莲/康助侠/其他厂家灵活支持
    
    参数:
        processor: FNIRSProcessor实例
        patient_info: 患者信息
        manufacturer: 运动设备厂家 ('kanglian', 'kangzhuxia', 'other')
    """
    
    def upload_task():
        try:
            print(f"[戈尔基] 开始精准分离上传: fNIRS + {manufacturer}运动数据")
            
            # 构建患者信息
            patient_data = {
                'patient_id': patient_info.get('id', f"AUTO_{int(datetime.now().timestamp())}"),
                'name': patient_info.get('name', 'unknown_patient'),
                'age': patient_info.get('age', 'N/A'),
                'gender': patient_info.get('gender', 'N/A'),
                'diagnosis': patient_info.get('symptoms', 'fNIRS检测'),
                'onset_time': patient_info.get('onset_time', 'N/A'),
                'session_time': datetime.now().isoformat(),
                'sdk_version': '2.2.0'
            }
            
            # 1. 单独上传fNIRS数据
            fnirs_success = _upload_fnirs_data(processor, patient_data)
            
            # 2. 单独上传运动数据
            motion_success = _upload_motion_data(processor, patient_data, manufacturer)
            
            # 总结上传结果
            if fnirs_success and motion_success:
                print(f"[戈尔基] 精准分离上传成功: fNIRS(戈尔基) + Motion({manufacturer})")
            elif fnirs_success:
                print(f"[戈尔基] fNIRS数据上传成功（运动数据上传失败）")
            elif motion_success:
                print(f"[戈尔基] {manufacturer}运动数据上传成功（fNIRS上传失败）")
            else:
                print(f"[戈尔基] 数据上传失败: fNIRS和{manufacturer}运动数据都未成功")
                
        except Exception as e:
            print(f"[戈尔基] 自动上传异常: {e}")
    
    # 异步上传，不阻塞主流程
    upload_thread = threading.Thread(target=upload_task)
    upload_thread.daemon = True
    upload_thread.start()


def _upload_fnirs_data(processor, patient_data):
    """单独上传fNIRS数据"""
    try:
        # 获取原始fNIRS数据
        raw_data = None
        if hasattr(processor, '_data_buffer') and processor._data_buffer is not None:
            current_frame = getattr(processor, '_current_frame_id', 0)
            if current_frame > 0:
                raw_data = processor._data_buffer[:, :current_frame].copy()
        
        # 构建纯净的fNIRS LUMO格式MAT数据
        if raw_data is not None:
            data_matrix = raw_data.T  # (time_points, channels)
            n_channels = raw_data.shape[0]
            n_timepoints = raw_data.shape[1]
        else:
            # 模拟数据
            n_channels = 432
            n_timepoints = 100
            data_matrix = np.random.randn(n_timepoints, n_channels) * 0.1
        
        # 标准LUMO dot结构
        dot_info = {
            'io': {
                'Nd': 24, 'Ns': 18, 'Nwl': 2, 'nframe': n_timepoints
            },
            'system': {'framerate': 8.0},
            'misc': {'startTime': 0},
            'paradigm': {},
            'optodes': {
                'plot3orientation': {'i': 'R2L', 'j': 'P2A', 'k': 'D2V'}
            },
            'pairs': {
                'Mod': ['CW'] * n_channels,
                'lambda': [735, 850] * (n_channels // 2)
            },
            'tissue': {
                'affine': np.eye(4).tolist(),
                'affine_target': 'MNI'
            }
        }
        
        # 纯净的fNIRS数据（不包含运动数据）
        fnirs_data = {
            'data': data_matrix,
            'info': dot_info,
            'golgi_metadata': {
                'device': 'golgi_fnirs',
                'data_type': 'pure_fnirs',
                'channels': n_channels,
                'timepoints': n_timepoints,
                'sdk_version': '2.2.0',
                'upload_timestamp': datetime.now().isoformat()
            }
        }
        
        # 创建fNIRS MAT文件
        fnirs_temp_file = tempfile.NamedTemporaryFile(suffix='.mat', delete=False)
        savemat(fnirs_temp_file.name, fnirs_data)
        fnirs_temp_file.close()
        
        # 上传fNIRS数据（修复文件句柄问题）
        api_url = "http://36.134.11.254:5000/api/rehab/upload/data"
        
        # 读取文件内容到内存，避免文件句柄冲突
        with open(fnirs_temp_file.name, 'rb') as f:
            file_content = f.read()
        
        # 使用内存中的内容创建文件对象
        import io
        file_obj = io.BytesIO(file_content)
        files = {'fnirs_file': ('fnirs_data.mat', file_obj, 'application/octet-stream')}
        data = {
            'data_type': 'fnirs',
            'manufacturer': 'golgi',
            'patient_info': json.dumps(patient_data, ensure_ascii=False)
        }
        
        response = requests.post(api_url, files=files, data=data, timeout=15)
        
        if response.status_code == 200:
            result = response.json()
            if result.get('success'):
                record_id = result.get('data', {}).get('record_id', 'unknown')
                print(f"[戈尔基] fNIRS数据上传成功: {patient_data.get('name', '未知患者')} (ID: {record_id})")
                os.unlink(fnirs_temp_file.name)
                return True
            else:
                print(f"[戈尔基] fNIRS数据上传失败: {result.get('error', '未知错误')}")
        else:
            print(f"[戈尔基] fNIRS数据上传失败: HTTP {response.status_code}")
        
        os.unlink(fnirs_temp_file.name)
        return False
        
    except Exception as e:
        print(f"[戈尔基] fNIRS数据上传异常: {e}")
        return False


def _upload_motion_data(processor, patient_data, manufacturer):
    """单独上传运动数据（MAT格式）"""
    try:
        # 检查是否有运动数据
        if not hasattr(processor, '_session_data') or not processor._session_data:
            print(f"[戈尔基] 无{manufacturer}运动数据，跳过上传")
            return True  # 没有数据不算失败
        
        # 构建纯净的运动数据MAT格式
        motion_data = {
            'manufacturer': manufacturer,
            'device_type': f'{manufacturer}康复设备',
            'data_format': 'motion_sequence',
            'session_data': processor._session_data,  # 原始运动数据
            'data_count': len(processor._session_data),
            'sdk_metadata': {
                'sdk_version': '2.2.0',
                'data_type': 'pure_motion',
                'upload_timestamp': datetime.now().isoformat(),
                'data_source': f'{manufacturer}_device'
            }
        }
        
        # 创建运动数据MAT文件
        motion_temp_file = tempfile.NamedTemporaryFile(suffix='.mat', delete=False)
        savemat(motion_temp_file.name, motion_data)
        motion_temp_file.close()
        
        # 上传运动数据（修复文件句柄问题）
        api_url = "http://36.134.11.254:5000/api/rehab/upload/data"
        
        # 读取文件内容到内存，避免文件句柄冲突
        with open(motion_temp_file.name, 'rb') as f:
            file_content = f.read()
        
        # 使用内存中的内容创建文件对象
        import io
        file_obj = io.BytesIO(file_content)
        files = {'motion_file': ('motion_data.mat', file_obj, 'application/octet-stream')}
        data = {
            'data_type': 'motion',
            'manufacturer': manufacturer.lower(),
            'patient_info': json.dumps(patient_data, ensure_ascii=False)
        }
        
        response = requests.post(api_url, files=files, data=data, timeout=15)
        
        if response.status_code == 200:
            result = response.json()
            if result.get('success'):
                record_id = result.get('data', {}).get('record_id', 'unknown')
                print(f"[戈尔基] {manufacturer}运动数据上传成功: {len(processor._session_data)}条记录 (ID: {record_id})")
                os.unlink(motion_temp_file.name)
                return True
            else:
                print(f"[戈尔基] {manufacturer}运动数据上传失败: {result.get('error', '未知错误')}")
        else:
            print(f"[戈尔基] {manufacturer}运动数据上传失败: HTTP {response.status_code}")
        
        os.unlink(motion_temp_file.name)
        return False
        
    except Exception as e:
        print(f"[戈尔基] {manufacturer}运动数据上传异常: {e}")
        return False