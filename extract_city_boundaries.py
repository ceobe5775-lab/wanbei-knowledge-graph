#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
提取六个市的边界线
从 boundaries 目录下的 JSON 文件中提取城市边界，合并为一个 GeoJSON 文件
"""

import json
import os

def extract_city_boundary(file_path):
    """从 JSON 文件中提取城市边界"""
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # 查找城市边界（isCityBoundary 为 true 的 feature）
    for feature in data.get('features', []):
        props = feature.get('properties', {})
        if props.get('isCityBoundary') == True or props.get('level') == 'city':
            return feature
    
    return None

def main():
    # 城市列表
    cities = ['蚌埠市', '亳州市', '阜阳市', '淮北市', '淮南市', '宿州市']
    
    # boundaries 目录路径
    boundaries_dir = os.path.join(os.path.dirname(__file__), 'boundaries')
    
    # 存储提取的边界
    features = []
    
    # 遍历每个城市文件
    for city in cities:
        file_path = os.path.join(boundaries_dir, f'{city}.json')
        
        if not os.path.exists(file_path):
            print(f'警告: 文件不存在: {file_path}')
            continue
        
        print(f'正在处理: {city}...')
        feature = extract_city_boundary(file_path)
        
        if feature:
            features.append(feature)
            print(f'  成功提取 {city} 边界')
        else:
            print(f'  未找到 {city} 边界')
    
    # 创建合并的 GeoJSON
    result = {
        "type": "FeatureCollection",
        "features": features
    }
    
    # 保存结果
    output_path = os.path.join(os.path.dirname(__file__), 'six_cities_boundaries.geojson')
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    
    print(f'\n完成! 已提取 {len(features)} 个城市的边界线')
    print(f'输出文件: {output_path}')

if __name__ == '__main__':
    main()

