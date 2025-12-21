#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""检查数据文件"""

import json

with open('data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

print(f"数据集数量: {len(data['datasets'])}")
print(f"总节点: {data['combined']['summary']['total_nodes']}")
print(f"总关系: {data['combined']['summary']['total_relationships']}")
print(f"事件: {data['combined']['summary']['events']}")
print(f"人物: {data['combined']['summary']['persons']}")
print(f"地点: {data['combined']['summary']['locations']}")
print(f"时间: {data['combined']['summary']['times']}")

print("\n各数据集详情:")
for ds in data['datasets']:
    print(f"  {ds['dataset']}: {ds['summary']['total_nodes']}节点, {ds['summary']['total_relationships']}关系")

if 'csv_relationships' in data:
    print(f"\nCSV关系文件: {len(data['csv_relationships'])}个")
    for filename in data['csv_relationships']:
        print(f"  {filename}: {len(data['csv_relationships'][filename])}条关系")












