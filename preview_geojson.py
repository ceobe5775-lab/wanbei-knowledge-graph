#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
使用 Folium 预览 GeoJSON 文件
生成一个 HTML 地图文件，可以在浏览器中打开查看
"""

import json
import os
import folium
from folium import plugins

def preview_geojson(geojson_file, output_file=None):
    """
    预览 GeoJSON 文件
    
    Args:
        geojson_file: GeoJSON 文件路径
        output_file: 输出的 HTML 文件路径（可选）
    """
    if not os.path.exists(geojson_file):
        print(f'错误: 文件不存在: {geojson_file}')
        return
    
    # 读取 GeoJSON 文件
    with open(geojson_file, 'r', encoding='utf-8') as f:
        geo_data = json.load(f)
    
    # 获取所有要素的边界框
    features = geo_data.get('features', [])
    if not features:
        print('错误: GeoJSON 文件中没有要素')
        return
    
    # 计算中心点和边界
    all_coords = []
    for feature in features:
        geometry = feature.get('geometry', {})
        coords = geometry.get('coordinates', [])
        
        # 处理 MultiPolygon
        if geometry.get('type') == 'MultiPolygon':
            for polygon in coords:
                for ring in polygon:
                    all_coords.extend(ring)
        # 处理 Polygon
        elif geometry.get('type') == 'Polygon':
            for ring in coords:
                all_coords.extend(ring)
    
    if not all_coords:
        print('错误: 无法提取坐标')
        return
    
    # 计算中心点
    lats = [coord[1] for coord in all_coords]
    lons = [coord[0] for coord in all_coords]
    center_lat = (min(lats) + max(lats)) / 2
    center_lon = (min(lons) + max(lons)) / 2
    
    # 创建地图
    m = folium.Map(
        location=[center_lat, center_lon],
        zoom_start=7,
        tiles='OpenStreetMap'
    )
    
    # 城市颜色映射
    city_colors = {
        '蚌埠市': 'red',
        '亳州市': 'blue',
        '阜阳市': 'green',
        '淮北市': 'orange',
        '淮南市': 'purple',
        '宿州市': 'darkred'
    }
    
    # 添加 GeoJSON 图层
    def style_function(feature):
        city_name = feature.get('properties', {}).get('name', '未知')
        color = city_colors.get(city_name, 'gray')
        
        return {
            'fillColor': color,
            'color': '#333',
            'weight': 2,
            'fillOpacity': 0.4,
            'opacity': 0.8
        }
    
    def highlight_function(feature):
        return {
            'weight': 4,
            'fillOpacity': 0.6
        }
    
    # 添加 GeoJSON
    folium.GeoJson(
        geo_data,
        style_function=style_function,
        highlight_function=highlight_function,
        tooltip=folium.GeoJsonTooltip(
            fields=['name', 'adcode', 'level'],
            aliases=['城市:', '代码:', '级别:'],
            localize=True
        ),
        popup=folium.GeoJsonPopup(
            fields=['name', 'adcode', 'level', 'center'],
            aliases=['城市:', '代码:', '级别:', '中心:'],
            localize=True
        )
    ).add_to(m)
    
    # 添加图例
    legend_html = '''
    <div style="position: fixed; 
                bottom: 50px; right: 50px; width: 200px; height: auto; 
                background-color: white; z-index:9999; font-size:14px;
                border:2px solid grey; border-radius:5px; padding: 10px">
    <h4 style="margin-top:0;">城市图例</h4>
    '''
    
    for city, color in city_colors.items():
        legend_html += f'''
        <p><i class="fa fa-square" style="color:{color}"></i> {city}</p>
        '''
    
    legend_html += '</div>'
    m.get_root().html.add_child(folium.Element(legend_html))
    
    # 添加全屏按钮
    plugins.Fullscreen().add_to(m)
    
    # 保存文件
    if output_file is None:
        output_file = geojson_file.replace('.geojson', '_preview.html')
    
    m.save(output_file)
    print(f'预览文件已生成: {output_file}')
    print(f'在浏览器中打开查看: file:///{os.path.abspath(output_file).replace(os.sep, "/")}')

def main():
    import sys
    
    if len(sys.argv) > 1:
        geojson_file = sys.argv[1]
    else:
        # 默认预览六个城市边界
        geojson_file = os.path.join(os.path.dirname(__file__), 'six_cities_boundaries.geojson')
    
    if len(sys.argv) > 2:
        output_file = sys.argv[2]
    else:
        output_file = None
    
    preview_geojson(geojson_file, output_file)

if __name__ == '__main__':
    main()


