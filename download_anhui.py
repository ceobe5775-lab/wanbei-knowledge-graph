#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
下载安徽省的 GeoJSON 边界数据
"""

import json
import os
import sys
import urllib.request
from pathlib import Path

# 设置输出编码为UTF-8
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# 安徽省的 adcode
ANHUI_ADCODE = '340000'
BASE_URL = 'https://geo.datav.aliyun.com/areas_v3/bound/{adcode}_full.json'

def download_anhui_geojson():
    """下载安徽省的 GeoJSON 数据"""
    url = BASE_URL.format(adcode=ANHUI_ADCODE)
    print(f"正在下载安徽省边界数据...")
    print(f"URL: {url}")
    
    try:
        with urllib.request.urlopen(url) as response:
            data = json.loads(response.read().decode('utf-8'))
            print(f"下载成功!")
            return data
    except Exception as e:
        print(f"下载失败: {e}")
        return None

def main():
    """主函数"""
    print("=" * 60)
    print("下载安徽省 GeoJSON 边界数据")
    print("=" * 60)
    print()
    
    # 下载数据
    geojson_data = download_anhui_geojson()
    if not geojson_data:
        print("下载失败，请检查网络连接")
        return
    
    # 保存文件
    boundaries_dir = Path('boundaries')
    boundaries_dir.mkdir(exist_ok=True)
    
    output_file = boundaries_dir / '安徽省.json'
    
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(geojson_data, f, ensure_ascii=False, indent=2)
    
    # 显示统计信息
    features = geojson_data.get('features', [])
    print(f"\n文件已保存: {output_file}")
    print(f"包含 {len(features)} 个要素")
    
    # 显示前几个要素的信息
    print("\n前几个要素信息:")
    for i, feature in enumerate(features[:5]):
        props = feature.get('properties', {})
        name = props.get('name', '未知')
        adcode = props.get('adcode', '未知')
        level = props.get('level', '未知')
        print(f"  {i+1}. {name} (adcode: {adcode}, level: {level})")
    
    if len(features) > 5:
        print(f"  ... 还有 {len(features) - 5} 个要素")
    
    print("\n完成!")

if __name__ == '__main__':
    main()


