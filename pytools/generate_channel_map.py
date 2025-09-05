#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
从 recordingdata.toml 生成通道映射表（source_index, detector_index, wavelength）
输出到 public/config/channel_map.json，供前端与 432 通道数据顺序对齐。

使用方法：
  1) 激活虚拟环境并安装依赖：pip install toml
  2) python pytools/generate_channel_map.py
"""

import json
import os
import re
from pathlib import Path

try:
    import toml  # type: ignore
except Exception as e:
    raise SystemExit("请先安装 toml 模块：pip install toml")

ROOT = Path(__file__).resolve().parents[1]
REC_FILE = ROOT / 'fnirs_sdk' / 'config' / 'device_profiles' / 'triangle' / 'recordingdata.toml'
OUT_FILE = ROOT / 'public' / 'config' / 'channel_map.json'


def parse_chans_list(toml_text: str):
    """解析 recordingdata.toml 中的 chans_list = [ [src, det, wave], ... ]"""
    # 简单解析：找到 "chans_list = [ ... ]" 段落并提取三元组
    m = re.search(r"chans_list\s*=\s*\[(.*?)]\s*\n", toml_text, re.S)
    if not m:
        raise ValueError('未找到 chans_list 段落')
    body = m.group(1)
    triples = re.findall(r"\[\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*]", body)
    items = []
    for idx, (s, d, w) in enumerate(triples):
        items.append({
            'index': idx,
            'source_index': int(s),
            'detector_index': int(d),
            'wavelength': int(w)
        })
    return items


def main():
    if not REC_FILE.exists():
        raise SystemExit(f'未找到录制配置文件: {REC_FILE}')
    text = REC_FILE.read_text(encoding='utf-8')
    items = parse_chans_list(text)
    os.makedirs(OUT_FILE.parent, exist_ok=True)
    OUT_FILE.write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'✓ 已生成通道映射: {OUT_FILE} (共 {len(items)} 条)')


if __name__ == '__main__':
    main()

