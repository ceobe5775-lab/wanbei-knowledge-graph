#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
从安徽省 GeoJSON 文件中提取皖北六市的边界数据
"""

import json
import os
from pathlib import Path

# 皖北六市列表
SIX_CITIES = ['蚌埠市', '亳州市', '阜阳市', '淮北市', '淮南市', '宿州市']

def extract_six_cities():
    """从安徽省 GeoJSON 中提取六个城市"""
    boundaries_dir = Path('boundaries')
    anhui_file = boundaries_dir / '安徽省.json'
    
    if not anhui_file.exists():
        print(f'错误: 文件不存在: {anhui_file}')
        return
    
    # 读取安徽省 GeoJSON
    print(f'正在读取: {anhui_file}')
    with open(anhui_file, 'r', encoding='utf-8') as f:
        anhui_data = json.load(f)
    
    # 提取六个城市的 features
    six_cities_features = []
    found_cities = []
    
    for feature in anhui_data.get('features', []):
        props = feature.get('properties', {})
        city_name = props.get('name', '')
        
        if city_name in SIX_CITIES:
            six_cities_features.append(feature)
            found_cities.append(city_name)
            print(f'  找到: {city_name}')
    
    if len(six_cities_features) != len(SIX_CITIES):
        missing = set(SIX_CITIES) - set(found_cities)
        if missing:
            print(f'警告: 未找到以下城市: {missing}')
    
    # 创建新的 GeoJSON
    result = {
        "type": "FeatureCollection",
        "features": six_cities_features
    }
    
    # 保存文件
    output_file = 'six_cities_from_anhui.geojson'
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    
    print(f'\n完成! 已提取 {len(six_cities_features)} 个城市')
    print(f'输出文件: {output_file}')
    print(f'\n包含的城市: {", ".join(found_cities)}')

if __name__ == '__main__':
    extract_six_cities()


