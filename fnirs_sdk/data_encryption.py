#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
fNIRS数据加密模块
为康莲SDK提供数据加密和解密功能
"""

import os
import base64
import hashlib
import numpy as np
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
import json
import gzip
from typing import Dict, Any, Optional


class FNIRSDataEncryption:
    """fNIRS数据加密器 - 保护预采集的真实血氧数据"""
    
    def __init__(self, password: str = None):
        """
        初始化加密器
        
        Args:
            password: 加密密码，如果为None则使用内置密码
        """
        # 内置密码（康莲SDK专用）
        self._internal_password = "fNIRS_Kanglian_2025_BrainOxygen_Protection"
        self.password = password or self._internal_password
        self._key = None
        self._initialize_encryption()
    
    def _initialize_encryption(self):
        """初始化加密密钥"""
        # 使用PBKDF2生成密钥
        password_bytes = self.password.encode('utf-8')
        salt = b'fnirs_kanglian_salt_2025'  # 固定盐值，确保可重复解密
        
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=100000,
        )
        key = base64.urlsafe_b64encode(kdf.derive(password_bytes))
        self._cipher = Fernet(key)
    
    def encrypt_brain_data(self, hbo_data: np.ndarray, hbr_data: np.ndarray, 
                          metadata: Dict[str, Any] = None) -> bytes:
        """
        加密血氧数据
        
        Args:
            hbo_data: HbO数据 (channels, timepoints)
            hbr_data: HbR数据 (channels, timepoints) 
            metadata: 元数据信息
            
        Returns:
            bytes: 加密后的数据
        """
        try:
            # 准备数据包
            data_package = {
                'hbo': hbo_data.tolist(),
                'hbr': hbr_data.tolist(),
                'shape': hbo_data.shape,
                'dtype': str(hbo_data.dtype),
                'metadata': metadata or {},
                'version': '1.0',
                'source': 'golgi_fnirs_real_device'
            }
            
            # 转换为JSON并压缩
            json_data = json.dumps(data_package, separators=(',', ':'))
            compressed_data = gzip.compress(json_data.encode('utf-8'))
            
            # 加密
            encrypted_data = self._cipher.encrypt(compressed_data)
            
            return encrypted_data
            
        except Exception as e:
            raise RuntimeError(f"数据加密失败: {e}")
    
    def decrypt_brain_data(self, encrypted_data: bytes) -> Dict[str, Any]:
        """
        解密血氧数据
        
        Args:
            encrypted_data: 加密的数据
            
        Returns:
            Dict: 包含HbO、HbR数据和元数据的字典
        """
        try:
            # 解密
            compressed_data = self._cipher.decrypt(encrypted_data)
            
            # 解压缩
            json_data = gzip.decompress(compressed_data).decode('utf-8')
            data_package = json.loads(json_data)
            
            # 重建numpy数组
            hbo_array = np.array(data_package['hbo'], dtype=data_package['dtype'])
            hbr_array = np.array(data_package['hbr'], dtype=data_package['dtype'])
            
            return {
                'hbo': hbo_array,
                'hbr': hbr_array,
                'shape': tuple(data_package['shape']),
                'metadata': data_package['metadata'],
                'version': data_package['version'],
                'source': data_package['source']
            }
            
        except Exception as e:
            raise RuntimeError(f"数据解密失败: {e}")
    
    def create_data_checksum(self, data: bytes) -> str:
        """创建数据校验和"""
        return hashlib.sha256(data).hexdigest()
    
    def verify_data_integrity(self, data: bytes, expected_checksum: str) -> bool:
        """验证数据完整性"""
        actual_checksum = self.create_data_checksum(data)
        return actual_checksum == expected_checksum


class KanglianSDKDataProvider:
    """康莲SDK数据提供器 - 提供预采集的真实血氧数据"""
    
    def __init__(self, data_file_path: str = None):
        """
        初始化数据提供器
        
        Args:
            data_file_path: 加密数据文件路径
        """
        self.data_file_path = data_file_path or self._get_builtin_data_path()
        self.encryptor = FNIRSDataEncryption()
        self._cached_data = None
        self._data_index = 0
    
    def _get_builtin_data_path(self) -> str:
        """获取内置数据文件路径"""
        current_dir = os.path.dirname(__file__)
        return os.path.join(current_dir, 'encrypted_data', 'kanglian_brain_data.enc')
    
    def load_encrypted_data(self) -> bool:
        """加载加密的血氧数据"""
        try:
            if not os.path.exists(self.data_file_path):
                raise FileNotFoundError(f"找不到数据文件: {self.data_file_path}")
            
            with open(self.data_file_path, 'rb') as f:
                encrypted_data = f.read()
            
            # 解密数据
            self._cached_data = self.encryptor.decrypt_brain_data(encrypted_data)
            
            print(f"成功加载康莲SDK数据: {self._cached_data['shape']}")
            print(f"数据来源: {self._cached_data['source']}")
            print(f"数据版本: {self._cached_data['version']}")
            
            return True
            
        except Exception as e:
            print(f"加载数据失败: {e}")
            return False
    
    def get_brain_oxygen_frame(self, frame_id: int = None) -> Optional[Dict[str, np.ndarray]]:
        """
        获取指定帧的血氧数据
        
        Args:
            frame_id: 帧ID，如果为None则返回下一帧
            
        Returns:
            Dict: 包含HbO和HbR的字典，或None如果数据不可用
        """
        if self._cached_data is None:
            if not self.load_encrypted_data():
                return None
        
        try:
            hbo_data = self._cached_data['hbo']
            hbr_data = self._cached_data['hbr']
            
            # 确定帧索引
            if frame_id is not None:
                frame_idx = frame_id % hbo_data.shape[1]  # 循环使用数据
            else:
                frame_idx = self._data_index % hbo_data.shape[1]
                self._data_index += 1
            
            # 返回当前帧数据
            return {
                'HbO': hbo_data[:, frame_idx],  # (432,) 
                'HbR': hbr_data[:, frame_idx],  # (432,)
                'frame_id': frame_idx,
                'total_frames': hbo_data.shape[1]
            }
            
        except Exception as e:
            print(f"获取血氧帧数据失败: {e}")
            return None
    
    def get_realistic_time_series(self, duration_seconds: int = 60) -> Optional[Dict[str, np.ndarray]]:
        """
        获取指定时长的时间序列数据
        
        Args:
            duration_seconds: 时长（秒）
            
        Returns:
            Dict: 包含完整时间序列的HbO和HbR数据
        """
        if self._cached_data is None:
            if not self.load_encrypted_data():
                return None
        
        try:
            sample_rate = 8  # fNIRS采样率8Hz
            required_frames = duration_seconds * sample_rate
            
            hbo_full = self._cached_data['hbo']
            hbr_full = self._cached_data['hbr']
            
            # 如果请求的帧数超过可用数据，循环使用
            available_frames = hbo_full.shape[1]
            if required_frames <= available_frames:
                hbo_segment = hbo_full[:, :required_frames]
                hbr_segment = hbr_full[:, :required_frames]
            else:
                # 循环拼接数据
                repeats = (required_frames // available_frames) + 1
                hbo_extended = np.tile(hbo_full, (1, repeats))
                hbr_extended = np.tile(hbr_full, (1, repeats))
                hbo_segment = hbo_extended[:, :required_frames]
                hbr_segment = hbr_extended[:, :required_frames]
            
            return {
                'HbO': hbo_segment,
                'HbR': hbr_segment,
                'duration': duration_seconds,
                'sample_rate': sample_rate,
                'shape': hbo_segment.shape
            }
            
        except Exception as e:
            print(f"获取时间序列数据失败: {e}")
            return None
    
    def get_sample_brain_data(self, num_frames: int = 240) -> Optional[Dict[str, np.ndarray]]:
        """
        获取样本血氧数据 - 用于演示和测试
        
        Args:
            num_frames: 返回的帧数，默认240帧(30秒@8Hz)
            
        Returns:
            Dict: 包含样本HbO和HbR数据的字典
        """
        if self._cached_data is None:
            if not self.load_encrypted_data():
                return None
        
        try:
            hbo_full = self._cached_data['hbo']
            hbr_full = self._cached_data['hbr']
            
            # 获取指定数量的帧，如果不足则循环使用
            available_frames = hbo_full.shape[1]
            if num_frames <= available_frames:
                hbo_sample = hbo_full[:, :num_frames]
                hbr_sample = hbr_full[:, :num_frames]
            else:
                # 循环拼接数据到所需长度
                repeats = (num_frames // available_frames) + 1
                hbo_extended = np.tile(hbo_full, (1, repeats))
                hbr_extended = np.tile(hbr_full, (1, repeats))
                hbo_sample = hbo_extended[:, :num_frames]
                hbr_sample = hbr_extended[:, :num_frames]
            
            return {
                'HbO': hbo_sample,
                'HbR': hbr_sample,
                'frames': num_frames,
                'channels': hbo_sample.shape[0],
                'sample_rate': 8,
                'duration_seconds': num_frames / 8,
                'metadata': self._cached_data.get('metadata', {})
            }
            
        except Exception as e:
            print(f"获取样本血氧数据失败: {e}")
            return None


def create_kanglian_data_package(hbo_data: np.ndarray, hbr_data: np.ndarray, 
                               output_path: str, metadata: Dict[str, Any] = None) -> bool:
    """
    为康莲创建加密数据包
    
    Args:
        hbo_data: 真实采集的HbO数据
        hbr_data: 真实采集的HbR数据  
        output_path: 输出文件路径
        metadata: 元数据
        
    Returns:
        bool: 是否创建成功
    """
    try:
        encryptor = FNIRSDataEncryption()
        
        # 添加默认元数据
        default_metadata = {
            'device': 'Golgi fNIRS',
            'sample_rate': 8,
            'channels': hbo_data.shape[0],
            'duration_seconds': hbo_data.shape[1] / 8,
            'collection_date': '2025-01-28',
            'data_quality': 'high',
            'notes': 'Real fNIRS data for Kanglian SDK testing'
        }
        
        if metadata:
            default_metadata.update(metadata)
        
        # 加密数据
        encrypted_data = encryptor.encrypt_brain_data(hbo_data, hbr_data, default_metadata)
        
        # 确保输出目录存在
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        
        # 保存加密数据
        with open(output_path, 'wb') as f:
            f.write(encrypted_data)
        
        # 创建校验和文件
        checksum = encryptor.create_data_checksum(encrypted_data)
        checksum_path = output_path + '.checksum'
        with open(checksum_path, 'w') as f:
            f.write(checksum)
        
        print(f"康莲数据包创建成功:")
        print(f"  数据文件: {output_path}")
        print(f"  校验文件: {checksum_path}")
        print(f"  数据大小: {len(encrypted_data)} bytes")
        print(f"  数据形状: {hbo_data.shape}")
        
        return True
        
    except Exception as e:
        print(f"创建康莲数据包失败: {e}")
        return False


if __name__ == "__main__":
    # 测试加密和解密
    print("测试fNIRS数据加密...")
    
    # 创建测试数据
    test_hbo = np.random.randn(432, 100) * 0.1
    test_hbr = np.random.randn(432, 100) * 0.08
    
    # 测试加密
    encryptor = FNIRSDataEncryption()
    encrypted = encryptor.encrypt_brain_data(test_hbo, test_hbr)
    print(f"加密数据大小: {len(encrypted)} bytes")
    
    # 测试解密
    decrypted = encryptor.decrypt_brain_data(encrypted)
    print(f"解密数据形状: {decrypted['shape']}")
    print(f"数据一致性: {np.allclose(test_hbo, decrypted['hbo'])}")