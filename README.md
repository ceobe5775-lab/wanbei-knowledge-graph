# 皖北军事环境成因知识图谱平台

这是一个展示皖北地区（亳州、淮北、阜阳、淮南、宿州、蚌埠）历史事件的知识图谱可视化平台。

## 功能特性

- 📊 **知识图谱可视化**：展示事件、人物、地点之间的关系
- 🗺️ **交互式地图**：显示事件的地理分布
- 📈 **数据统计**：事件、人物、地点的统计信息
- 🔍 **多维度筛选**：按事件类型、地区、时间等筛选

## 页面说明

- `index.html` - 首页/概览
- `map-canvas.html` - 交互式地图（Canvas 版本）
- `knowledgeGraph.html` - 知识图谱可视化
- `events.html` - 事件列表
- `persons.html` - 人物列表
- `overview.html` - 数据概览

## 技术栈

- 纯 HTML/CSS/JavaScript
- Canvas API（地图绘制）
- GeoJSON（地理数据）
- 响应式设计

## 数据来源

- 地理边界数据：基于阿里云 GeoJSON API
- 历史事件数据：自定义 JSON 格式

## 部署

本项目已配置为 GitHub Pages，可以直接部署到 GitHub Pages。

详细部署说明请参考 [GITHUB_PAGES_DEPLOY.md](./GITHUB_PAGES_DEPLOY.md)

## 本地开发

1. 使用本地服务器运行（推荐使用 VS Code 的 Live Server 扩展）
2. 或使用 Python 简单服务器：
   ```bash
   python -m http.server 5500
   ```
3. 访问 `http://localhost:5500`

## 许可证

MIT License
