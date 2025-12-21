"""
下载并处理皖北六市的GeoJSON边界数据
从阿里云数据源下载，生成市的合并边界和县/区详细边界
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

# 城市代码映射（adcode -> 城市名称）
CITY_MAPPING = {
    '341200': {'name': '阜阳市', 'key': '阜阳'},
    '341600': {'name': '亳州市', 'key': '亳州'},
    '340400': {'name': '淮南市', 'key': '淮南'},
    '340300': {'name': '蚌埠市', 'key': '蚌埠'},
    '340600': {'name': '淮北市', 'key': '淮北'},
    '341300': {'name': '宿州市', 'key': '宿州'},
}

BASE_URL = 'https://geo.datav.aliyun.com/areas_v3/bound/{adcode}_full.json'

def download_geojson(adcode):
    """下载指定城市的GeoJSON数据"""
    url = BASE_URL.format(adcode=adcode)
    print(f"正在下载 {CITY_MAPPING[adcode]['name']} ({url})...")
    
    try:
        with urllib.request.urlopen(url) as response:
            data = json.loads(response.read().decode('utf-8'))
            print(f"  [OK] 下载成功")
            return data
    except Exception as e:
        print(f"  [ERROR] 下载失败: {e}")
        return None

def extract_city_boundary(geojson_data, city_name):
    """从GeoJSON中提取市的合并边界（只包含市级别features）"""
    if not geojson_data or geojson_data.get('type') != 'FeatureCollection':
        return None
    
    features = geojson_data.get('features', [])
    if not features:
        return None
    
    # 查找市级别的feature
    # 市边界的特征：
    # 1. adcode以00结尾（如341200, 341600等）
    # 2. 或者name完全匹配城市名（如"阜阳市"）
    city_feature = None
    for feature in features:
        props = feature.get('properties', {})
        adcode = props.get('adcode', 0)
        name = props.get('name', '')
        parent = props.get('parent', {})
        parent_adcode = parent.get('adcode', 0) if isinstance(parent, dict) else 0
        
        # 判断是否是市边界
        is_city = (
            name == city_name or  # name完全匹配城市名
            (adcode % 100 == 0 and adcode % 10000 != 0) or  # adcode以00结尾（市级）
            (parent_adcode % 100 == 0 and parent_adcode % 10000 != 0 and adcode % 100 != 0)  # parent是市级，但自己是区级（可能是整个市的合并边界）
        )
        
        if is_city:
            city_feature = feature
            # 确保properties正确
            props['name'] = city_name
            props['type'] = 'city'
            props['级别'] = '市'
            props['level'] = 'city'
            # 如果adcode不是市级，标记为市边界（用于初始视图）
            if adcode % 100 != 0:
                props['isCityBoundary'] = True
            break
    
    # 如果没有找到市级别feature，使用第一个feature（通常是整个市的边界）
    if not city_feature and features:
        first_feature = features[0]
        first_props = first_feature.get('properties', {})
        parent = first_props.get('parent', {})
        parent_adcode = parent.get('adcode', 0) if isinstance(parent, dict) else 0
        
        # 如果第一个feature的parent是市级，那么它可能是整个市的合并边界
        if parent_adcode % 100 == 0 and parent_adcode % 10000 != 0:
            city_feature = first_feature
            first_props['name'] = city_name
            first_props['type'] = 'city'
            first_props['级别'] = '市'
            first_props['level'] = 'city'
            first_props['isCityBoundary'] = True
    
    return city_feature

def extract_county_features(geojson_data, city_name, city_feature):
    """提取所有县/区级别的features"""
    if not geojson_data or geojson_data.get('type') != 'FeatureCollection':
        return []
    
    features = geojson_data.get('features', [])
    county_features = []
    
    for feature in features:
        # 跳过市边界feature
        if feature == city_feature:
            continue
            
        props = feature.get('properties', {})
        adcode = props.get('adcode', 0)
        name = props.get('name', '')
        level = props.get('level', '')
        
        # 判断是否是县/区：
        # 1. adcode不以00结尾（如341202, 341203等）
        # 2. name以"区"或"县"结尾
        # 3. 或者level是district或county
        is_county_or_district = (
            (adcode % 100 != 0) or  # adcode不以00结尾
            name.endswith('区') or  # name以"区"结尾
            name.endswith('县') or  # name以"县"结尾
            level in ['district', 'county']  # level是district或county
        )
        
        if is_county_or_district:
            # 确保级别信息正确
            if '县' in name or name.endswith('县'):
                props['级别'] = '县'
                props['level'] = 'county'
                props['type'] = 'county'
            elif '区' in name or name.endswith('区'):
                props['级别'] = '区'
                props['level'] = 'district'
                props['type'] = 'district'
                # 确保name以"区"结尾
                if not name.endswith('区'):
                    props['name'] = name.replace('市', '区')
            
            county_features.append(feature)
    
    return county_features

def process_city_data(adcode):
    """处理单个城市的数据"""
    city_info = CITY_MAPPING[adcode]
    city_name = city_info['name']
    city_key = city_info['key']
    
    print(f"\n处理 {city_name}...")
    
    # 下载数据
    geojson_data = download_geojson(adcode)
    if not geojson_data:
        return False
    
    # 提取市边界
    city_boundary = extract_city_boundary(geojson_data, city_name)
    
    # 提取县/区features
    county_features = extract_county_features(geojson_data, city_name, city_boundary)
    
    # 如果没有找到县/区features，使用所有features（除了市边界）
    if not county_features:
        all_features = geojson_data.get('features', [])
        county_features = [f for f in all_features if f != city_boundary]
    
    # 保存完整的原始数据（包含市边界和所有县/区features）
    boundaries_dir = Path('boundaries')
    boundaries_dir.mkdir(exist_ok=True)
    
    city_boundary_file = boundaries_dir / f"{city_name}.json"
    
    # 保存完整的原始数据（包含所有features）
    all_data = {
        "type": "FeatureCollection",
        "features": geojson_data.get('features', [])
    }
    
    # 修正所有features的属性
    city_boundary_found = False
    for i, feature in enumerate(all_data['features']):
        props = feature.get('properties', {})
        adcode = props.get('adcode', 0)
        name = props.get('name', '')
        parent = props.get('parent', {})
        parent_adcode = parent.get('adcode', 0) if isinstance(parent, dict) else 0
        
        # 判断是否是市边界
        is_city = (
            name == city_name or
            (adcode % 100 == 0 and adcode % 10000 != 0) or
            (i == 0 and parent_adcode % 100 == 0 and parent_adcode % 10000 != 0)  # 第一个feature且parent是市级
        )
        
        if is_city and not city_boundary_found:
            # 市边界（只标记第一个）
            props['name'] = city_name
            props['type'] = 'city'
            props['级别'] = '市'
            props['level'] = 'city'
            if adcode % 100 != 0:
                props['isCityBoundary'] = True
            city_boundary_found = True
        elif name.endswith('区') or '区' in name or (adcode % 100 in [2, 3, 4, 5, 6, 7, 8, 9, 11] and adcode % 10000 != 0):
            # 区（adcode以02-11结尾，且不是00结尾）
            props['级别'] = '区'
            props['level'] = 'district'
            props['type'] = 'district'
            # 确保name以"区"结尾
            if not name.endswith('区'):
                # 如果name以"市"结尾，替换为"区"
                if name.endswith('市'):
                    props['name'] = name.replace('市', '区')
                elif '区' not in name:
                    # 如果name中没有"区"，添加"区"
                    props['name'] = name + '区'
        elif name.endswith('县') or '县' in name or (adcode % 100 >= 21 and adcode % 100 <= 29):
            # 县（adcode以21-29结尾）
            props['级别'] = '县'
            props['level'] = 'county'
            props['type'] = 'county'
    
    with open(city_boundary_file, 'w', encoding='utf-8') as f:
        json.dump(all_data, f, ensure_ascii=False, indent=2)
    print(f"  [OK] 已保存完整数据: {city_boundary_file} (包含 {len(all_data['features'])} 个区域)")
    
    # 打印统计信息
    print(f"  - 市边界: {'已提取' if city_boundary else '使用完整数据'}")
    print(f"  - 县/区数量: {len(county_features)}")
    
    return True

def main():
    """主函数"""
    print("=" * 60)
    print("下载并处理皖北六市GeoJSON边界数据")
    print("=" * 60)
    print()
    
    boundaries_dir = Path('boundaries')
    boundaries_dir.mkdir(exist_ok=True)
    
    success_count = 0
    for adcode in CITY_MAPPING.keys():
        if process_city_data(adcode):
            success_count += 1
    
    print()
    print("=" * 60)
    print(f"完成！成功处理 {success_count}/{len(CITY_MAPPING)} 个城市")
    print("=" * 60)
    print()
    print("生成的文件:")
    print(f"  - boundaries/ 目录下的各市JSON文件")
    print()
    print("注意:")
    print("  1. 如果某个城市的JSON包含多个features，第一个通常是市边界")
    print("  2. 其他features是县/区边界")
    print("  3. 前端代码需要根据level属性区分市和县/区")

if __name__ == '__main__':
    main()

