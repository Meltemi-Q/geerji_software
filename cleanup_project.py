#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
戈尔基康复训练系统 - 项目精简脚本
用于清理项目中的非核心文件和历史文档
"""

import os
import shutil
import glob
from datetime import datetime
from pathlib import Path

def print_header():
    print("="*50)
    print("戈尔基康复训练系统 - 项目精简脚本")
    print("="*50)
    print("\n警告：此脚本将删除项目中的非核心文件")
    print("建议先备份整个项目！\n")
    
    response = input("是否继续？(y/n): ")
    if response.lower() != 'y':
        print("操作已取消")
        exit(0)

def delete_zone_identifier_files():
    """删除所有Zone.Identifier文件"""
    print("\n[1/6] 删除所有 Zone.Identifier 文件...")
    count = 0
    for root, dirs, files in os.walk('.'):
        for file in files:
            if 'Zone.Identifier' in file:
                filepath = os.path.join(root, file)
                try:
                    os.remove(filepath)
                    count += 1
                except:
                    pass
    print(f"完成！删除了 {count} 个文件")

def clean_docs_folder():
    """精简docs文件夹"""
    print("\n[2/6] 精简 docs 文件夹...")
    patterns = [
        "docs/*SNOWBALL*.md*",
        "docs/LANE_GAME_RESEARCH.md*",
        "docs/*test*.md*",
        "docs/phase8*.md*",
        "docs/hm-test*.md*"
    ]
    
    count = 0
    for pattern in patterns:
        for file in glob.glob(pattern):
            try:
                os.remove(file)
                count += 1
            except:
                pass
    print(f"完成！删除了 {count} 个文档")

def remove_test_files():
    """删除测试相关文件"""
    print("\n[3/6] 删除测试临时文件...")
    
    # 删除目录
    dirs_to_remove = ['.playwright-mcp', 'test-results', 'test_screenshots']
    for dir_name in dirs_to_remove:
        if os.path.exists(dir_name):
            shutil.rmtree(dir_name)
            print(f"  删除目录: {dir_name}")
    
    # 删除文件
    files_to_remove = [
        'AUTOMATED_TEST_REPORT.md*',
        'UI_TEST_REPORT.md*',
        'standby-test-mode-modification.md*'
    ]
    for pattern in files_to_remove:
        for file in glob.glob(pattern):
            os.remove(file)
            print(f"  删除文件: {file}")
    
    print("完成！")

def backup_extra_tool():
    """备份并移除extra_tool文件夹"""
    print("\n[4/6] 移除 extra_tool 文件夹...")
    
    if os.path.exists('extra_tool'):
        backup_name = f"../extra_tool_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        shutil.move('extra_tool', backup_name)
        print(f"已备份到: {backup_name}")
    else:
        print("extra_tool 文件夹不存在，跳过...")

def remove_obelab_files():
    """删除Obelab相关文件"""
    print("\n[5/6] 删除 Obelab 相关文件...")
    
    patterns = ["src/components/ObelabTrainingView.vue*"]
    count = 0
    for pattern in patterns:
        for file in glob.glob(pattern):
            try:
                os.remove(file)
                count += 1
            except:
                pass
    print(f"完成！删除了 {count} 个文件")

def calculate_saved_space():
    """计算节省的空间（简单估算）"""
    print("\n[6/6] 计算节省空间...")
    # 这里只是估算，实际可能有差异
    saved_mb = 3.6  # 根据分析报告的估算
    print(f"预计节省空间: ~{saved_mb:.1f} MB")

def print_summary():
    """打印总结信息"""
    print("\n" + "="*50)
    print("项目精简完成！")
    print("="*50)
    print("\n建议执行以下操作：")
    print("1. 运行 'npm install' 确保依赖正常")
    print("2. 运行 'npm run dev' 测试项目是否正常运行")
    print("3. 使用 'git status' 查看文件变更")
    print("4. 如果一切正常，提交更改到Git")

def main():
    """主函数"""
    print_header()
    
    # 确保在项目根目录运行
    if not os.path.exists('package.json'):
        print("错误：请在项目根目录运行此脚本！")
        exit(1)
    
    # 执行清理操作
    delete_zone_identifier_files()
    clean_docs_folder()
    remove_test_files()
    backup_extra_tool()
    remove_obelab_files()
    calculate_saved_space()
    
    print_summary()

if __name__ == "__main__":
    main()