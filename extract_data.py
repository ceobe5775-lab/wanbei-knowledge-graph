#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
从 Neo4j Cypher 脚本中提取数据并生成 JSON
支持：花园口决堤、淝水之战、双堆集战争、全部数据
"""

import re
import json
import os
from collections import defaultdict

def parse_cypher_file(file_path):
    """解析 Cypher 文件，提取节点和关系"""
    nodes = []
    relationships = []
    
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 提取节点：CREATE (n1:人物:花园口 {name: "蒋介石", lat: 32.06004, lng: 118.79688})
    node_pattern = r'CREATE\s+\((\w+):([^:]+)(?::([^:]+))?\s*\{([^}]+)\}\)'
    
    for match in re.finditer(node_pattern, content):
        var_name = match.group(1)
        label1 = match.group(2).strip()
        label2 = match.group(3).strip() if match.group(3) else None
        props_str = match.group(4)
        
        # 解析属性
        props = {}
        for prop_match in re.finditer(r'(\w+):\s*([^,}]+)', props_str):
            key = prop_match.group(1).strip()
            value = prop_match.group(2).strip().strip('"')
            # 尝试转换为数字
            try:
                if '.' in value:
                    props[key] = float(value)
                else:
                    props[key] = int(value)
            except ValueError:
                props[key] = value
        
        node = {
            'id': var_name,
            'labels': [label1] + ([label2] if label2 else []),
            'properties': props
        }
        nodes.append(node)
    
    # 提取关系：MATCH (a:人物:花园口 {name: "蒋介石"}), (b:人物:花园口 {name: "陈果夫"}) CREATE (a)-[:建议]->(b);
    rel_pattern = r'MATCH\s+\((\w+):[^:]+(?::[^:]+)?\s*\{([^}]+)\}\),\s*\((\w+):[^:]+(?::[^:]+)?\s*\{([^}]+)\}\)\s+CREATE\s+\(\1\)-\[:([^\]]+)\]->\(\3\)'
    
    for match in re.finditer(rel_pattern, content):
        source_var = match.group(1)
        source_props = match.group(2)
        target_var = match.group(3)
        target_props = match.group(4)
        rel_type = match.group(5).strip()
        
        # 解析源节点属性（用于匹配）
        source_match = {}
        if 'name:' in source_props:
            name_match = re.search(r'name:\s*"([^"]+)"', source_props)
            if name_match:
                source_match['name'] = name_match.group(1)
        
        # 解析目标节点属性（用于匹配）
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
            'target_var': target_var
        }
        relationships.append(rel)
    
    return nodes, relationships

def build_node_map(nodes):
    """构建节点映射表，通过name查找节点"""
    node_map = {}
    for node in nodes:
        if 'name' in node['properties']:
            name = node['properties']['name']
            if name not in node_map:
                node_map[name] = []
            node_map[name].append(node)
    return node_map

def resolve_relationships(nodes, relationships):
    """解析关系，将变量名替换为实际的节点ID"""
    node_map = build_node_map(nodes)
    resolved_rels = []
    
    for rel in relationships:
        source_name = rel['source'].get('name')
        target_name = rel['target'].get('name')
        
        if source_name and target_name:
            source_nodes = node_map.get(source_name, [])
            target_nodes = node_map.get(target_name, [])
            
            # 如果找到匹配的节点，创建关系
            if source_nodes and target_nodes:
                for source_node in source_nodes:
                    for target_node in target_nodes:
                        resolved_rels.append({
                            'source': source_node['id'],
                            'target': target_node['id'],
                            'type': rel['type'],
                            'source_name': source_name,
                            'target_name': target_name
                        })
    
    return resolved_rels

def extract_data_from_file(file_path, dataset_name):
    """从文件中提取数据"""
    print(f"正在处理: {file_path}")
    
    if not os.path.exists(file_path):
        print(f"文件不存在: {file_path}")
        return None
    
    nodes, relationships = parse_cypher_file(file_path)
    resolved_rels = resolve_relationships(nodes, relationships)
    
    # 分类节点
    events = [n for n in nodes if '事件' in n['labels']]
    persons = [n for n in nodes if '人物' in n['labels']]
    locations = [n for n in nodes if '地点' in n['labels']]
    times = [n for n in nodes if '时间' in n['labels']]
    
    data = {
        'dataset': dataset_name,
        'summary': {
            'total_nodes': len(nodes),
            'total_relationships': len(resolved_rels),
            'events': len(events),
            'persons': len(persons),
            'locations': len(locations),
            'times': len(times)
        },
        'nodes': nodes,
        'relationships': resolved_rels,
        'events': events,
        'persons': persons,
        'locations': locations,
        'times': times
    }
    
    return data

def main():
    """主函数"""
    base_dir = os.path.dirname(os.path.abspath(__file__))
    parent_dir = os.path.dirname(base_dir)
    
    # 查找文件
    datasets = []
    
    # 花园口决堤
    huayuan_file = os.path.join(parent_dir, '花园口决堤_Neo4j导入脚本_最终版.cypher')
    if os.path.exists(huayuan_file):
        datasets.append({'name': '花园口决堤', 'file': huayuan_file})
    
    # 查找淝水之战文件
    feishui_files = [
        '淝水之战_节点导入_历史校验.cypher',
        '淝水之战_节点导入.cypher'
    ]
    for filename in feishui_files:
        filepath = os.path.join(parent_dir, filename)
        if os.path.exists(filepath):
            datasets.append({'name': '淝水之战', 'file': filepath})
            break
    
    # 查找双堆集/淮海战役文件
    huaihai_files = [
        '淮海战役_双堆集战争_节点导入.cypher',
        '淮海战役_双堆集战争_节点导入_UTF8.cypher',
        '双堆集战争_节点导入.cypher'
    ]
    for filename in huaihai_files:
        filepath = os.path.join(parent_dir, filename)
        if os.path.exists(filepath):
            datasets.append({'name': '双堆集战争', 'file': filepath})
            break
    
    all_data = {
        'datasets': [],
        'combined': {
            'nodes': [],
            'relationships': [],
            'events': [],
            'persons': [],
            'locations': [],
            'times': []
        }
    }
    
    # 处理每个数据集
    for dataset in datasets:
        data = extract_data_from_file(dataset['file'], dataset['name'])
        if data:
            all_data['datasets'].append(data)
            
            # 合并到总数据
            all_data['combined']['nodes'].extend(data['nodes'])
            all_data['combined']['relationships'].extend(data['relationships'])
            all_data['combined']['events'].extend(data['events'])
            all_data['combined']['persons'].extend(data['persons'])
            all_data['combined']['locations'].extend(data['locations'])
            all_data['combined']['times'].extend(data['times'])
    
    # 计算合并后的统计
    all_data['combined']['summary'] = {
        'total_nodes': len(all_data['combined']['nodes']),
        'total_relationships': len(all_data['combined']['relationships']),
        'events': len(all_data['combined']['events']),
        'persons': len(all_data['combined']['persons']),
        'locations': len(all_data['combined']['locations']),
        'times': len(all_data['combined']['times'])
    }
    
    # 保存为JSON文件
    output_file = os.path.join(base_dir, 'data.json')
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(all_data, f, ensure_ascii=False, indent=2)
    
    print(f"\n数据提取完成！")
    print(f"共处理 {len(all_data['datasets'])} 个数据集")
    print(f"总计节点: {all_data['combined']['summary']['total_nodes']}")
    print(f"总计关系: {all_data['combined']['summary']['total_relationships']}")
    print(f"数据已保存到: {output_file}")
    
    # 保存各个数据集的单独文件
    for dataset in all_data['datasets']:
        dataset_file = os.path.join(base_dir, f"data_{dataset['dataset']}.json")
        with open(dataset_file, 'w', encoding='utf-8') as f:
            json.dump(dataset, f, ensure_ascii=False, indent=2)
        print(f"  - {dataset['dataset']}: {dataset_file}")

if __name__ == '__main__':
    main()
