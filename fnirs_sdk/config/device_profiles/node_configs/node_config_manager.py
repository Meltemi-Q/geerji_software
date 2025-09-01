#!/usr/bin/env python3
"""
Node配置管理器 - 根据不同的node选择生成对应的LUMO配置
支持三角形、矩形等多种布局模式
"""
import json
import toml
import os
from pathlib import Path

class NodeConfigManager:
    def __init__(self, layout_config_path=None):
        """初始化配置管理器"""
        if layout_config_path is None:
            current_dir = Path(__file__).parent
            layout_config_path = current_dir / "node_layout_config.json"
        
        with open(layout_config_path, 'r', encoding='utf-8') as f:
            self.config = json.load(f)
    
    def get_available_layouts(self):
        """获取所有可用的布局模式"""
        layouts = []
        for layout_name, layout_info in self.config["layout_definitions"].items():
            layouts.append({
                "name": layout_name,
                "description": layout_info["description"],
                "nodes": layout_info["selected_nodes"],
                "pattern": layout_info["layout_pattern"]
            })
        return layouts
    
    def generate_chans_list(self, selected_nodes):
        """根据选择的nodes生成LUMO格式的chans_list"""
        rules = self.config["mapping_rules"]
        lumo_format = self.config["lumo_format"]
        
        # 验证node数量
        if len(selected_nodes) != 6:
            raise ValueError(f"需要选择6个node，当前选择了{len(selected_nodes)}个")
        
        # 生成chans_list
        chans_list = []
        wavelengths = rules["wavelengths"]
        
        # 按LUMO格式：先所有波长1，再所有波长2
        for wl in wavelengths:
            for src in range(1, rules["total_sources_lumo"] + 1):
                for det in range(1, rules["total_detectors_lumo"] + 1):
                    chans_list.append([src, det, wl])
        
        return chans_list
    
    def generate_node_mapping(self, selected_nodes):
        """生成node到LUMO编号的映射关系"""
        rules = self.config["mapping_rules"]
        
        # 排序node，按配置文件中的顺序
        sorted_nodes = selected_nodes.copy()
        
        # 生成源映射
        source_mapping = {}
        source_id = 1
        for node in sorted_nodes:
            dock_name = f"dock_{node}"
            source_mapping[dock_name] = {
                'lumo_sources': list(range(source_id, source_id + 3)),
                'physical_optodes': rules["optode_naming"]["sources"]
            }
            source_id += 3
        
        # 生成检测器映射
        detector_mapping = {}
        detector_id = 1
        for node in sorted_nodes:
            dock_name = f"dock_{node}"
            detector_mapping[dock_name] = {
                'lumo_detectors': list(range(detector_id, detector_id + 4)),
                'physical_optodes': rules["optode_naming"]["detectors"]
            }
            detector_id += 4
        
        return source_mapping, detector_mapping
    
    def generate_recordingdata_toml(self, layout_name, output_path=None):
        """为指定的布局生成recordingdata.toml配置文件"""
        if layout_name not in self.config["layout_definitions"]:
            raise ValueError(f"未知的布局类型: {layout_name}")
        
        layout_def = self.config["layout_definitions"][layout_name]
        selected_nodes = layout_def["selected_nodes"]
        
        # 生成chans_list
        chans_list = self.generate_chans_list(selected_nodes)
        
        # 生成映射关系
        source_mapping, detector_mapping = self.generate_node_mapping(selected_nodes)
        
        # 构建TOML配置
        config = {
            'variables': {
                'wavelength': [735, 850],
                'nodes': selected_nodes,
                'n_srcs': 18,
                'n_dets': 24,
                'n_chans': 864,
                'channels': 864,
                'sample_rate': 8.0,
                'chans_list': chans_list,
                't_0': 1724988478486,
                'framerate': 8.0,
                'chans_list_act': [1] * 864,
                't_last': 1724988667894,
                'number_of_frames': 1894
            }
        }
        
        # 保存文件
        if output_path is None:
            output_path = f"recordingdata_{layout_name}.toml"
        
        with open(output_path, 'w', encoding='utf-8') as f:
            toml.dump(config, f)
        
        return {
            'config_path': output_path,
            'layout_info': layout_def,
            'source_mapping': source_mapping,
            'detector_mapping': detector_mapping,
            'total_channels': len(chans_list)
        }
    
    def print_layout_analysis(self, layout_name):
        """打印指定布局的详细分析"""
        if layout_name not in self.config["layout_definitions"]:
            print(f"错误: 未知的布局类型 {layout_name}")
            return
        
        layout_def = self.config["layout_definitions"][layout_name]
        selected_nodes = layout_def["selected_nodes"]
        
        print(f"=== {layout_name} 布局分析 ===")
        print(f"描述: {layout_def['description']}")
        print(f"选择的nodes: {selected_nodes}")
        print(f"布局模式: {layout_def['layout_pattern']}")
        
        # 生成映射关系
        source_mapping, detector_mapping = self.generate_node_mapping(selected_nodes)
        
        print("\n源映射 (按选择顺序):")
        for i, node in enumerate(selected_nodes):
            dock_name = f"dock_{node}"
            sources = source_mapping[dock_name]['lumo_sources']
            print(f"  {dock_name} sources (a,b,c) → LUMO sources {sources[0]}-{sources[-1]}")
        
        print("\n检测器映射 (按选择顺序):")
        for i, node in enumerate(selected_nodes):
            dock_name = f"dock_{node}"
            detectors = detector_mapping[dock_name]['lumo_detectors']
            print(f"  {dock_name} detectors (1,2,3,4) → LUMO detectors {detectors[0]}-{detectors[-1]}")

def main():
    print("Node配置管理器 - 支持多种布局模式的LUMO配置生成")
    
    # 初始化配置管理器
    manager = NodeConfigManager()
    
    # 显示可用布局
    print("\n=== 可用布局模式 ===")
    layouts = manager.get_available_layouts()
    for layout in layouts:
        print(f"{layout['name']}: {layout['description']}")
        print(f"  节点: {layout['nodes']}")
        print(f"  模式: {layout['pattern']}")
        print()
    
    # 生成默认配置的分析
    print("=== 默认6节点配置分析 ===")
    manager.print_layout_analysis("default_6node")
    
    # 生成三角形布局配置
    print("\n=== 三角形布局配置分析 ===")
    manager.print_layout_analysis("triangle_center")
    
    # 生成配置文件
    current_dir = Path(__file__).parent
    default_output = current_dir / "recordingdata_default_6node.toml"
    triangle_output = current_dir / "recordingdata_triangle_center.toml"
    
    print(f"\n=== 生成配置文件 ===")
    result1 = manager.generate_recordingdata_toml("default_6node", default_output)
    result2 = manager.generate_recordingdata_toml("triangle_center", triangle_output)
    
    print(f"默认6节点配置已保存到: {result1['config_path']}")
    print(f"三角形布局配置已保存到: {result2['config_path']}")
    
    print(f"\n配置生成完成！可以使用这些配置替换原始的recordingdata.toml文件")

if __name__ == "__main__":
    main()