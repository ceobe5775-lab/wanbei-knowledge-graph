#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
数据整理和补充脚本
整合CSV和JSON数据，补充属性，添加数据来源
"""

import json
import csv
import os
from collections import defaultdict
from datetime import datetime

# 数据来源信息
DATA_SOURCES = {
    'rel_E&E.csv': '事件与事件关系数据',
    'rel_E&L.csv': '事件与地点关系数据',
    'rel_E&P.csv': '事件与人物关系数据',
    'rel_P&L.csv': '人物与地点关系数据',
    'rel_P&P.csv': '人物与人物关系数据',
    '淝水.json': '淝水之战知识图谱数据',
    '双堆集.json': '双堆集战争知识图谱数据',
    '花园口决堤_Neo4j导入脚本_最终版.cypher': '花园口决堤知识图谱数据'
}

def load_csv_relationships(file_path, source_name):
    """加载CSV关系文件"""
    relationships = []
    with open(file_path, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            rel = {
                'source': source_name,
                'data': row
            }
            relationships.append(rel)
    return relationships

def load_json_data(file_path, source_name):
    """加载JSON数据文件"""
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    return {
        'source': source_name,
        'data': data
    }

def parse_cypher_file(file_path):
    """解析Cypher文件，提取节点和关系"""
    nodes = []
    relationships = []
    
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 提取节点
    node_pattern = r'CREATE\s+\((\w+):([^:]+)(?::([^:]+))?\s*\{([^}]+)\}\)'
    import re
    
    for match in re.finditer(node_pattern, content):
        var_name = match.group(1)
        label1 = match.group(2).strip()
        label2 = match.group(3).strip() if match.group(3) else None
        props_str = match.group(4)
        
        props = {}
        for prop_match in re.finditer(r'(\w+):\s*([^,}]+)', props_str):
            key = prop_match.group(1).strip()
            value = prop_match.group(2).strip().strip('"')
            try:
                if '.' in value:
                    props[key] = float(value)
                else:
                    props[key] = int(value)
            except ValueError:
                props[key] = value
        
        # 补充属性
        props['data_source'] = '花园口决堤_Neo4j导入脚本_最终版.cypher'
        props['import_time'] = datetime.now().isoformat()
        
        node = {
            'id': var_name,
            'labels': [label1] + ([label2] if label2 else []),
            'properties': props
        }
        nodes.append(node)
    
    # 提取关系
    rel_pattern = r'MATCH\s+\((\w+):[^:]+(?::[^:]+)?\s*\{([^}]+)\}\),\s*\((\w+):[^:]+(?::[^:]+)?\s*\{([^}]+)\}\)\s+CREATE\s+\(\1\)-\[:([^\]]+)\]->\(\3\)'
    
    for match in re.finditer(rel_pattern, content):
        source_var = match.group(1)
        source_props = match.group(2)
        target_var = match.group(3)
        target_props = match.group(4)
        rel_type = match.group(5).strip()
        
        source_match = {}
        if 'name:' in source_props:
            name_match = re.search(r'name:\s*"([^"]+)"', source_props)
            if name_match:
                source_match['name'] = name_match.group(1)
        
        target_match = {}
        if 'name:' in target_props:
            name_match = re.search(r'name:\s*"([^"]+)"', target_props)
            if name_match:
                target_match['name'] = name_match.group(1)
        
        rel = {
            'source': source_match,
            'target': target_match,
            'type': rel_type,
            'source_var': source_var,
            'target_var': target_var,
            'data_source': '花园口决堤_Neo4j导入脚本_最终版.cypher',
            'import_time': datetime.now().isoformat()
        }
        relationships.append(rel)
    
    return nodes, relationships

def process_feishui_json(json_data):
    """处理淝水之战JSON数据"""
    nodes = []
    relationships = []
    node_map = {}
    
    # 提取节点和关系
    for item in json_data:
        if 'p' in item:
            # 关系数据
            path = item['p']
            start_node = path['start']
            end_node = path['end']
            
            # 处理开始节点
            if start_node['identity'] not in node_map:
                props = start_node.get('properties', {})
                props['data_source'] = '淝水.json'
                props['import_time'] = datetime.now().isoformat()
                node_map[start_node['identity']] = {
                    'id': f"feishui_{start_node['identity']}",
                    'labels': start_node.get('labels', []),
                    'properties': props
                }
                nodes.append(node_map[start_node['identity']])
            
            # 处理结束节点
            if end_node['identity'] not in node_map:
                props = end_node.get('properties', {})
                props['data_source'] = '淝水.json'
                props['import_time'] = datetime.now().isoformat()
                node_map[end_node['identity']] = {
                    'id': f"feishui_{end_node['identity']}",
                    'labels': end_node.get('labels', []),
                    'properties': props
                }
                nodes.append(node_map[end_node['identity']])
            
            # 处理关系
            if 'segments' in path and len(path['segments']) > 0:
                rel_data = path['segments'][0]['relationship']
                relationships.append({
                    'source': f"feishui_{start_node['identity']}",
                    'target': f"feishui_{end_node['identity']}",
                    'type': rel_data.get('type', ''),
                    'properties': rel_data.get('properties', {}),
                    'data_source': '淝水.json',
                    'import_time': datetime.now().isoformat()
                })
    
    return nodes, relationships

def process_shuangduiji_json(json_data):
    """处理双堆集JSON数据"""
    nodes = []
    relationships = []
    node_map = {}
    
    for item in json_data:
        # 提取节点
        if 'n' in item:
            node = item['n']
            node_id = node['identity']
            if node_id not in node_map:
                props = node.get('properties', {})
                props['data_source'] = '双堆集.json'
                props['import_time'] = datetime.now().isoformat()
                node_map[node_id] = {
                    'id': f"shuangduiji_{node_id}",
                    'labels': node.get('labels', []),
                    'properties': props
                }
                nodes.append(node_map[node_id])
        
        if 'm' in item:
            node = item['m']
            node_id = node['identity']
            if node_id not in node_map:
                props = node.get('properties', {})
                props['data_source'] = '双堆集.json'
                props['import_time'] = datetime.now().isoformat()
                node_map[node_id] = {
                    'id': f"shuangduiji_{node_id}",
                    'labels': node.get('labels', []),
                    'properties': props
                }
                nodes.append(node_map[node_id])
        
        # 提取关系
        if 'r' in item:
            rel = item['r']
            relationships.append({
                'source': f"shuangduiji_{rel['start']}",
                'target': f"shuangduiji_{rel['end']}",
                'type': rel.get('type', ''),
                'properties': rel.get('properties', {}),
                'data_source': '双堆集.json',
                'import_time': datetime.now().isoformat()
            })
    
    return nodes, relationships

def process_csv_events(file_path):
    """处理事件CSV文件，转换为节点格式"""
    nodes = []
    
    with open(file_path, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            props = dict(row)
            props['data_source'] = 'events.csv'
            props['import_time'] = datetime.now().isoformat()
            
            # 转换坐标
            if props.get('lng'):
                try:
                    props['lng'] = float(props['lng'])
                except:
                    props['lng'] = None
            if props.get('lat'):
                try:
                    props['lat'] = float(props['lat'])
                except:
                    props['lat'] = None
            
            node = {
                'id': props.get('事件ID', f"event_{len(nodes)}"),
                'labels': ['事件'],
                'properties': props
            }
            nodes.append(node)
    
    return nodes

def process_csv_persons(file_path):
    """处理人物CSV文件，转换为节点格式"""
    nodes = []
    
    with open(file_path, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            props = dict(row)
            props['data_source'] = 'persons.csv'
            props['import_time'] = datetime.now().isoformat()
            
            # 转换坐标
            if props.get('lng'):
                try:
                    props['lng'] = float(props['lng'])
                except:
                    props['lng'] = None
            if props.get('lat'):
                try:
                    props['lat'] = float(props['lat'])
                except:
                    props['lat'] = None
            
            # 转换权重
            if props.get('权重'):
                try:
                    props['权重'] = int(props['权重'])
                except:
                    props['权重'] = None
            
            node = {
                'id': props.get('人物序号', f"person_{len(nodes)}"),
                'labels': ['人物'],
                'properties': props
            }
            nodes.append(node)
    
    return nodes

def process_csv_locations(file_path):
    """处理地点CSV文件，转换为节点格式"""
    nodes = []
    
    with open(file_path, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            props = dict(row)
            props['data_source'] = 'geo_coords.csv'
            props['import_time'] = datetime.now().isoformat()
            
            # 转换坐标
            if props.get('lng'):
                try:
                    props['lng'] = float(props['lng'])
                except:
                    props['lng'] = None
            if props.get('lat'):
                try:
                    props['lat'] = float(props['lat'])
                except:
                    props['lat'] = None
            
            node = {
                'id': props.get('LocationID', f"location_{len(nodes)}"),
                'labels': ['地点'],
                'properties': props
            }
            nodes.append(node)
    
    return nodes

def process_csv_relationships(file_path, rel_type):
    """处理CSV关系文件，转换为标准格式"""
    relationships = []
    
    with open(file_path, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            rel = {
                'source_file': os.path.basename(file_path),
                'data_source': DATA_SOURCES.get(os.path.basename(file_path), '未知来源'),
                'import_time': datetime.now().isoformat(),
                'raw_data': row
            }
            relationships.append(rel)
    
    return relationships

def main():
    """主函数"""
    base_dir = os.path.dirname(os.path.abspath(__file__))
    data_dir = os.path.join(os.path.dirname(base_dir), 'neo4j导入数据')
    
    all_datasets = {
        'datasets': [],
        'combined': {
            'nodes': [],
            'relationships': [],
            'events': [],
            'persons': [],
            'locations': [],
            'times': []
        },
        'metadata': {
            'generated_at': datetime.now().isoformat(),
            'data_sources': DATA_SOURCES,
            'version': '1.0.0'
        }
    }
    
    # 1. 处理花园口决堤数据
    print("处理花园口决堤数据...")
    huayuan_file = os.path.join(os.path.dirname(base_dir), '花园口决堤_Neo4j导入脚本_最终版.cypher')
    if os.path.exists(huayuan_file):
        nodes, relationships = parse_cypher_file(huayuan_file)
        dataset = {
            'dataset': '花园口决堤',
            'summary': {
                'total_nodes': len(nodes),
                'total_relationships': len(relationships),
                'events': len([n for n in nodes if '事件' in n['labels']]),
                'persons': len([n for n in nodes if '人物' in n['labels']]),
                'locations': len([n for n in nodes if '地点' in n['labels']]),
                'times': len([n for n in nodes if '时间' in n['labels']])
            },
            'nodes': nodes,
            'relationships': relationships,
            'data_source': '花园口决堤_Neo4j导入脚本_最终版.cypher'
        }
        all_datasets['datasets'].append(dataset)
        all_datasets['combined']['nodes'].extend(nodes)
        all_datasets['combined']['relationships'].extend(relationships)
    
    # 2. 处理淝水之战数据
    print("处理淝水之战数据...")
    feishui_file = os.path.join(data_dir, '淝水.json')
    if os.path.exists(feishui_file):
        with open(feishui_file, 'r', encoding='utf-8-sig') as f:
            feishui_data = json.load(f)
        nodes, relationships = process_feishui_json(feishui_data)
        dataset = {
            'dataset': '淝水之战',
            'summary': {
                'total_nodes': len(nodes),
                'total_relationships': len(relationships),
                'events': len([n for n in nodes if '事件' in n['labels']]),
                'persons': len([n for n in nodes if '人物' in n['labels']]),
                'locations': len([n for n in nodes if '地点' in n['labels']]),
                'times': len([n for n in nodes if '时间' in n['labels']])
            },
            'nodes': nodes,
            'relationships': relationships,
            'data_source': '淝水.json'
        }
        all_datasets['datasets'].append(dataset)
        all_datasets['combined']['nodes'].extend(nodes)
        all_datasets['combined']['relationships'].extend(relationships)
    
    # 3. 处理双堆集数据
    print("处理双堆集数据...")
    shuangduiji_file = os.path.join(data_dir, '双堆集.json')
    if os.path.exists(shuangduiji_file):
        with open(shuangduiji_file, 'r', encoding='utf-8-sig') as f:
            shuangduiji_data = json.load(f)
        nodes, relationships = process_shuangduiji_json(shuangduiji_data)
        dataset = {
            'dataset': '双堆集战争',
            'summary': {
                'total_nodes': len(nodes),
                'total_relationships': len(relationships),
                'events': len([n for n in nodes if '事件' in n['labels']]),
                'persons': len([n for n in nodes if '人物' in n['labels']]),
                'locations': len([n for n in nodes if '地点' in n['labels']]),
                'times': len([n for n in nodes if '时间' in n['labels']])
            },
            'nodes': nodes,
            'relationships': relationships,
            'data_source': '双堆集.json'
        }
        all_datasets['datasets'].append(dataset)
        all_datasets['combined']['nodes'].extend(nodes)
        all_datasets['combined']['relationships'].extend(relationships)
    
    # 4. 处理CSV节点文件（事件、人物、地点）
    print("处理CSV节点文件...")
    
    # 处理事件数据
    events_file = os.path.join(data_dir, 'events.csv')
    if os.path.exists(events_file):
        print("  处理 events.csv...")
        csv_events = process_csv_events(events_file)
        all_datasets['combined']['nodes'].extend(csv_events)
        all_datasets['combined']['events'].extend(csv_events)
    
    # 处理人物数据
    persons_file = os.path.join(data_dir, 'persons.csv')
    if os.path.exists(persons_file):
        print("  处理 persons.csv...")
        csv_persons = process_csv_persons(persons_file)
        all_datasets['combined']['nodes'].extend(csv_persons)
        all_datasets['combined']['persons'].extend(csv_persons)
    
    # 处理地点数据
    geo_coords_file = os.path.join(data_dir, 'geo_coords.csv')
    if os.path.exists(geo_coords_file):
        print("  处理 geo_coords.csv...")
        csv_locations = process_csv_locations(geo_coords_file)
        all_datasets['combined']['nodes'].extend(csv_locations)
        all_datasets['combined']['locations'].extend(csv_locations)
    
    # 5. 处理CSV关系文件
    print("处理CSV关系文件...")
    csv_files = {
        'rel_E&E.csv': '事件-事件关系',
        'rel_E&L.csv': '事件-地点关系',
        'rel_E&P.csv': '事件-人物关系',
        'rel_P&L.csv': '人物-地点关系',
        'rel_P&P.csv': '人物-人物关系'
    }
    
    csv_relationships = {}
    for filename, desc in csv_files.items():
        file_path = os.path.join(data_dir, filename)
        if os.path.exists(file_path):
            print(f"  处理 {filename}...")
            csv_relationships[filename] = process_csv_relationships(file_path, desc)
    
    # 添加CSV关系到组合数据
    all_datasets['csv_relationships'] = csv_relationships
    
    # 分类组合数据
    all_datasets['combined']['events'] = [n for n in all_datasets['combined']['nodes'] if any('事件' in label for label in n['labels'])]
    all_datasets['combined']['persons'] = [n for n in all_datasets['combined']['nodes'] if any('人物' in label for label in n['labels'])]
    all_datasets['combined']['locations'] = [n for n in all_datasets['combined']['nodes'] if any('地点' in label for label in n['labels'])]
    all_datasets['combined']['times'] = [n for n in all_datasets['combined']['nodes'] if any('时间' in label for label in n['labels'])]
    
    # 计算组合统计
    all_datasets['combined']['summary'] = {
        'total_nodes': len(all_datasets['combined']['nodes']),
        'total_relationships': len(all_datasets['combined']['relationships']),
        'events': len(all_datasets['combined']['events']),
        'persons': len(all_datasets['combined']['persons']),
        'locations': len(all_datasets['combined']['locations']),
        'times': len(all_datasets['combined']['times'])
    }
    
    # 保存数据
    output_file = os.path.join(base_dir, 'data.json')
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(all_datasets, f, ensure_ascii=False, indent=2)
    
    print(f"\n数据整理完成！")
    print(f"共处理 {len(all_datasets['datasets'])} 个数据集")
    print(f"总计节点: {all_datasets['combined']['summary']['total_nodes']}")
    print(f"总计关系: {all_datasets['combined']['summary']['total_relationships']}")
    print(f"  - 事件: {all_datasets['combined']['summary']['events']}")
    print(f"  - 人物: {all_datasets['combined']['summary']['persons']}")
    print(f"  - 地点: {all_datasets['combined']['summary']['locations']}")
    print(f"  - 时间: {all_datasets['combined']['summary']['times']}")
    print(f"数据已保存到: {output_file}")
    
    # 保存各数据集单独文件
    for dataset in all_datasets['datasets']:
        dataset_file = os.path.join(base_dir, f"data_{dataset['dataset']}.json")
        with open(dataset_file, 'w', encoding='utf-8') as f:
            json.dump(dataset, f, ensure_ascii=False, indent=2)
        print(f"  - {dataset['dataset']}: {dataset_file}")

if __name__ == '__main__':
    main()
