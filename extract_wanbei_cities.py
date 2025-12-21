"""
从安徽省.geojson中提取皖北六市的数据
"""
import json
from pathlib import Path
import sys

sys.stdout.reconfigure(encoding='utf-8')

# 皖北六市的adcode
WANBEI_CITIES_ADCODES = {
    '341200': '阜阳市',
    '341600': '亳州市',
    '340400': '淮南市',
    '340300': '蚌埠市',
    '340600': '淮北市',
    '341300': '宿州市',
}

def extract_wanbei_cities(input_file, output_file):
    """从安徽省.geojson中提取皖北六市的数据"""
    print(f"正在读取文件: {input_file}")
    
    with open(input_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    features = data.get('features', [])
    print(f"原始文件包含 {len(features)} 个features")
    
    # 提取皖北六市的features
    wanbei_features = []
    found_cities = set()
    
    for feature in features:
        props = feature.get('properties', {})
        adcode = props.get('adcode', '')
        name = props.get('name', '')
        
        # 检查是否是皖北六市（通过adcode或name）
        is_wanbei = False
        city_name = None
        
        # 方法1：通过adcode判断（市级adcode以00结尾）
        if adcode:
            adcode_str = str(adcode)
            # 检查是否是市级adcode（341200, 341600等）
            if adcode_str in WANBEI_CITIES_ADCODES:
                is_wanbei = True
                city_name = WANBEI_CITIES_ADCODES[adcode_str]
            # 检查是否是这些市的子区域（341202, 341203等）
            elif len(adcode_str) == 6:
                city_adcode = adcode_str[:4] + '00'
                if city_adcode in WANBEI_CITIES_ADCODES:
                    is_wanbei = True
                    city_name = WANBEI_CITIES_ADCODES[city_adcode]
        
        # 方法2：通过name判断
        if not is_wanbei and name:
            for city_name_check in WANBEI_CITIES_ADCODES.values():
                if name.startswith(city_name_check) or city_name_check in name:
                    is_wanbei = True
                    city_name = city_name_check
                    break
        
        if is_wanbei:
            wanbei_features.append(feature)
            if city_name:
                found_cities.add(city_name)
            print(f"  找到: {name} (adcode={adcode})")
    
    print(f"\n提取结果:")
    print(f"  - 找到 {len(wanbei_features)} 个features")
    print(f"  - 涉及城市: {', '.join(sorted(found_cities))}")
    
    # 创建新的GeoJSON
    output_data = {
        "type": "FeatureCollection",
        "features": wanbei_features
    }
    
    # 保存到新文件
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, ensure_ascii=False, indent=2)
    
    print(f"\n已保存到: {output_file}")
    print(f"包含 {len(wanbei_features)} 个features")

if __name__ == '__main__':
    boundaries_dir = Path('boundaries')
    input_file = boundaries_dir / '安徽省.geojson'
    output_file = boundaries_dir / '皖北六市.geojson'
    
    if not input_file.exists():
        print(f"错误: 文件不存在: {input_file}")
        sys.exit(1)
    
    extract_wanbei_cities(input_file, output_file)


