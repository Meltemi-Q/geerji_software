#!/usr/bin/env python3
"""
fNIRS SDK Multi-Manufacturer Integration - Setup Script

多厂家设备集成fNIRS SDK安装脚本
"""

from setuptools import setup, find_packages
import os

# 读取README文件作为长描述
def read_readme():
    readme_path = os.path.join(os.path.dirname(__file__), 'README.md')
    if os.path.exists(readme_path):
        with open(readme_path, 'r', encoding='utf-8') as f:
            return f.read()
    return "fNIRS SDK - 近红外光谱脑氧监测SDK，支持多厂家设备集成"

# 版本信息  
VERSION = "2.2.1"  # 数据流架构修复版：修复processor缓冲区真实数据与报告生成器衔接问题

setup(
    # 基础信息
    name="fnirs-sdk-multi",  # 多设备厂家通用SDK
    version=VERSION,
    description="fNIRS SDK - 多厂家设备集成+精准分离上传+云端数据备份SDK",
    long_description=read_readme(),
    long_description_content_type="text/markdown",
    
    # 作者信息
    author="开发团队",
    author_email="team@golgi-fnirs.com",
    
    # 包信息
    packages=find_packages(),
    include_package_data=True,
    
    # Python版本要求
    python_requires=">=3.8",
    
    # 核心依赖项（移除PDF生成相关依赖）
    install_requires=[
        'numpy>=1.21.0',
        'scipy>=1.7.0',
        'pyserial>=3.5',
        'toml>=0.10.0',
        'requests>=2.25.0',  # 云端API通信
        'dataclasses;python_version<"3.7"',  # 数据类支持
    ],
    
    # 可选依赖
    extras_require={
        'dev': [
            'pytest>=6.0',
            'pytest-cov>=2.0',
        ],
        'visualization': [
            'matplotlib>=3.3.0',
            'pyqtgraph>=0.12.0',
        ],
        'complete': [
            'matplotlib>=3.3.0',
            'pyqtgraph>=0.12.0',
            'pandas>=1.3.0',
        ]
    },
    
    # 分类信息
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Science/Research",
        "Intended Audience :: Healthcare Industry",
        "Topic :: Scientific/Engineering :: Medical Science Apps.",
        "Topic :: Scientific/Engineering :: Information Analysis",
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
        "Programming Language :: Python :: 3.13",
        "Operating System :: OS Independent",
    ],
    
    # 关键词
    keywords="fnirs nirs brain oxygen multi-manufacturer kanglian kangzhuxia golgi visualization rehabilitation medical data-separation precise-upload cloud-backup",
    
    # 许可证
    license="MIT",
    
    # 包数据
    package_data={
        'fnirs_sdk': [
            'config/**/*.toml',
            'config/**/*.json',
            'encrypted_data/*',
        ],
    },
    
    # Zip安全
    zip_safe=False,
    
    # 测试套件
    test_suite='tests',
    tests_require=[
        'pytest>=6.0',
    ],
)