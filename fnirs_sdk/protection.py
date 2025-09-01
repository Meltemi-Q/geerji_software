#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
康莲SDK代码保护方案
防止.whl文件被轻易破解和逆向
"""

import os
import base64
import marshal
import types
import zlib
from typing import Any, Callable, Dict
import inspect
import ast


class CodeObfuscator:
    """代码混淆器"""
    
    @staticmethod
    def obfuscate_function(func: Callable) -> Callable:
        """
        混淆函数代码
        
        Args:
            func: 要混淆的函数
            
        Returns:
            Callable: 混淆后的函数
        """
        try:
            # 获取函数字节码
            code_obj = func.__code__
            
            # 编译为marshal格式
            marshaled = marshal.dumps(code_obj)
            
            # 压缩
            compressed = zlib.compress(marshaled)
            
            # Base64编码
            encoded = base64.b64encode(compressed)
            
            # 创建解码执行函数
            def obfuscated_func(*args, **kwargs):
                import base64, marshal, zlib, types
                
                # 解码过程
                decoded = base64.b64decode(encoded)
                decompressed = zlib.decompress(decoded)
                code_obj = marshal.loads(decompressed)
                
                # 重新创建函数
                restored_func = types.FunctionType(
                    code_obj, 
                    func.__globals__, 
                    func.__name__,
                    func.__defaults__,
                    func.__closure__
                )
                
                # 执行
                return restored_func(*args, **kwargs)
            
            obfuscated_func.__name__ = func.__name__
            obfuscated_func.__doc__ = "Protected function"
            
            return obfuscated_func
            
        except Exception as e:
            print(f"函数混淆失败: {e}")
            return func
    
    @staticmethod
    def obfuscate_string_literals(source_code: str) -> str:
        """混淆字符串字面量"""
        try:
            tree = ast.parse(source_code)
            
            class StringObfuscator(ast.NodeTransformer):
                def visit_Str(self, node):
                    if len(node.s) > 5:  # 只混淆长字符串
                        encoded = base64.b64encode(node.s.encode()).decode()
                        return ast.Call(
                            func=ast.Attribute(
                                value=ast.Attribute(
                                    value=ast.Name(id='base64', ctx=ast.Load()),
                                    attr='b64decode',
                                    ctx=ast.Load()
                                ),
                                attr='decode',
                                ctx=ast.Load()
                            ),
                            args=[ast.Str(s=encoded)],
                            keywords=[]
                        )
                    return node
            
            obfuscated_tree = StringObfuscator().visit(tree)
            return ast.unparse(obfuscated_tree)
            
        except Exception as e:
            print(f"字符串混淆失败: {e}")
            return source_code


class LicenseValidator:
    """许可证验证器"""
    
    def __init__(self, license_key: str = None):
        self.license_key = license_key or self._generate_kanglian_license()
        self._validation_cache = {}
    
    def _generate_kanglian_license(self) -> str:
        """生成康莲专用许可证"""
        import hashlib
        import time
        
        # 基于时间和固定种子生成
        seed = "KANGLIAN_FNIRS_SDK_2025"
        timestamp = str(int(time.time() // 86400))  # 按天更新
        
        license_data = f"{seed}:{timestamp}"
        license_hash = hashlib.sha256(license_data.encode()).hexdigest()
        
        return license_hash[:32].upper()
    
    def validate_license(self) -> bool:
        """验证许可证有效性"""
        try:
            # 检查缓存
            if self.license_key in self._validation_cache:
                return self._validation_cache[self.license_key]
            
            # 验证康莲许可证格式
            if len(self.license_key) != 32:
                return False
            
            # 检查时间有效性（示例：30天试用期）
            import time
            current_day = int(time.time() // 86400)
            license_day = self._extract_day_from_license(self.license_key)
            
            # 30天有效期
            is_valid = (current_day - license_day) <= 30
            
            # 缓存结果
            self._validation_cache[self.license_key] = is_valid
            
            return is_valid
            
        except Exception:
            return False
    
    def _extract_day_from_license(self, license_key: str) -> int:
        """从许可证中提取天数信息"""
        # 简化的提取逻辑
        try:
            return int(license_key[-8:], 16) % 100000
        except:
            return 0


class SDKProtector:
    """SDK保护器 - 主要保护类"""
    
    def __init__(self):
        self.license_validator = LicenseValidator()
        self.obfuscator = CodeObfuscator()
        
    def protect_method(self, method_name: str):
        """方法保护装饰器"""
        def decorator(func):
            def protected_func(*args, **kwargs):
                # 许可证验证
                if not self.license_validator.validate_license():
                    raise RuntimeError("Invalid license. Please contact Golgi fNIRS support.")
                
                # 执行原函数
                return func(*args, **kwargs)
            
            protected_func.__name__ = func.__name__
            protected_func.__doc__ = func.__doc__
            return protected_func
        return decorator
    
    def runtime_integrity_check(self) -> bool:
        """运行时完整性检查"""
        try:
            # 检查关键模块是否被修改
            import fnirs_sdk
            import hashlib
            
            # 计算模块哈希（简化版）
            module_path = fnirs_sdk.__file__
            if os.path.exists(module_path):
                with open(module_path, 'rb') as f:
                    content = f.read()
                current_hash = hashlib.md5(content).hexdigest()
                
                # 这里可以与预期哈希比较
                # expected_hash = "..."
                # return current_hash == expected_hash
                
                return True  # 简化实现
            
            return False
            
        except Exception:
            return False


# 实际的保护实现 - 应用到FNIRSProcessor类
def create_protected_processor():
    """创建受保护的FNIRSProcessor"""
    
    protector = SDKProtector()
    
    class ProtectedFNIRSProcessor:
        """受保护的fNIRS处理器"""
        
        def __init__(self, *args, **kwargs):
            # 许可证检查
            if not protector.license_validator.validate_license():
                raise RuntimeError("License validation failed. Contact Golgi fNIRS support.")
            
            # 完整性检查
            if not protector.runtime_integrity_check():
                raise RuntimeError("Runtime integrity check failed.")
            
            # 导入真实的处理器
            from fnirs_sdk.processor import FNIRSProcessor
            self._real_processor = FNIRSProcessor(*args, **kwargs)
        
        @protector.protect_method("connect_device")
        def connect_device(self):
            """连接设备"""
            return self._real_processor.connect_device()
        
        @protector.protect_method("get_oxygen_data")
        def get_oxygen_data(self):
            """获取血氧数据"""
            return self._real_processor.get_oxygen_data()
        
        @protector.protect_method("get_oxygen_data_json")
        def get_oxygen_data_json(self):
            """获取JSON格式血氧数据"""
            return self._real_processor.get_oxygen_data_json()
        
        @protector.protect_method("add_motion_data_matrix")
        def add_motion_data_matrix(self, motion_matrix, user_id, params):
            """添加康莲运动数据"""
            return self._real_processor.add_motion_data_matrix(motion_matrix, user_id, params)
        
        @protector.protect_method("finish_session")
        def finish_session(self, session_id):
            """结束会话"""
            return self._real_processor.finish_session(session_id)
    
    return ProtectedFNIRSProcessor


# 打包时的代码保护配置
# 注意：为解决康莲测试时的base64解码问题，暂时禁用混淆功能
PROTECTION_CONFIG = {
    'license_validation': False,  # 暂时禁用许可证验证
    'code_obfuscation': False,    # 禁用代码混淆（解决base64问题）
    'string_obfuscation': False,  # 禁用字符串混淆（解决base64问题）
    'integrity_check': False,     # 暂时禁用完整性检查
    'anti_debug': False,          # 暂时禁用反调试
    'license_duration_days': 30,  # 康莲试用期
}


def apply_protection_to_file(source_file: str, output_file: str) -> bool:
    """
    对Python文件应用保护措施
    
    Args:
        source_file: 源文件路径
        output_file: 输出文件路径
        
    Returns:
        bool: 是否成功
    """
    try:
        with open(source_file, 'r', encoding='utf-8') as f:
            source_code = f.read()
        
        # 应用字符串混淆
        if PROTECTION_CONFIG['string_obfuscation']:
            obfuscator = CodeObfuscator()
            source_code = obfuscator.obfuscate_string_literals(source_code)
        
        # 添加许可证检查
        if PROTECTION_CONFIG['license_validation']:
            license_check = '''
# License validation
import base64
def __license_check():
    try:
        from fnirs_sdk.protection import LicenseValidator
        validator = LicenseValidator()
        if not validator.validate_license():
            raise RuntimeError("Invalid license")
    except:
        exit(1)
__license_check()
del __license_check
'''
            source_code = license_check + source_code
        
        # 保存保护后的文件
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(source_code)
        
        return True
        
    except Exception as e:
        print(f"应用保护失败: {e}")
        return False


if __name__ == "__main__":
    # 测试保护功能
    print("测试SDK保护功能...")
    
    # 测试许可证验证
    validator = LicenseValidator()
    print(f"许可证验证: {validator.validate_license()}")
    
    # 测试保护的处理器
    try:
        ProtectedProcessor = create_protected_processor()
        processor = ProtectedProcessor()
        print("保护的处理器创建成功")
    except Exception as e:
        print(f"保护处理器测试失败: {e}")