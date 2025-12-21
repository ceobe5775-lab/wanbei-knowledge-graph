# GeoJSON 文件预览方法

本项目提供了多种方式来预览 GeoJSON 文件，包括边界线数据。

## 方法一：使用 HTML 预览页面（推荐）

### 使用步骤

1. **启动本地服务器**
   - 在项目目录下运行：`启动5500端口服务器.bat`
   - 或者使用 Python: `python -m http.server 5500`

2. **打开预览页面**
   - 在浏览器中访问: `http://localhost:5500/geojson-preview.html`
   - 或者直接双击 `geojson-preview.html` 文件（某些浏览器可能有限制）

3. **选择文件**
   - 在页面顶部的下拉菜单中选择要预览的 GeoJSON 文件
   - 支持的文件：
     - `six_cities_boundaries.geojson` - 六个城市边界
     - `wanbei-boundaries.geojson` - 皖北边界

### 功能特点

- ✅ 交互式地图，支持缩放和拖拽
- ✅ 鼠标悬停高亮显示
- ✅ 点击查看城市详细信息
- ✅ 自动调整视图以适应所有边界
- ✅ 显示文件统计信息
- ✅ 不同城市使用不同颜色区分

## 方法二：使用 Python + Folium

### 安装依赖

```bash
pip install folium
```

### 使用方法

```bash
# 预览默认文件（six_cities_boundaries.geojson）
python preview_geojson.py

# 预览指定文件
python preview_geojson.py six_cities_boundaries.geojson

# 指定输出文件名
python preview_geojson.py six_cities_boundaries.geojson output.html
```

### 功能特点

- ✅ 生成独立的 HTML 文件
- ✅ 包含图例和全屏功能
- ✅ 可以分享给其他人查看
- ✅ 支持自定义样式

## 方法三：在线工具

### 推荐网站

1. **geojson.io** (https://geojson.io/)
   - 最流行的 GeoJSON 在线编辑器
   - 支持编辑和预览
   - 可以直接粘贴 GeoJSON 内容或上传文件

2. **Mapshaper** (https://mapshaper.org/)
   - 强大的地理数据处理工具
   - 支持多种格式转换
   - 可以简化边界线

3. **GitHub Gist**
   - 将 GeoJSON 文件上传到 GitHub Gist
   - GitHub 会自动渲染地图预览

## 方法四：使用 GIS 软件

### QGIS（免费开源）

1. 下载安装 QGIS: https://qgis.org/
2. 打开 QGIS
3. 菜单: `Layer` → `Add Layer` → `Add Vector Layer`
4. 选择 GeoJSON 文件
5. 可以查看、编辑和分析数据

### ArcGIS Online（在线）

1. 访问 https://www.arcgis.com/
2. 上传 GeoJSON 文件
3. 在线查看和分享

## 文件说明

### six_cities_boundaries.geojson

包含以下六个城市的边界线：
- 蚌埠市
- 亳州市
- 阜阳市
- 淮北市
- 淮南市
- 宿州市

### wanbei-boundaries.geojson

皖北地区的边界数据

## 常见问题

### Q: HTML 预览页面无法加载文件？

A: 由于浏览器的安全限制，直接打开 HTML 文件可能无法加载本地文件。请使用本地服务器：
```bash
python -m http.server 5500
```
然后访问 `http://localhost:5500/geojson-preview.html`

### Q: 地图显示不完整？

A: 检查 GeoJSON 文件的坐标系统。本项目的坐标使用 WGS84 (EPSG:4326) 标准。

### Q: 如何修改城市颜色？

A: 在 `geojson-preview.html` 中修改 `cityColors` 对象，或在 `preview_geojson.py` 中修改 `city_colors` 字典。

## 技术栈

- **Leaflet**: 轻量级地图库
- **Folium**: Python 地图可视化库
- **OpenStreetMap**: 免费地图底图


