# 知识图谱模块化代码说明

知识图谱相关代码已拆分为多个模块，便于维护和管理。

## 模块结构

### 1. `kg-config.js` - 配置和样式
包含所有配置项：
- 节点样式（颜色、大小、字体等）
- 边样式（颜色、宽度、箭头等）
- 布局配置（vis.js 和 Cytoscape.js）
- 事件集判断配置
- 标签格式化配置

### 2. `kg-utils.js` - 工具函数
提供通用工具函数：
- `formatLabel(text, maxWidth)` - 格式化标签文本，自动换行
- `isEventSet(nodeId, edges, nodeMap)` - 判断节点是否是事件集

### 3. `kg-cache.js` - 缓存管理
管理知识图谱的数据缓存：
- `init()` - 初始化缓存
- `build(sourceNodes, rels)` - 从数据源构建缓存
- `getAllNodes()` - 获取所有节点
- `getAllEdges()` - 获取所有边
- `getNodeMap()` - 获取节点映射
- `getNode(nodeId)` - 根据ID获取节点

### 4. `kg-views.js` - 视图管理
管理知识图谱的不同视图：
- `init()` - 初始化视图栈
- `showInitialView()` - 显示初始视图（事件集和事件）
- `showEventSetView(eventSetId)` - 显示事件集视图
- `showEventView(eventId)` - 显示事件视图
- `showPersonLocationView(nodeId)` - 显示人物/地点视图
- `getCurrentView()` - 获取当前视图
- `updateFocusHint()` - 更新视图提示

### 5. `kg-renderer.js` - 渲染器统一入口
统一管理渲染器：
- `render(nodes, edges)` - 渲染知识图谱（自动选择最佳渲染器）
- `destroy()` - 清理渲染器实例

### 6. `kg-renderer-vis.js` - vis.js 渲染器（待实现）
使用 vis.js 渲染知识图谱，完全匹配 Neo4j Browser 的视觉效果。

### 7. `kg-renderer-cytoscape.js` - Cytoscape.js 渲染器（待实现）
使用 Cytoscape.js 作为后备渲染器。

## 使用方式

在 HTML 文件中按顺序引入模块：

```html
<!-- 配置和工具 -->
<script src="js/kg-config.js"></script>
<script src="js/kg-utils.js"></script>

<!-- 核心模块 -->
<script src="js/kg-cache.js"></script>
<script src="js/kg-views.js"></script>
<script src="js/kg-renderer.js"></script>

<!-- 渲染器（可选） -->
<script src="js/kg-renderer-vis.js"></script>
<script src="js/kg-renderer-cytoscape.js"></script>
```

## 模块依赖关系

```
kg-config.js (无依赖)
    ↓
kg-utils.js (依赖: kg-config.js)
    ↓
kg-cache.js (无依赖)
    ↓
kg-views.js (依赖: kg-config.js, kg-utils.js, kg-cache.js, kg-renderer.js)
    ↓
kg-renderer.js (依赖: kg-renderer-vis.js 或 kg-renderer-cytoscape.js)
```

## 优势

1. **代码组织清晰** - 每个模块职责单一，易于理解
2. **便于维护** - 修改某个功能只需编辑对应模块
3. **可复用** - 模块可以在其他项目中复用
4. **易于测试** - 每个模块可以独立测试
5. **性能优化** - 可以按需加载模块

## 注意事项

- 模块必须按依赖顺序加载
- 所有模块都支持浏览器全局变量和 CommonJS 模块系统
- 渲染器模块（vis.js 和 Cytoscape.js）需要对应的库已加载









































































