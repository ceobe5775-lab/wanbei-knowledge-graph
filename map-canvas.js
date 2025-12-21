// Canvas地图显示脚本 - 参考feiyi.inhct.cn/map.html实现

let canvas = null;
let ctx = null;
let allEvents = [];
let filteredEvents = [];
let boundaries = [];
let regionStats = {}; // 区域统计：{区域名: {count: 数量, events: [事件列表]}}
let currentView = {
    centerX: 116.5,
    centerY: 33.0,
    zoom: 1.0
};
let isDragging = false;
let lastMouseX = 0;
let lastMouseY = 0;
let hoveredRegion = null;
let currentCity = null; // 当前选中的城市
let cityTilesView = null; // 六市图块视图容器
let mapDetailView = null; // 地图详细视图容器
let cityOutlines = {}; // 存储每个市的外边界轮廓 {cityKey: {bounds: {...}, outline: Feature}}

// 皖北六市配置
const WANBEI_CITIES = [
    { key: '阜阳', name: '阜阳市', fullName: '阜阳市' },
    { key: '亳州', name: '亳州市', fullName: '亳州市' },
    { key: '淮北', name: '淮北市', fullName: '淮北市' },
    { key: '宿州', name: '宿州市', fullName: '宿州市' },
    { key: '蚌埠', name: '蚌埠市', fullName: '蚌埠市' },
    { key: '淮南', name: '淮南市', fullName: '淮南市' }
];

// 颜色配置（根据事件数量范围）
const COLOR_RANGES = [
    { min: 150, color: '#FFD700', label: '150件以上' },      // 黄色
    { min: 120, max: 150, color: '#FFA500', label: '120-150件' }, // 橙色
    { min: 90, max: 120, color: '#FF6347', label: '90-120件' },   // 红橙色
    { min: 60, max: 90, color: '#FF69B4', label: '60-90件' },     // 粉红色
    { min: 30, max: 60, color: '#9370DB', label: '30-60件' },     // 紫色
    { min: 0, max: 30, color: '#87CEEB', label: '30件以下' }      // 天蓝色
];

// 初始化Canvas
function initCanvas() {
    canvas = document.getElementById('eventMapCanvas');
    ctx = canvas.getContext('2d');
    
    // 设置Canvas尺寸
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // 绑定事件
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('wheel', onWheel);
    canvas.addEventListener('click', onCanvasClick);
}

// 调整Canvas尺寸
function resizeCanvas() {
    const container = canvas.parentElement;
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    drawMap();
}

// 坐标转换：地理坐标 -> Canvas坐标
function geoToCanvas(lng, lat) {
    // 使用更合适的缩放因子，确保坐标正确映射
    // 参考 Leaflet 的坐标系统：1度经度约等于111km（在纬度33度附近）
    const scale = currentView.zoom * Math.min(canvas.width, canvas.height) / 2;
    const x = (lng - currentView.centerX) * scale + canvas.width / 2;
    const y = (currentView.centerY - lat) * scale + canvas.height / 2;
    return { x, y };
}

// 坐标转换：Canvas坐标 -> 地理坐标
function canvasToGeo(x, y) {
    const scale = currentView.zoom * Math.min(canvas.width, canvas.height) / 2;
    const lng = (x - canvas.width / 2) / scale + currentView.centerX;
    const lat = currentView.centerY - (y - canvas.height / 2) / scale;
    return { lng, lat };
}

// 根据事件数量获取颜色
function getColorByCount(count) {
    for (const range of COLOR_RANGES) {
        if (range.max === undefined) {
            if (count >= range.min) return range.color;
        } else {
            if (count >= range.min && count < range.max) return range.color;
        }
    }
    return COLOR_RANGES[COLOR_RANGES.length - 1].color; // 默认颜色
}

// 统计各区域的事件数量
function calculateRegionStats() {
    regionStats = {};
    
    if (!currentCity) {
        // 初始视图：按市统计
        WANBEI_CITIES.forEach(city => {
            regionStats[city.key] = {
                count: 0,
                events: [],
                name: city.name,
                fullName: city.fullName
            };
        });
        
        // 统计事件到各个市
        filteredEvents.forEach(event => {
            const region = event.properties?.地区 || event.properties?.region || '';
            const eventLng = event.properties?.lng || event.properties?.经度;
            const eventLat = event.properties?.lat || event.properties?.纬度;
            
            // 匹配城市
            WANBEI_CITIES.forEach(city => {
                let matched = false;
                
                // 如果事件有坐标，检查是否在该城市边界内
                if (eventLng && eventLat && cityOutlines[city.key]) {
                    const cityOutline = cityOutlines[city.key];
                    if (cityOutline && cityOutline.outline) {
                        matched = isPointInPolygon(eventLng, eventLat, cityOutline.outline.geometry);
                    }
                }
                
                // 如果没有坐标或坐标匹配失败，按地区名称匹配
                if (!matched) {
                    matched = region.includes(city.key) || region.includes(city.fullName);
                }
                
                if (matched) {
                    regionStats[city.key].count++;
                    regionStats[city.key].events.push(event);
                }
            });
        });
    } else {
        // 详细视图：按县/镇统计
        const cityOutline = cityOutlines[currentCity];
        if (!cityOutline || !cityOutline.features) return;
        
        // 为每个县/镇创建统计
        cityOutline.features.forEach(feature => {
            const props = feature.properties || {};
            const regionName = props.name || props.名称 || '未知区域';
            const regionKey = regionName.replace('市', '').replace('县', '').replace('区', '');
            
            if (!regionStats[regionKey]) {
                regionStats[regionKey] = {
                    count: 0,
                    events: [],
                    name: regionName,
                    fullName: regionName
                };
            }
        });
        
        // 统计事件到各个县/镇
        filteredEvents.forEach(event => {
            const eventLng = event.properties?.lng || event.properties?.经度;
            const eventLat = event.properties?.lat || event.properties?.纬度;
            const region = event.properties?.地区 || event.properties?.region || '';
            
            // 检查事件属于哪个县/镇
            cityOutline.features.forEach(feature => {
                const props = feature.properties || {};
                const regionName = props.name || props.名称 || '未知区域';
                const regionKey = regionName.replace('市', '').replace('县', '').replace('区', '');
                
                let matched = false;
                
                // 如果事件有坐标，检查是否在该县/镇边界内
                if (eventLng && eventLat) {
                    matched = isPointInPolygon(eventLng, eventLat, feature.geometry);
                }
                
                // 如果没有坐标，按地区名称匹配
                if (!matched && region) {
                    matched = region.includes(regionName) || region.includes(regionKey);
                }
                
                if (matched) {
                    if (!regionStats[regionKey]) {
                        regionStats[regionKey] = {
                            count: 0,
                            events: [],
                            name: regionName,
                            fullName: regionName
                        };
                    }
                    regionStats[regionKey].count++;
                    regionStats[regionKey].events.push(event);
                }
            });
        });
    }
}

// 绘制地图
function drawMap() {
    if (!ctx) return;
    
    // 清空画布
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 绘制背景（渐变效果）
    const gradient = ctx.createRadialGradient(
        canvas.width / 2, canvas.height / 2, 0,
        canvas.width / 2, canvas.height / 2, Math.max(canvas.width, canvas.height)
    );
    gradient.addColorStop(0, '#f0f8ff');
    gradient.addColorStop(1, '#e6f3ff');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // 绘制区域（带颜色填充）- 只在详细视图时填充
    if (currentCity) {
        drawRegions();
    }
    
    // 绘制边界线条
    drawBoundaries();
    
    // 绘制区域标签
    drawRegionLabels();
    
    // 绘制事件节点
    drawEvents();
}

// 绘制区域（根据事件数量填充颜色）
function drawRegions() {
    if (!boundaries || boundaries.length === 0) return;
    
    boundaries.forEach(boundary => {
        const feature = boundary.feature;
        const props = feature.properties || {};
        const cityName = boundary.city || props.name || '';
        const cityKey = cityName.replace('市', '').replace('县', '');
        
        // 获取该区域的事件数量
        const stats = regionStats[cityKey] || { count: 0 };
        const color = getColorByCount(stats.count);
        
        // 绘制填充区域
        ctx.fillStyle = color;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        
        const coords = feature.geometry.coordinates;
        
        if (feature.geometry.type === 'Polygon') {
            drawFilledPolygon(coords[0], color);
        } else if (feature.geometry.type === 'MultiPolygon') {
            coords.forEach(polygon => {
                drawFilledPolygon(polygon[0], color);
            });
        }
        
        // 存储区域信息用于交互
        feature._cityKey = cityKey;
        feature._stats = stats;
    });
}

// 绘制填充的多边形
function drawFilledPolygon(coords, fillColor) {
    if (!coords || coords.length === 0) return;
    
    ctx.beginPath();
    const firstPoint = geoToCanvas(coords[0][0], coords[0][1]);
    ctx.moveTo(firstPoint.x, firstPoint.y);
    
    for (let i = 1; i < coords.length; i++) {
        const point = geoToCanvas(coords[i][0], coords[i][1]);
        ctx.lineTo(point.x, point.y);
    }
    
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.stroke();
}

// 绘制边界（市和县区分粗细）
function drawBoundaries() {
    if (!boundaries || boundaries.length === 0) {
        console.warn('没有边界数据可绘制');
        return;
    }
    
    console.log(`绘制 ${boundaries.length} 个边界区域`);
    
    boundaries.forEach(boundary => {
        const feature = boundary.feature;
        const props = feature.properties || {};
        const isOutline = boundary.isOutline; // 是否是外边界
        const isCity = props.type === 'city' || props.级别 === '市' || (isOutline && !currentCity);
        const isCounty = props.type === 'county' || props.级别 === '县' || props.级别 === '区' || props.level === 'district';
        
        // 初始视图：只绘制市边界，不绘制县/镇边界
        // 确保只绘制标记为isOutline的市边界，不绘制任何内部边界
        if (!currentCity) {
            // 初始视图：只绘制市的外边界（isOutline为true的feature）
            if (!isOutline) {
                return; // 跳过所有非市边界的features
            }
        }
        
        // 获取统计信息
        let stats;
        if (!currentCity) {
            // 初始视图：使用市的统计
            const cityKey = boundary.city;
            stats = regionStats[cityKey] || { count: 0 };
        } else {
            // 详细视图：使用县/镇的统计
            const regionName = props.name || props.名称 || '未知区域';
            const regionKey = regionName.replace('市', '').replace('县', '').replace('区', '');
            stats = regionStats[regionKey] || { count: 0 };
        }
        
        const fillColor = getColorByCount(stats.count);
        
        // 如果是外边界（初始视图），填充颜色
        if (isOutline && !currentCity) {
            // 填充区域
            const coords = feature.geometry.coordinates;
            ctx.fillStyle = fillColor + '80'; // 80 = 50%透明度
            ctx.beginPath();
            
            if (feature.geometry.type === 'Polygon') {
                drawPolygonPath(coords[0]);
            } else if (feature.geometry.type === 'MultiPolygon') {
                coords.forEach(polygon => {
                    drawPolygonPath(polygon[0]);
                });
            }
            ctx.closePath();
            ctx.fill();
        }
        
        // 详细视图：填充县/镇区域
        if (currentCity && !isOutline) {
            const coords = feature.geometry.coordinates;
            ctx.fillStyle = fillColor + '60'; // 60 = 37.5%透明度
            ctx.beginPath();
            
            if (feature.geometry.type === 'Polygon') {
                drawPolygonPath(coords[0]);
            } else if (feature.geometry.type === 'MultiPolygon') {
                coords.forEach(polygon => {
                    drawPolygonPath(polygon[0]);
                });
            }
            ctx.closePath();
            ctx.fill();
        }
        
        // 根据级别设置线条粗细和颜色（确保边界线清晰可见）
        let lineWidth = 1.0;
        let color = '#333';
        
        if (isOutline && !currentCity) {
            // 市外边界（确保清晰可见）
            lineWidth = 2.0;
            color = '#1e40af'; // 深蓝色，更明显
        } else if (currentCity && isCounty) {
            // 详细视图中的县/镇边界
            lineWidth = 1.0;
            color = '#666';
        } else if (currentCity && isCity) {
            // 详细视图中的市边界（如果有）
            lineWidth = 1.5;
            color = '#1e40af';
        }
        
        // 设置线条样式，确保边界线清晰可见
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        
        const coords = feature.geometry.coordinates;
        
        // 绘制边界线
        if (feature.geometry.type === 'Polygon') {
            drawPolygon(coords[0]);
        } else if (feature.geometry.type === 'MultiPolygon') {
            coords.forEach(polygon => {
                drawPolygon(polygon[0]);
            });
        }
        
        // 存储区域信息用于点击检测
        if (!currentCity) {
            feature._cityKey = boundary.city;
            feature._stats = stats;
        } else {
            const regionName = props.name || props.名称 || '未知区域';
            const regionKey = regionName.replace('市', '').replace('县', '').replace('区', '');
            feature._regionKey = regionKey;
            feature._stats = stats;
        }
    });
}

// 绘制多边形路径（用于填充，不自动stroke）
function drawPolygonPath(coords) {
    if (!coords || coords.length === 0) return;
    
    const firstPoint = geoToCanvas(coords[0][0], coords[0][1]);
    ctx.moveTo(firstPoint.x, firstPoint.y);
    
    for (let i = 1; i < coords.length; i++) {
        const point = geoToCanvas(coords[i][0], coords[i][1]);
        ctx.lineTo(point.x, point.y);
    }
}

// 绘制多边形边界
function drawPolygon(coords) {
    if (!coords || coords.length === 0) return;
    
    ctx.beginPath();
    const firstPoint = geoToCanvas(coords[0][0], coords[0][1]);
    ctx.moveTo(firstPoint.x, firstPoint.y);
    
    for (let i = 1; i < coords.length; i++) {
        const point = geoToCanvas(coords[i][0], coords[i][1]);
        ctx.lineTo(point.x, point.y);
    }
    
    ctx.closePath();
    ctx.stroke();
}

// 绘制多边形路径（用于填充，不自动stroke）
function drawPolygonPath(coords) {
    if (!coords || coords.length === 0) return;
    
    const firstPoint = geoToCanvas(coords[0][0], coords[0][1]);
    ctx.moveTo(firstPoint.x, firstPoint.y);
    
    for (let i = 1; i < coords.length; i++) {
        const point = geoToCanvas(coords[i][0], coords[i][1]);
        ctx.lineTo(point.x, point.y);
    }
}

// 计算多边形中心点
function getPolygonCenter(coords) {
    if (!coords || coords.length === 0) return null;
    
    let sumLng = 0;
    let sumLat = 0;
    let count = 0;
    
    coords.forEach(coord => {
        if (Array.isArray(coord[0])) {
            // MultiPolygon
            coord.forEach(polygon => {
                polygon.forEach(point => {
                    sumLng += point[0];
                    sumLat += point[1];
                    count++;
                });
            });
        } else {
            // Polygon
            coord.forEach(point => {
                sumLng += point[0];
                sumLat += point[1];
                count++;
            });
        }
    });
    
    if (count === 0) return null;
    
    return {
        lng: sumLng / count,
        lat: sumLat / count
    };
}

// 绘制区域标签（区域名称 + 事件数量）
function drawRegionLabels() {
    boundaries.forEach(boundary => {
        const feature = boundary.feature;
        const props = feature.properties || {};
        const isOutline = boundary.isOutline;
        
        // 初始视图：只显示市标签
        if (!currentCity && !isOutline) {
            return; // 跳过县/镇标签
        }
        
        let stats, labelText, fullName;
        
        if (!currentCity) {
            // 初始视图：显示市标签
            const cityKey = feature._cityKey || boundary.city;
            if (!cityKey) return;
            
            const city = WANBEI_CITIES.find(c => c.key === cityKey);
            fullName = city?.fullName || cityKey;
            stats = feature._stats || regionStats[cityKey] || { count: 0 };
            labelText = `${fullName} ${stats.count || 0}件`;
        } else {
            // 详细视图：显示县/镇标签
            const regionName = props.name || props.名称 || '未知区域';
            const regionKey = feature._regionKey || regionName.replace('市', '').replace('县', '').replace('区', '');
            stats = feature._stats || regionStats[regionKey] || { count: 0 };
            fullName = regionName;
            labelText = `${fullName} ${stats.count || 0}件`;
        }
        
        // 计算区域中心点
        const coords = feature.geometry.coordinates;
        let center = null;
        
        if (feature.geometry.type === 'Polygon') {
            center = getPolygonCenter(coords[0]);
        } else if (feature.geometry.type === 'MultiPolygon') {
            center = getPolygonCenter(coords);
        }
        
        if (!center) return;
        
        const point = geoToCanvas(center.lng, center.lat);
        
        // 绘制标签背景
        ctx.font = 'bold 14px "Microsoft YaHei", Arial, sans-serif';
        const textMetrics = ctx.measureText(labelText);
        const textWidth = textMetrics.width;
        const textHeight = 20;
        const padding = 8;
        
        // 绘制背景框
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(
            point.x - textWidth / 2 - padding,
            point.y - textHeight / 2 - padding,
            textWidth + padding * 2,
            textHeight + padding * 2,
            4
        );
        ctx.fill();
        ctx.stroke();
        
        // 绘制文字
        ctx.fillStyle = '#333';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(labelText, point.x, point.y);
        
        // 存储标签位置用于点击检测
        feature._labelX = point.x;
        feature._labelY = point.y;
        feature._labelWidth = textWidth + padding * 2;
        feature._labelHeight = textHeight + padding * 2;
    });
}

// 加载数据
async function loadData() {
    try {
        const response = await fetch('data.json');
        const data = await response.json();
        
        if (!data || !data.combined) {
            console.error('数据格式错误');
            return;
        }
        
        // 提取所有事件数据
        allEvents = data.combined.events || data.combined.nodes.filter(n => 
            n.labels && n.labels.some(l => l.includes('事件'))
        );
        
        console.log('=== 事件数据加载 ===');
        console.log('数据源:', data.combined.events ? 'events数组' : 'nodes筛选');
        console.log('加载的事件总数:', allEvents.length);
        console.log('事件示例:', allEvents.slice(0, 5));
        console.log('事件地区分布:', allEvents.map(e => e.properties?.地区 || e.properties?.region || '未知').slice(0, 10));
        
        filteredEvents = [...allEvents];
        
        // 加载边界数据（所有城市）
        await loadBoundaries();
        
        // 统计区域数据
        calculateRegionStats();
        
        // 调整视图以适应数据范围
        adjustViewToData();
        
        // 绘制地图（初始显示6个市的外边界）
        drawMap();
    } catch (error) {
        console.error('加载数据失败:', error);
    }
}

// 计算外边界（从多个features中提取最外层边界，合并为一个市边界）
function calculateCityOutline(features) {
    if (!features || features.length === 0) return null;
    
    // 收集所有外边界坐标点（只取每个feature的外环）
    let allOuterCoords = [];
    features.forEach(feature => {
        const geom = feature.geometry;
        if (geom.type === 'Polygon') {
            // 只取外环（第一个坐标数组）
            allOuterCoords.push(...geom.coordinates[0]);
        } else if (geom.type === 'MultiPolygon') {
            geom.coordinates.forEach(polygon => {
                // 只取外环
                allOuterCoords.push(...polygon[0]);
            });
        }
    });
    
    if (allOuterCoords.length === 0) return null;
    
    // 计算边界框
    let minLng = Infinity, maxLng = -Infinity;
    let minLat = Infinity, maxLat = -Infinity;
    
    allOuterCoords.forEach(coord => {
        const [lng, lat] = coord;
        minLng = Math.min(minLng, lng);
        maxLng = Math.max(maxLng, lng);
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
    });
    
    // 创建合并的外边界多边形
    // 使用简化的凸包算法：选择边界上的关键点
    // 为了更好的效果，我们使用所有外边界点中最外层的点
    // 简化方法：使用边界框，但保留所有外边界点用于更真实的形状
    // 这里我们创建一个包含所有外边界点的简化多边形
    // 实际应该用凸包算法，但为了性能使用边界框
    const outline = {
        type: 'Feature',
        properties: { name: '外边界', type: 'city', 级别: '市' },
        geometry: {
            type: 'Polygon',
            coordinates: [[
                [minLng, minLat],
                [maxLng, minLat],
                [maxLng, maxLat],
                [minLng, maxLat],
                [minLng, minLat]
            ]]
        }
    };
    
    return {
        bounds: { minLng, maxLng, minLat, maxLat },
        outline: outline,
        features: features // 保存原始features用于详细视图
    };
}

// 创建合并的市外边界（合并所有features的外边界为一个多边形）
function createMergedCityBoundary(features, cityKey) {
    if (!features || features.length === 0) return null;
    
    // 如果只有一个feature，直接返回它（但确保属性正确）
    if (features.length === 1) {
        const feature = features[0];
        feature.properties = feature.properties || {};
        feature.properties.name = cityKey + '市';
        feature.properties.type = 'city';
        feature.properties.级别 = '市';
        feature.properties.level = 'city';
        return feature;
    }
    
    // 多个features：合并所有几何形状
    // 收集所有外边界坐标点（用于计算边界框）
    let allOuterCoords = [];
    let allPolygons = [];
    
    features.forEach(feature => {
        const geom = feature.geometry;
        if (geom.type === 'Polygon') {
            allPolygons.push(geom.coordinates[0]);
            allOuterCoords.push(...geom.coordinates[0]);
        } else if (geom.type === 'MultiPolygon') {
            geom.coordinates.forEach(polygon => {
                allPolygons.push(polygon[0]);
                allOuterCoords.push(...polygon[0]);
            });
        }
    });
    
    if (allOuterCoords.length === 0) return null;
    
    // 计算边界框
    let minLng = Infinity, maxLng = -Infinity;
    let minLat = Infinity, maxLat = -Infinity;
    
    allOuterCoords.forEach(coord => {
        const [lng, lat] = coord;
        minLng = Math.min(minLng, lng);
        maxLng = Math.max(maxLng, lng);
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
    });
    
    // 为了更好的显示效果，我们使用所有polygons的并集
    // 但由于浏览器端没有复杂的几何库，我们使用一个简化的方法：
    // 创建一个包含所有外边界点的多边形（使用凸包算法简化版）
    // 这里我们使用所有polygons的外边界点，创建一个更真实的形状
    
    // 简化方法：使用所有polygons的并集，创建一个MultiPolygon
    // 但为了性能，我们创建一个包含所有关键点的简化多边形
    // 实际应该使用真正的几何合并算法，但这里使用边界框+关键点的方法
    
    // 收集边界上的关键点（每个polygon的边界点）
    const boundaryPoints = [];
    
    // 从每个polygon中提取边界点（简化：取每个polygon的边界框的四个角点）
    allPolygons.forEach(polygon => {
        let polyMinLng = Infinity, polyMaxLng = -Infinity;
        let polyMinLat = Infinity, polyMaxLat = -Infinity;
        polygon.forEach(coord => {
            const [lng, lat] = coord;
            polyMinLng = Math.min(polyMinLng, lng);
            polyMaxLng = Math.max(polyMaxLng, lng);
            polyMinLat = Math.min(polyMinLat, lat);
            polyMaxLat = Math.max(polyMaxLat, lat);
        });
        // 添加这个polygon的边界框角点
        boundaryPoints.push(
            [polyMinLng, polyMinLat],
            [polyMaxLng, polyMinLat],
            [polyMaxLng, polyMaxLat],
            [polyMinLng, polyMaxLat]
        );
    });
    
    // 创建一个简化的外边界（使用所有polygons的外边界点）
    // 为了只显示一个完整的市边界，我们需要合并所有polygons为一个外边界
    // 简化方法：使用所有polygons的第一个坐标点，创建一个简化的外边界多边形
    
    // 收集所有polygons的外边界点（每个polygon的第一个点）
    // 为了创建一个更真实的外边界，我们使用所有polygons的边界点
    // 但为了简化，我们使用边界框的四个角点，加上一些关键点
    
    // 使用边界框创建外边界（这是最简单的方法，确保只显示一个完整的边界）
    // 如果需要更真实的形状，可以使用凸包算法，但这里为了性能使用边界框
    return {
        type: 'Feature',
        properties: { name: cityKey + '市', type: 'city', 级别: '市', level: 'city' },
        geometry: {
            type: 'Polygon',
            coordinates: [[
                [minLng, minLat],
                [maxLng, minLat],
                [maxLng, maxLat],
                [minLng, maxLat],
                [minLng, minLat]
            ]]
        }
    };
}

// 加载边界数据
async function loadBoundaries() {
    boundaries = [];
    cityOutlines = {};
    
    try {
        // 使用合并的GeoJSON文件
        const mergedFile = 'six_cities_from_anhui.geojson';
        console.log('=== 开始加载边界文件 ===');
        console.log('使用合并文件:', mergedFile);
        
        // 加载合并的GeoJSON文件
        const filePath = mergedFile.startsWith('/') ? mergedFile : './' + mergedFile;
        console.log(`正在加载合并边界文件: ${filePath}`);
        
        const res = await fetch(filePath);
        if (!res.ok) {
            console.error(`加载边界文件失败: HTTP ${res.status}, URL: ${res.url || filePath}`);
            throw new Error(`无法加载边界文件: ${res.status}`);
        }
        
        const geoJsonData = await res.json();
        const allFeatures = geoJsonData.features || [];
        console.log(`✓ 加载合并边界文件成功: ${allFeatures.length}个features, URL: ${res.url || filePath}`);
        
        // 城市名称映射：从完整名称到简写key
        const cityNameMap = {
            '亳州市': '亳州',
            '淮北市': '淮北',
            '阜阳市': '阜阳',
            '淮南市': '淮南',
            '宿州市': '宿州',
            '蚌埠市': '蚌埠'
        };
        
        // 按城市分组features
        const cityFeaturesMap = {};
        allFeatures.forEach(feature => {
            const props = feature.properties || {};
            const name = props.name || '';
            const cityKey = cityNameMap[name];
            
            if (cityKey) {
                if (!cityFeaturesMap[cityKey]) {
                    cityFeaturesMap[cityKey] = [];
                }
                cityFeaturesMap[cityKey].push(feature);
            } else {
                console.warn(`未识别的城市名称: ${name}`);
            }
        });
        
        console.log(`识别到 ${Object.keys(cityFeaturesMap).length} 个城市`);
        
        // 处理每个城市的边界数据
        Object.keys(cityFeaturesMap).forEach(cityKey => {
            const features = cityFeaturesMap[cityKey];
            if (features.length === 0) {
                console.warn(`跳过无features的数据: ${cityKey}`);
                return;
            }
            
            console.log(`处理 ${cityKey}: ${features.length} 个features`);
            
            // 计算外边界（用于边界框计算）
            const outline = calculateCityOutline(features);
            if (!outline) {
                console.warn(`无法计算 ${cityKey} 的外边界`);
            }
            
            // 分离市边界和县/区边界
            let cityFeature = null;
            const countyFeatures = [];
            
            const cityName = cityKey + '市';
            
            for (const feature of features) {
                const props = feature.properties || {};
                const level = props.level || '';
                const name = props.name || '';
                const adcode = props.adcode || 0;
                const isCityBoundaryFlag = props.isCityBoundary === true;
                
                // 判断是否是市边界（用于初始视图）
                // 在合并文件中，每个市通常只有一个feature，就是市边界
                const isCityBoundary = 
                    name === cityName || 
                    (adcode % 100 === 0 && adcode % 10000 !== 0) ||
                    isCityBoundaryFlag ||
                    level === 'city' ||
                    props.type === 'city';
                
                if (isCityBoundary && !cityFeature) {
                    cityFeature = feature;
                    // 确保properties正确
                    cityFeature.properties = cityFeature.properties || {};
                    cityFeature.properties.level = 'city';
                    cityFeature.properties.type = 'city';
                    cityFeature.properties.级别 = '市';
                    cityFeature.properties.name = cityName;
                    cityFeature.properties.isCityBoundary = true;
                    console.log(`  ✓ 找到市边界: ${name} (adcode=${adcode})`);
                } else {
                    // 其他features是县/区（如果有的话）
                    if (adcode % 100 !== 0) {
                        if (adcode % 100 >= 2 && adcode % 100 <= 19) {
                            props.level = 'district';
                            props.type = 'district';
                            props.级别 = '区';
                        } else if (adcode % 100 >= 21 && adcode % 100 <= 29) {
                            props.level = 'county';
                            props.type = 'county';
                            props.级别 = '县';
                        }
                    }
                    countyFeatures.push(feature);
                }
            }
            
            // 如果没有找到市边界，使用第一个feature作为市边界
            if (!cityFeature && features.length > 0) {
                cityFeature = features[0];
                cityFeature.properties = cityFeature.properties || {};
                cityFeature.properties.level = 'city';
                cityFeature.properties.type = 'city';
                cityFeature.properties.级别 = '市';
                cityFeature.properties.name = cityName;
                cityFeature.properties.isCityBoundary = true;
                console.log(`  ⚠ 使用第一个feature作为市边界: ${cityFeature.properties.name || 'unknown'}`);
            }
            
            // 保存到cityOutlines中
            if (outline) {
                cityOutlines[cityKey] = {
                    ...outline,
                    cityFeature: cityFeature,
                    countyFeatures: countyFeatures
                };
            } else {
                cityOutlines[cityKey] = {
                    cityFeature: cityFeature,
                    countyFeatures: countyFeatures
                };
            }
            
            // 初始视图：只显示市边界（使用真实的市边界feature，不显示内部区/县边界）
            if (!currentCity) {
                // 直接使用cityFeature（真实的市边界数据），而不是合并后的边界框
                if (cityFeature) {
                    boundaries.push({
                        city: cityKey,
                        feature: cityFeature,
                        isOutline: true  // 标记为市边界
                    });
                    console.log(`  ✓ 添加到初始视图: ${cityKey}`);
                } else {
                    console.warn(`  ✗ 无法添加 ${cityKey} 到初始视图：没有cityFeature`);
                }
            } else if (currentCity === cityKey) {
                // 详细视图：显示所有县/区边界
                countyFeatures.forEach(feature => {
                    boundaries.push({
                        city: cityKey,
                        feature: feature,
                        isOutline: false  // 标记为县/区边界
                    });
                });
            }
        });
        
        // 如果没有加载到边界数据，使用默认数据
        if (boundaries.length === 0) {
            console.warn('未加载到边界数据，使用默认边界');
            boundaries = [
                {
                    city: '阜阳',
                    feature: {
                        type: 'Feature',
                        properties: { name: '阜阳市', type: 'city' },
                        geometry: {
                            type: 'Polygon',
                            coordinates: [[
                                [115.5, 32.5], [116.5, 32.5], [116.5, 33.5], [115.5, 33.5], [115.5, 32.5]
                            ]]
                        }
                    },
                    isOutline: true
                }
            ];
        } else {
            console.log(`✓ 成功加载 ${boundaries.length} 个边界区域`);
        }
    } catch (error) {
        console.error('加载边界数据失败:', error);
    }
    
    return Promise.resolve();
}

// 调整视图以适应数据
function adjustViewToData() {
    if (boundaries.length === 0) {
        console.warn('没有边界数据，使用默认视图');
        return;
    }
    
    // 计算所有边界的范围
    let minLng = Infinity, maxLng = -Infinity;
    let minLat = Infinity, maxLat = -Infinity;
    
    boundaries.forEach(boundary => {
        const coords = boundary.feature.geometry.coordinates;
        const processCoords = (arr) => {
            arr.forEach(coord => {
                if (Array.isArray(coord[0])) {
                    processCoords(coord);
                } else {
                    const [lng, lat] = coord;
                    minLng = Math.min(minLng, lng);
                    maxLng = Math.max(maxLng, lng);
                    minLat = Math.min(minLat, lat);
                    maxLat = Math.max(maxLat, lat);
                }
            });
        };
        processCoords(coords);
    });
    
    if (minLng === Infinity) {
        console.warn('无法计算边界范围');
        return;
    }
    
    // 计算中心点
    currentView.centerX = (minLng + maxLng) / 2;
    currentView.centerY = (minLat + maxLat) / 2;
    
    // 计算范围
    const lngRange = maxLng - minLng;
    const latRange = maxLat - minLat;
    
    // 添加边距（20%的边距，确保边界不会被裁剪）
    const padding = 0.2;
    const adjustedLngRange = lngRange * (1 + padding * 2);
    const adjustedLatRange = latRange * (1 + padding * 2);
    
    // 计算合适的缩放级别
    // 坐标转换公式：scale = currentView.zoom * Math.min(canvas.width, canvas.height) / 2
    // 我们需要：adjustedLngRange * scale <= canvas.width * (1 - padding)
    // 即：adjustedLngRange * (zoom * minSize / 2) <= canvas.width * (1 - padding)
    // 所以：zoom <= (canvas.width * (1 - padding) * 2) / (adjustedLngRange * minSize)
    
    const canvasMinSize = Math.min(canvas.width, canvas.height);
    const maxRange = Math.max(adjustedLngRange, adjustedLatRange);
    
    // 计算缩放：确保最大范围能完全显示在Canvas中
    // 使用较小的维度来确保所有内容都能显示
    const zoomFromWidth = (canvas.width * (1 - padding) * 2) / (adjustedLngRange * canvasMinSize);
    const zoomFromHeight = (canvas.height * (1 - padding) * 2) / (adjustedLatRange * canvasMinSize);
    
    // 取较小的缩放值，确保所有内容都能显示
    currentView.zoom = Math.min(zoomFromWidth, zoomFromHeight);
    
    // 限制缩放范围
    currentView.zoom = Math.min(2.0, Math.max(0.1, currentView.zoom));
    
    console.log('视图调整:', {
        center: [currentView.centerX, currentView.centerY],
        zoom: currentView.zoom,
        bounds: { minLng, maxLng, minLat, maxLat },
        range: { lngRange, latRange, maxRange },
        adjustedRange: { adjustedLngRange, adjustedLatRange },
        zoomCalculations: { zoomFromWidth, zoomFromHeight },
        boundariesCount: boundaries.length
    });
}

// 鼠标事件处理
function onMouseDown(e) {
    isDragging = true;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
    canvas.style.cursor = 'grabbing';
}

function onMouseMove(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    if (isDragging) {
        const dx = e.clientX - lastMouseX;
        const dy = e.clientY - lastMouseY;
        
        const scale = currentView.zoom * 1000;
        currentView.centerX -= dx / scale;
        currentView.centerY += dy / scale;
        
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
        
        drawMap();
    } else {
        // 检查鼠标是否悬停在区域上
        const geo = canvasToGeo(x, y);
        let foundRegion = null;
        
        boundaries.forEach(boundary => {
            const feature = boundary.feature;
            if (isPointInPolygon(geo.lng, geo.lat, feature.geometry)) {
                foundRegion = feature;
            }
        });
        
        if (foundRegion) {
            canvas.style.cursor = 'pointer';
            hoveredRegion = foundRegion;
            showRegionTooltip(e.clientX, e.clientY, foundRegion);
        } else {
            canvas.style.cursor = 'move';
            hoveredRegion = null;
            hideTooltip();
        }
    }
}

function onMouseUp(e) {
    isDragging = false;
    canvas.style.cursor = 'move';
}

function onWheel(e) {
    e.preventDefault();
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const geo = canvasToGeo(x, y);
    
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const oldZoom = currentView.zoom;
    currentView.zoom *= delta;
    currentView.zoom = Math.max(0.1, Math.min(5.0, currentView.zoom));
    
    // 以鼠标位置为中心缩放
    const scale = currentView.zoom / oldZoom;
    currentView.centerX = geo.lng - (x - canvas.width / 2) / (currentView.zoom * 1000);
    currentView.centerY = geo.lat + (y - canvas.height / 2) / (currentView.zoom * 1000);
    
    drawMap();
}

function onCanvasClick(e) {
    if (!hoveredRegion) return;
    
    const cityKey = hoveredRegion._cityKey;
    const stats = hoveredRegion._stats || { count: 0, events: [] };
    
    // 如果不在详细视图，点击外边界进入详细视图
    if (!currentCity && cityKey) {
        showCityDetail(cityKey);
        return;
    }
    
    // 详细视图中的点击事件
    if (currentCity && stats.events && stats.events.length > 0) {
        const eventList = stats.events.slice(0, 10).map(evt => 
            evt.properties?.事件名称 || evt.properties?.name || '未知事件'
        ).join('\n');
        const more = stats.events.length > 10 ? `\n...还有${stats.events.length - 10}个事件` : '';
        const cityName = WANBEI_CITIES.find(c => c.key === cityKey)?.fullName || cityKey;
        alert(`${cityName} (${stats.count}件事件)\n\n${eventList}${more}`);
    }
}

// 判断点是否在多边形内
function isPointInPolygon(lng, lat, geometry) {
    if (geometry.type === 'Polygon') {
        return pointInPolygon(lng, lat, geometry.coordinates[0]);
    } else if (geometry.type === 'MultiPolygon') {
        return geometry.coordinates.some(polygon => 
            pointInPolygon(lng, lat, polygon[0])
        );
    }
    return false;
}

function pointInPolygon(lng, lat, coords) {
    let inside = false;
    for (let i = 0, j = coords.length - 1; i < coords.length; j = i++) {
        const xi = coords[i][0], yi = coords[i][1];
        const xj = coords[j][0], yj = coords[j][1];
        const intersect = ((yi > lat) !== (yj > lat)) &&
            (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

// 显示区域提示框
function showRegionTooltip(x, y, region) {
    const tooltip = document.getElementById('eventTooltip');
    const stats = region._stats || { count: 0, fullName: '未知区域' };
    
    tooltip.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 5px;">${stats.fullName || region._cityKey}</div>
        <div style="font-size: 14px; color: #2563eb;">事件数量: ${stats.count}件</div>
        ${stats.count > 0 ? `<div style="font-size: 12px; color: #666; margin-top: 5px;">点击查看详情</div>` : ''}
    `;
    
    tooltip.style.display = 'block';
    tooltip.style.left = (x + 10) + 'px';
    tooltip.style.top = (y + 10) + 'px';
}

// 隐藏提示框
function hideTooltip() {
    const tooltip = document.getElementById('eventTooltip');
    tooltip.style.display = 'none';
}

// 应用筛选
function applyFilters() {
    if (!currentCity) return; // 只在详细视图中应用筛选
    
    const eventType = document.getElementById('eventTypeFilter')?.value || '';
    
    // 先筛选当前城市的事件
    let events = allEvents.filter(event => {
        const region = event.properties?.地区 || event.properties?.region || '';
        const city = WANBEI_CITIES.find(c => c.key === currentCity);
        return region.includes(currentCity) || (city && region.includes(city.fullName));
    });
    
    // 事件类型筛选
    if (eventType && eventType !== '全部事件' && eventType !== '') {
        events = events.filter(event => {
            const eventTypeValue = event.properties?.突发事件 || event.properties?.事件类型 || '';
            return eventTypeValue.includes(eventType);
        });
    }
    
    filteredEvents = events;
    
    // 重新统计
    calculateRegionStats();
    
    // 重绘地图
    drawMap();
}

// 渲染六市图块
function renderCityTiles() {
    const grid = document.getElementById('cityTilesGrid');
    if (!grid) return;
    
    grid.innerHTML = '';
    
    WANBEI_CITIES.forEach(city => {
        const stats = regionStats[city.key] || { count: 0, events: [] };
        const color = getColorByCount(stats.count);
        const rangeLabel = getRangeLabel(stats.count);
        
        const tile = document.createElement('div');
        tile.className = 'city-tile';
        tile.style.setProperty('--tile-color', color);
        tile.dataset.cityKey = city.key;
        
        tile.innerHTML = `
            <div class="city-tile-header">
                <h3 class="city-tile-name">${city.name}</h3>
                <div class="city-tile-count">${stats.count}</div>
            </div>
            <div class="city-tile-info">
                <div class="city-tile-color-indicator" style="background: ${color};"></div>
                <span class="city-tile-label">${rangeLabel}</span>
            </div>
            <div class="city-tile-footer">
                点击查看${city.name}的详细事件分布
            </div>
        `;
        
        // 添加悬停效果
        tile.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-8px) scale(1.02)';
        });
        
        tile.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0) scale(1)';
        });
        
        // 添加点击事件
        tile.addEventListener('click', function() {
            const cityKey = this.dataset.cityKey;
            showCityDetail(cityKey);
        });
        
        grid.appendChild(tile);
    });
}

// 获取范围标签
function getRangeLabel(count) {
    for (const range of COLOR_RANGES) {
        if (range.max === undefined) {
            if (count >= range.min) return range.label;
        } else {
            if (count >= range.min && count < range.max) return range.label;
        }
    }
    return COLOR_RANGES[COLOR_RANGES.length - 1].label;
}

// 显示城市详细视图
function showCityDetail(cityKey) {
    currentCity = cityKey;
    const city = WANBEI_CITIES.find(c => c.key === cityKey);
    
    // 显示地图详细视图的头部（返回按钮）
    const viewHeader = document.querySelector('.view-header');
    if (viewHeader) {
        viewHeader.style.display = 'flex';
    }
    
    // 更新城市名称
    const cityNameEl = document.getElementById('currentCityName');
    if (cityNameEl && city) {
        cityNameEl.textContent = city.fullName;
    }
    
    // 筛选该城市的事件
    filteredEvents = allEvents.filter(event => {
        const region = event.properties?.地区 || event.properties?.region || '';
        const eventLng = event.properties?.lng || event.properties?.经度;
        const eventLat = event.properties?.lat || event.properties?.纬度;
        
        // 如果事件有坐标，检查是否在该城市边界内
        if (eventLng && eventLat) {
            const cityOutline = cityOutlines[cityKey];
            if (cityOutline && cityOutline.outline) {
                return isPointInPolygon(eventLng, eventLat, cityOutline.outline.geometry);
            }
        }
        
        // 否则按地区名称匹配
        return region.includes(cityKey) || (city && region.includes(city.fullName));
    });
    
    console.log(`${cityKey}筛选后的事件数量:`, filteredEvents.length);
    console.log('筛选后的事件示例:', filteredEvents.slice(0, 3));
    
    // 重新加载边界（只加载该城市的完整features）
    console.log(`准备调用loadCityBoundaries(${cityKey})`);
    loadCityBoundaries(cityKey).then(() => {
        console.log(`loadCityBoundaries(${cityKey})完成，boundaries数量: ${boundaries.length}`);
        // 重新统计（按县/镇统计）
        calculateRegionStats();
        
        console.log(`进入${cityKey}详细视图，县/镇统计:`, regionStats);
        
        // 调整视图
        adjustViewToData();
        
        // 重绘地图
        drawMap();
    }).catch(error => {
        console.error(`loadCityBoundaries(${cityKey})失败:`, error);
    });
}

// 返回六市视图
function backToTilesView() {
    currentCity = null;
    
    // 隐藏地图详细视图的头部（返回按钮）
    const viewHeader = document.querySelector('.view-header');
    if (viewHeader) {
        viewHeader.style.display = 'none';
    }
    
    // 恢复所有事件
    filteredEvents = [...allEvents];
    
    // 重新加载所有边界（只显示外边界）
    loadBoundaries().then(() => {
        calculateRegionStats();
        adjustViewToData();
        drawMap();
    });
}

// 加载单个城市的边界（详细视图：显示县/区边界）
async function loadCityBoundaries(cityKey) {
    boundaries = [];
    
    console.log(`=== 开始加载${cityKey}详细边界 ===`);
    
    // 从 cityOutlines 中获取该城市的县/区 features
    const cityOutline = cityOutlines[cityKey];
    console.log(`cityOutline[${cityKey}]:`, cityOutline);
    
    // 检查是否有缓存的县/区数据（且不为空）
    if (cityOutline && cityOutline.countyFeatures && cityOutline.countyFeatures.length > 0) {
        console.log(`✓ 从cityOutlines缓存加载${cityKey}的${cityOutline.countyFeatures.length}个县/区边界`);
        cityOutline.countyFeatures.forEach(feature => {
            boundaries.push({
                city: cityKey,
                feature: feature,
                isOutline: false
            });
        });
        console.log(`✓ 加载完成，共${boundaries.length}个县/区边界`);
        return;
    }
    
    // 如果 cityOutlines 中没有县/区数据（或为空），从单独的JSON文件中加载
    // 注意：six_cities_from_anhui.geojson 只包含市边界，不包含县/区边界
    // 所以详细视图需要从单独的JSON文件中加载县/区数据
    if (cityOutline) {
        console.log(`cityOutlines[${cityKey}]存在，但countyFeatures为空或不存在 (countyFeatures: ${cityOutline.countyFeatures ? cityOutline.countyFeatures.length : 'undefined'})`);
    } else {
        console.log(`cityOutlines[${cityKey}]不存在`);
    }
    console.log(`需要从单独文件加载${cityKey}的县/区数据`);
    
    try {
        const cityFiles = [
            { key: '亳州', file: 'boundaries/亳州市.json' },
            { key: '淮北', file: 'boundaries/淮北市.json' },
            { key: '阜阳', file: 'boundaries/阜阳市.json' },
            { key: '淮南', file: 'boundaries/淮南市.json' },
            { key: '宿州', file: 'boundaries/宿州市.json' },
            { key: '蚌埠', file: 'boundaries/蚌埠市.json' },
        ];
        
        const targetCity = cityFiles.find(c => c.key === cityKey);
        if (!targetCity) {
            console.warn(`未找到城市配置: ${cityKey}`);
            return;
        }
        
        try {
            const filePath = targetCity.file.startsWith('/') ? targetCity.file : './' + targetCity.file;
            console.log(`正在加载${cityKey}的详细边界文件: ${filePath}`);
            const res = await fetch(filePath);
            if (!res.ok) {
                console.error(`加载${cityKey}边界失败: HTTP ${res.status}`);
                return;
            }
            const gj = await res.json();
            
            const features = gj.features || [];
            const cityName = cityKey + '市';
            
            console.log(`✓ 成功加载文件，从文件加载${cityKey}的${features.length}个features`);
            console.log(`features详情:`, features.map(f => ({
                name: f.properties?.name,
                adcode: f.properties?.adcode,
                level: f.properties?.level
            })));
            
            // 分离市边界和县/区边界
            features.forEach(feature => {
                const props = feature.properties || {};
                const name = props.name || '';
                const adcode = props.adcode || 0;
                const level = props.level || '';
                const isCityBoundaryFlag = props.isCityBoundary === true;
                
                // 判断是否是真正的市边界（adcode以00结尾，且不是0000结尾）
                // 市级adcode格式：341200（亳州）、341600（阜阳）等，以00结尾
                // 注意：有些区的name也是"XX市"（如"亳州市"可能是谯城区），但adcode不是00结尾
                // 真正的市边界：adcode % 100 === 0 && adcode % 10000 !== 0
                const isRealCityBoundary = (adcode % 100 === 0 && adcode % 10000 !== 0);
                
                // 在详细视图中，只添加县/区边界，排除真正的市边界
                // 如果adcode不是00结尾，说明是县/区，应该添加
                if (!isRealCityBoundary) {
                    // 确保属性正确
                    if (adcode % 100 !== 0) {
                        if (adcode % 100 >= 2 && adcode % 100 <= 19) {
                            // 区（adcode以02-19结尾）
                            props.level = 'district';
                            props.type = 'district';
                            props.级别 = '区';
                            if (!name.endsWith('区') && !name.endsWith('县')) {
                                props.name = name.replace('市', '区');
                            }
                        } else if (adcode % 100 >= 21 && adcode % 100 <= 29) {
                            // 县（adcode以21-29结尾）
                            props.level = 'county';
                            props.type = 'county';
                            props.级别 = '县';
                        } else {
                            // 其他情况，根据名称判断
                            if (name.includes('区')) {
                                props.level = 'district';
                                props.type = 'district';
                                props.级别 = '区';
                            } else if (name.includes('县')) {
                                props.level = 'county';
                                props.type = 'county';
                                props.级别 = '县';
                            }
                        }
                    }
                    
                    boundaries.push({
                        city: targetCity.key,
                        feature: feature,
                        isOutline: false
                    });
                    console.log(`  添加县/区边界: ${name} (adcode=${adcode}, level=${props.level || level})`);
                } else {
                    console.log(`  跳过市边界: ${name} (adcode=${adcode})`);
                }
            });
            
            // 更新 cityOutlines，保存县/区数据，避免下次重新加载
            if (cityOutline) {
                cityOutline.countyFeatures = boundaries.map(b => b.feature);
            }
            
            console.log(`✓ 加载${cityKey}详细边界成功: ${boundaries.length}个县/区`);
        } catch (e) {
            console.error(`加载${cityKey}边界失败:`, e);
        }
    } catch (error) {
        console.error('加载城市边界数据失败:', error);
    }
}

// 绘制事件节点
function drawEvents() {
    if (!filteredEvents || filteredEvents.length === 0) return;
    
    filteredEvents.forEach(event => {
        const lng = event.properties?.lng || event.properties?.经度 || 0;
        const lat = event.properties?.lat || event.properties?.纬度 || 0;
        
        if (!lng || !lat) return;
        
        const point = geoToCanvas(lng, lat);
        
        // 绘制事件节点图标（红色圆点）
        ctx.beginPath();
        ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#ff0000';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.stroke();
    });
}

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', () => {
    // 获取视图容器
    cityTilesView = document.getElementById('cityTilesView');
    mapDetailView = document.getElementById('mapDetailView');
    
    // 初始化Canvas
    initCanvas();
    
    // 加载数据
    loadData();
    
    // 绑定返回按钮
    const backBtn = document.getElementById('backToTilesBtn');
    if (backBtn) {
        backBtn.addEventListener('click', backToTilesView);
    }
    
    // 绑定筛选事件（仅在详细视图中使用）
    const eventTypeFilter = document.getElementById('eventTypeFilter');
    const regionFilter = document.getElementById('regionFilter');
    
    if (eventTypeFilter) {
        eventTypeFilter.addEventListener('change', () => {
            if (currentCity) {
                applyFilters();
            }
        });
    }
    
    if (regionFilter) {
        regionFilter.addEventListener('change', () => {
            if (currentCity) {
                applyFilters();
            }
        });
    }
    
    // 添加roundRect polyfill（如果浏览器不支持）
    if (!CanvasRenderingContext2D.prototype.roundRect) {
        CanvasRenderingContext2D.prototype.roundRect = function(x, y, width, height, radius) {
            this.beginPath();
            this.moveTo(x + radius, y);
            this.lineTo(x + width - radius, y);
            this.quadraticCurveTo(x + width, y, x + width, y + radius);
            this.lineTo(x + width, y + height - radius);
            this.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
            this.lineTo(x + radius, y + height);
            this.quadraticCurveTo(x, y + height, x, y + height - radius);
            this.lineTo(x, y + radius);
            this.quadraticCurveTo(x, y, x + radius, y);
            this.closePath();
        };
    }
});


// 绘制事件节点
function drawEvents() {
    if (!filteredEvents || filteredEvents.length === 0) return;
    
    filteredEvents.forEach(event => {
        const lng = event.properties?.lng || event.properties?.经度 || 0;
        const lat = event.properties?.lat || event.properties?.纬度 || 0;
        
        if (!lng || !lat) return;
        
        const point = geoToCanvas(lng, lat);
        
        // 绘制事件节点图标（红色圆点）
        ctx.beginPath();
        ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#ff0000';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.stroke();
    });
}

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', () => {
    // 获取视图容器
    cityTilesView = document.getElementById('cityTilesView');
    mapDetailView = document.getElementById('mapDetailView');
    
    // 初始化Canvas
    initCanvas();
    
    // 加载数据
    loadData();
    
    // 绑定返回按钮
    const backBtn = document.getElementById('backToTilesBtn');
    if (backBtn) {
        backBtn.addEventListener('click', backToTilesView);
    }
    
    // 绑定筛选事件（仅在详细视图中使用）
    const eventTypeFilter = document.getElementById('eventTypeFilter');
    const regionFilter = document.getElementById('regionFilter');
    
    if (eventTypeFilter) {
        eventTypeFilter.addEventListener('change', () => {
            if (currentCity) {
                applyFilters();
            }
        });
    }
    
    if (regionFilter) {
        regionFilter.addEventListener('change', () => {
            if (currentCity) {
                applyFilters();
            }
        });
    }
    
    // 添加roundRect polyfill（如果浏览器不支持）
    if (!CanvasRenderingContext2D.prototype.roundRect) {
        CanvasRenderingContext2D.prototype.roundRect = function(x, y, width, height, radius) {
            this.beginPath();
            this.moveTo(x + radius, y);
            this.lineTo(x + width - radius, y);
            this.quadraticCurveTo(x + width, y, x + width, y + radius);
            this.lineTo(x + width, y + height - radius);
            this.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
            this.lineTo(x + radius, y + height);
            this.quadraticCurveTo(x, y + height, x, y + height - radius);
            this.lineTo(x, y + radius);
            this.quadraticCurveTo(x, y, x + radius, y);
            this.closePath();
        };
    }
});

// 显示城市详细视图
function showCityDetail(cityKey) {
    currentCity = cityKey;
    const city = WANBEI_CITIES.find(c => c.key === cityKey);
    
    // 显示地图详细视图的头部（返回按钮）
    const viewHeader = document.querySelector('.view-header');
    if (viewHeader) {
        viewHeader.style.display = 'flex';
    }
    
    // 更新城市名称
    const cityNameEl = document.getElementById('currentCityName');
    if (cityNameEl && city) {
        cityNameEl.textContent = city.fullName;
    }
    
    // 筛选该城市的事件
    filteredEvents = allEvents.filter(event => {
        const region = event.properties?.地区 || event.properties?.region || '';
        const eventLng = event.properties?.lng || event.properties?.经度;
        const eventLat = event.properties?.lat || event.properties?.纬度;
        
        // 如果事件有坐标，检查是否在该城市边界内
        if (eventLng && eventLat) {
            const cityOutline = cityOutlines[cityKey];
            if (cityOutline && cityOutline.outline) {
                return isPointInPolygon(eventLng, eventLat, cityOutline.outline.geometry);
            }
        }
        
        // 否则按地区名称匹配
        return region.includes(cityKey) || (city && region.includes(city.fullName));
    });
    
    console.log(`${cityKey}筛选后的事件数量:`, filteredEvents.length);
    console.log('筛选后的事件示例:', filteredEvents.slice(0, 3));
    
    // 重新加载边界（只加载该城市的完整features）
    console.log(`准备调用loadCityBoundaries(${cityKey})`);
    loadCityBoundaries(cityKey).then(() => {
        console.log(`loadCityBoundaries(${cityKey})完成，boundaries数量: ${boundaries.length}`);
        // 重新统计（按县/镇统计）
        calculateRegionStats();
        
        console.log(`进入${cityKey}详细视图，县/镇统计:`, regionStats);
        
        // 调整视图
        adjustViewToData();
        
        // 重绘地图
        drawMap();
    }).catch(error => {
        console.error(`loadCityBoundaries(${cityKey})失败:`, error);
    });
}

// 返回六市视图
function backToTilesView() {
    currentCity = null;
    
    // 隐藏地图详细视图的头部（返回按钮）
    const viewHeader = document.querySelector('.view-header');
    if (viewHeader) {
        viewHeader.style.display = 'none';
    }
    
    // 恢复所有事件
    filteredEvents = [...allEvents];
    
    // 重新加载所有边界（只显示外边界）
    loadBoundaries().then(() => {
        calculateRegionStats();
        adjustViewToData();
        drawMap();
    });
}

// 注意：loadCityBoundaries 函数已在上面定义（第1370行），这里不应该有重复定义
// 如果这里还有旧代码，应该删除
// 以下是旧版本的代码，已被上面的新版本替代
/*
async function loadCityBoundaries_OLD(cityKey) {
    boundaries = [];
    
    // 从 cityOutlines 中获取该城市的完整 features
    const cityOutline = cityOutlines[cityKey];
    if (cityOutline && cityOutline.features) {
        cityOutline.features.forEach(feature => {
            boundaries.push({
                city: cityKey,
                feature: feature,
                isOutline: false
            });
        });
        return;
    }
    
    // 如果 cityOutlines 中没有，重新加载
    try {
        const cityFiles = [
            { key: '亳州', file: 'boundaries/亳州市.json' },
            { key: '淮北', file: 'boundaries/淮北市.json' },
            { key: '阜阳', file: 'boundaries/阜阳市.json' },
            { key: '淮南', file: 'boundaries/淮南市.json' },
            { key: '宿州', file: 'boundaries/宿州市.json' },
            { key: '蚌埠', file: 'boundaries/蚌埠市.json' },
        ];
        
        const targetCity = cityFiles.find(c => c.key === cityKey);
        if (!targetCity) return;
        
        try {
            const res = await fetch(targetCity.file);
            if (!res.ok) return;
            const gj = await res.json();
            
            const features = gj.features || [];
            features.forEach(feature => {
                boundaries.push({
                    city: targetCity.key,
                    feature: feature,
                    isOutline: false
                });
            });
        } catch (e) {
            console.error(`加载${cityKey}边界失败:`, e);
        }
    } catch (error) {
        console.error('加载城市边界数据失败:', error);
    }
}
*/

// 绘制事件节点
function drawEvents() {
    if (!filteredEvents || filteredEvents.length === 0) return;
    
    filteredEvents.forEach(event => {
        const lng = event.properties?.lng || event.properties?.经度 || 0;
        const lat = event.properties?.lat || event.properties?.纬度 || 0;
        
        if (!lng || !lat) return;
        
        const point = geoToCanvas(lng, lat);
        
        // 绘制事件节点图标（红色圆点）
        ctx.beginPath();
        ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#ff0000';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.stroke();
    });
}

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', () => {
    // 获取视图容器
    cityTilesView = document.getElementById('cityTilesView');
    mapDetailView = document.getElementById('mapDetailView');
    
    // 初始化Canvas
    initCanvas();
    
    // 加载数据
    loadData();
    
    // 绑定返回按钮
    const backBtn = document.getElementById('backToTilesBtn');
    if (backBtn) {
        backBtn.addEventListener('click', backToTilesView);
    }
    
    // 绑定筛选事件（仅在详细视图中使用）
    const eventTypeFilter = document.getElementById('eventTypeFilter');
    const regionFilter = document.getElementById('regionFilter');
    
    if (eventTypeFilter) {
        eventTypeFilter.addEventListener('change', () => {
            if (currentCity) {
                applyFilters();
            }
        });
    }
    
    if (regionFilter) {
        regionFilter.addEventListener('change', () => {
            if (currentCity) {
                applyFilters();
            }
        });
    }
    
    // 添加roundRect polyfill（如果浏览器不支持）
    if (!CanvasRenderingContext2D.prototype.roundRect) {
        CanvasRenderingContext2D.prototype.roundRect = function(x, y, width, height, radius) {
            this.beginPath();
            this.moveTo(x + radius, y);
            this.lineTo(x + width - radius, y);
            this.quadraticCurveTo(x + width, y, x + width, y + radius);
            this.lineTo(x + width, y + height - radius);
            this.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
            this.lineTo(x + radius, y + height);
            this.quadraticCurveTo(x, y + height, x, y + height - radius);
            this.lineTo(x, y + radius);
            this.quadraticCurveTo(x, y, x + radius, y);
            this.closePath();
        };
    }
});

        ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#ff0000';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.stroke();
    });
}

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', () => {
    // 获取视图容器
    cityTilesView = document.getElementById('cityTilesView');
    mapDetailView = document.getElementById('mapDetailView');
    
    // 初始化Canvas
    initCanvas();
    
    // 加载数据
    loadData();
    
    // 绑定返回按钮
    const backBtn = document.getElementById('backToTilesBtn');
    if (backBtn) {
        backBtn.addEventListener('click', backToTilesView);
    }
    
    // 绑定筛选事件（仅在详细视图中使用）
    const eventTypeFilter = document.getElementById('eventTypeFilter');
    const regionFilter = document.getElementById('regionFilter');
    
    if (eventTypeFilter) {
        eventTypeFilter.addEventListener('change', () => {
            if (currentCity) {
                applyFilters();
            }
        });
    }
    
    if (regionFilter) {
        regionFilter.addEventListener('change', () => {
            if (currentCity) {
                applyFilters();
            }
        });
    }
    
    // 添加roundRect polyfill（如果浏览器不支持）
    if (!CanvasRenderingContext2D.prototype.roundRect) {
        CanvasRenderingContext2D.prototype.roundRect = function(x, y, width, height, radius) {
            this.beginPath();
            this.moveTo(x + radius, y);
            this.lineTo(x + width - radius, y);
            this.quadraticCurveTo(x + width, y, x + width, y + radius);
            this.lineTo(x + width, y + height - radius);
            this.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
            this.lineTo(x + radius, y + height);
            this.quadraticCurveTo(x, y + height, x, y + height - radius);
            this.lineTo(x, y + radius);
            this.quadraticCurveTo(x, y, x + radius, y);
            this.closePath();
        };
    }
});

// 显示城市详细视图
function showCityDetail(cityKey) {
    currentCity = cityKey;
    const city = WANBEI_CITIES.find(c => c.key === cityKey);
    
    // 显示地图详细视图的头部（返回按钮）
    const viewHeader = document.querySelector('.view-header');
    if (viewHeader) {
        viewHeader.style.display = 'flex';
    }
    
    // 更新城市名称
    const cityNameEl = document.getElementById('currentCityName');
    if (cityNameEl && city) {
        cityNameEl.textContent = city.fullName;
    }
    
    // 筛选该城市的事件
    filteredEvents = allEvents.filter(event => {
        const region = event.properties?.地区 || event.properties?.region || '';
        const eventLng = event.properties?.lng || event.properties?.经度;
        const eventLat = event.properties?.lat || event.properties?.纬度;
        
        // 如果事件有坐标，检查是否在该城市边界内
        if (eventLng && eventLat) {
            const cityOutline = cityOutlines[cityKey];
            if (cityOutline && cityOutline.outline) {
                return isPointInPolygon(eventLng, eventLat, cityOutline.outline.geometry);
            }
        }
        
        // 否则按地区名称匹配
        return region.includes(cityKey) || (city && region.includes(city.fullName));
    });
    
    console.log(`${cityKey}筛选后的事件数量:`, filteredEvents.length);
    console.log('筛选后的事件示例:', filteredEvents.slice(0, 3));
    
    // 重新加载边界（只加载该城市的完整features）
    console.log(`准备调用loadCityBoundaries(${cityKey})`);
    loadCityBoundaries(cityKey).then(() => {
        console.log(`loadCityBoundaries(${cityKey})完成，boundaries数量: ${boundaries.length}`);
        // 重新统计（按县/镇统计）
        calculateRegionStats();
        
        console.log(`进入${cityKey}详细视图，县/镇统计:`, regionStats);
        
        // 调整视图
        adjustViewToData();
        
        // 重绘地图
        drawMap();
    }).catch(error => {
        console.error(`loadCityBoundaries(${cityKey})失败:`, error);
    });
}

// 返回六市视图
function backToTilesView() {
    currentCity = null;
    
    // 隐藏地图详细视图的头部（返回按钮）
    const viewHeader = document.querySelector('.view-header');
    if (viewHeader) {
        viewHeader.style.display = 'none';
    }
    
    // 恢复所有事件
    filteredEvents = [...allEvents];
    
    // 重新加载所有边界（只显示外边界）
    loadBoundaries().then(() => {
        calculateRegionStats();
        adjustViewToData();
        drawMap();
    });
}

// 注意：loadCityBoundaries 函数已在上面定义（第1370行），这里不应该有重复定义
// 如果这里还有旧代码，应该删除
// 以下是旧版本的代码，已被上面的新版本替代
/*
async function loadCityBoundaries_OLD(cityKey) {
    boundaries = [];
    
    // 从 cityOutlines 中获取该城市的完整 features
    const cityOutline = cityOutlines[cityKey];
    if (cityOutline && cityOutline.features) {
        cityOutline.features.forEach(feature => {
            boundaries.push({
                city: cityKey,
                feature: feature,
                isOutline: false
            });
        });
        return;
    }
    
    // 如果 cityOutlines 中没有，重新加载
    try {
        const cityFiles = [
            { key: '亳州', file: 'boundaries/亳州市.json' },
            { key: '淮北', file: 'boundaries/淮北市.json' },
            { key: '阜阳', file: 'boundaries/阜阳市.json' },
            { key: '淮南', file: 'boundaries/淮南市.json' },
            { key: '宿州', file: 'boundaries/宿州市.json' },
            { key: '蚌埠', file: 'boundaries/蚌埠市.json' },
        ];
        
        const targetCity = cityFiles.find(c => c.key === cityKey);
        if (!targetCity) return;
        
        try {
            const res = await fetch(targetCity.file);
            if (!res.ok) return;
            const gj = await res.json();
            
            const features = gj.features || [];
            features.forEach(feature => {
                boundaries.push({
                    city: targetCity.key,
                    feature: feature,
                    isOutline: false
                });
            });
        } catch (e) {
            console.error(`加载${cityKey}边界失败:`, e);
        }
    } catch (error) {
        console.error('加载城市边界数据失败:', error);
    }
}
*/

// 绘制事件节点
function drawEvents() {
    if (!filteredEvents || filteredEvents.length === 0) return;
    
    filteredEvents.forEach(event => {
        const lng = event.properties?.lng || event.properties?.经度 || 0;
        const lat = event.properties?.lat || event.properties?.纬度 || 0;
        
        if (!lng || !lat) return;
        
        const point = geoToCanvas(lng, lat);
        
        // 绘制事件节点图标（红色圆点）
        ctx.beginPath();
        ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#ff0000';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.stroke();
    });
}

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', () => {
    // 获取视图容器
    cityTilesView = document.getElementById('cityTilesView');
    mapDetailView = document.getElementById('mapDetailView');
    
    // 初始化Canvas
    initCanvas();
    
    // 加载数据
    loadData();
    
    // 绑定返回按钮
    const backBtn = document.getElementById('backToTilesBtn');
    if (backBtn) {
        backBtn.addEventListener('click', backToTilesView);
    }
    
    // 绑定筛选事件（仅在详细视图中使用）
    const eventTypeFilter = document.getElementById('eventTypeFilter');
    const regionFilter = document.getElementById('regionFilter');
    
    if (eventTypeFilter) {
        eventTypeFilter.addEventListener('change', () => {
            if (currentCity) {
                applyFilters();
            }
        });
    }
    
    if (regionFilter) {
        regionFilter.addEventListener('change', () => {
            if (currentCity) {
                applyFilters();
            }
        });
    }
    
    // 添加roundRect polyfill（如果浏览器不支持）
    if (!CanvasRenderingContext2D.prototype.roundRect) {
        CanvasRenderingContext2D.prototype.roundRect = function(x, y, width, height, radius) {
            this.beginPath();
            this.moveTo(x + radius, y);
            this.lineTo(x + width - radius, y);
            this.quadraticCurveTo(x + width, y, x + width, y + radius);
            this.lineTo(x + width, y + height - radius);
            this.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
            this.lineTo(x + radius, y + height);
            this.quadraticCurveTo(x, y + height, x, y + height - radius);
            this.lineTo(x, y + radius);
            this.quadraticCurveTo(x, y, x + radius, y);
            this.closePath();
        };
    }
});

        ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#ff0000';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.stroke();
    });
}

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', () => {
    // 获取视图容器
    cityTilesView = document.getElementById('cityTilesView');
    mapDetailView = document.getElementById('mapDetailView');
    
    // 初始化Canvas
    initCanvas();
    
    // 加载数据
    loadData();
    
    // 绑定返回按钮
    const backBtn = document.getElementById('backToTilesBtn');
    if (backBtn) {
        backBtn.addEventListener('click', backToTilesView);
    }
    
    // 绑定筛选事件（仅在详细视图中使用）
    const eventTypeFilter = document.getElementById('eventTypeFilter');
    const regionFilter = document.getElementById('regionFilter');
    
    if (eventTypeFilter) {
        eventTypeFilter.addEventListener('change', () => {
            if (currentCity) {
                applyFilters();
            }
        });
    }
    
    if (regionFilter) {
        regionFilter.addEventListener('change', () => {
            if (currentCity) {
                applyFilters();
            }
        });
    }
    
    // 添加roundRect polyfill（如果浏览器不支持）
    if (!CanvasRenderingContext2D.prototype.roundRect) {
        CanvasRenderingContext2D.prototype.roundRect = function(x, y, width, height, radius) {
            this.beginPath();
            this.moveTo(x + radius, y);
            this.lineTo(x + width - radius, y);
            this.quadraticCurveTo(x + width, y, x + width, y + radius);
            this.lineTo(x + width, y + height - radius);
            this.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
            this.lineTo(x + radius, y + height);
            this.quadraticCurveTo(x, y + height, x, y + height - radius);
            this.lineTo(x, y + radius);
            this.quadraticCurveTo(x, y, x + radius, y);
            this.closePath();
        };
    }
});

// 显示城市详细视图
function showCityDetail(cityKey) {
    currentCity = cityKey;
    const city = WANBEI_CITIES.find(c => c.key === cityKey);
    
    // 显示地图详细视图的头部（返回按钮）
    const viewHeader = document.querySelector('.view-header');
    if (viewHeader) {
        viewHeader.style.display = 'flex';
    }
    
    // 更新城市名称
    const cityNameEl = document.getElementById('currentCityName');
    if (cityNameEl && city) {
        cityNameEl.textContent = city.fullName;
    }
    
    // 筛选该城市的事件
    filteredEvents = allEvents.filter(event => {
        const region = event.properties?.地区 || event.properties?.region || '';
        const eventLng = event.properties?.lng || event.properties?.经度;
        const eventLat = event.properties?.lat || event.properties?.纬度;
        
        // 如果事件有坐标，检查是否在该城市边界内
        if (eventLng && eventLat) {
            const cityOutline = cityOutlines[cityKey];
            if (cityOutline && cityOutline.outline) {
                return isPointInPolygon(eventLng, eventLat, cityOutline.outline.geometry);
            }
        }
        
        // 否则按地区名称匹配
        return region.includes(cityKey) || (city && region.includes(city.fullName));
    });
    
    console.log(`${cityKey}筛选后的事件数量:`, filteredEvents.length);
    console.log('筛选后的事件示例:', filteredEvents.slice(0, 3));
    
    // 重新加载边界（只加载该城市的完整features）
    console.log(`准备调用loadCityBoundaries(${cityKey})`);
    loadCityBoundaries(cityKey).then(() => {
        console.log(`loadCityBoundaries(${cityKey})完成，boundaries数量: ${boundaries.length}`);
        // 重新统计（按县/镇统计）
        calculateRegionStats();
        
        console.log(`进入${cityKey}详细视图，县/镇统计:`, regionStats);
        
        // 调整视图
        adjustViewToData();
        
        // 重绘地图
        drawMap();
    }).catch(error => {
        console.error(`loadCityBoundaries(${cityKey})失败:`, error);
    });
}

// 返回六市视图
function backToTilesView() {
    currentCity = null;
    
    // 隐藏地图详细视图的头部（返回按钮）
    const viewHeader = document.querySelector('.view-header');
    if (viewHeader) {
        viewHeader.style.display = 'none';
    }
    
    // 恢复所有事件
    filteredEvents = [...allEvents];
    
    // 重新加载所有边界（只显示外边界）
    loadBoundaries().then(() => {
        calculateRegionStats();
        adjustViewToData();
        drawMap();
    });
}

// 注意：loadCityBoundaries 函数已在上面定义（第1370行），这里不应该有重复定义
// 如果这里还有旧代码，应该删除
// 以下是旧版本的代码，已被上面的新版本替代
/*
async function loadCityBoundaries_OLD(cityKey) {
    boundaries = [];
    
    // 从 cityOutlines 中获取该城市的完整 features
    const cityOutline = cityOutlines[cityKey];
    if (cityOutline && cityOutline.features) {
        cityOutline.features.forEach(feature => {
            boundaries.push({
                city: cityKey,
                feature: feature,
                isOutline: false
            });
        });
        return;
    }
    
    // 如果 cityOutlines 中没有，重新加载
    try {
        const cityFiles = [
            { key: '亳州', file: 'boundaries/亳州市.json' },
            { key: '淮北', file: 'boundaries/淮北市.json' },
            { key: '阜阳', file: 'boundaries/阜阳市.json' },
            { key: '淮南', file: 'boundaries/淮南市.json' },
            { key: '宿州', file: 'boundaries/宿州市.json' },
            { key: '蚌埠', file: 'boundaries/蚌埠市.json' },
        ];
        
        const targetCity = cityFiles.find(c => c.key === cityKey);
        if (!targetCity) return;
        
        try {
            const res = await fetch(targetCity.file);
            if (!res.ok) return;
            const gj = await res.json();
            
            const features = gj.features || [];
            features.forEach(feature => {
                boundaries.push({
                    city: targetCity.key,
                    feature: feature,
                    isOutline: false
                });
            });
        } catch (e) {
            console.error(`加载${cityKey}边界失败:`, e);
        }
    } catch (error) {
        console.error('加载城市边界数据失败:', error);
    }
}
*/

// 绘制事件节点
function drawEvents() {
    if (!filteredEvents || filteredEvents.length === 0) return;
    
    filteredEvents.forEach(event => {
        const lng = event.properties?.lng || event.properties?.经度 || 0;
        const lat = event.properties?.lat || event.properties?.纬度 || 0;
        
        if (!lng || !lat) return;
        
        const point = geoToCanvas(lng, lat);
        
        // 绘制事件节点图标（红色圆点）
        ctx.beginPath();
        ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#ff0000';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.stroke();
    });
}

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', () => {
    // 获取视图容器
    cityTilesView = document.getElementById('cityTilesView');
    mapDetailView = document.getElementById('mapDetailView');
    
    // 初始化Canvas
    initCanvas();
    
    // 加载数据
    loadData();
    
    // 绑定返回按钮
    const backBtn = document.getElementById('backToTilesBtn');
    if (backBtn) {
        backBtn.addEventListener('click', backToTilesView);
    }
    
    // 绑定筛选事件（仅在详细视图中使用）
    const eventTypeFilter = document.getElementById('eventTypeFilter');
    const regionFilter = document.getElementById('regionFilter');
    
    if (eventTypeFilter) {
        eventTypeFilter.addEventListener('change', () => {
            if (currentCity) {
                applyFilters();
            }
        });
    }
    
    if (regionFilter) {
        regionFilter.addEventListener('change', () => {
            if (currentCity) {
                applyFilters();
            }
        });
    }
    
    // 添加roundRect polyfill（如果浏览器不支持）
    if (!CanvasRenderingContext2D.prototype.roundRect) {
        CanvasRenderingContext2D.prototype.roundRect = function(x, y, width, height, radius) {
            this.beginPath();
            this.moveTo(x + radius, y);
            this.lineTo(x + width - radius, y);
            this.quadraticCurveTo(x + width, y, x + width, y + radius);
            this.lineTo(x + width, y + height - radius);
            this.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
            this.lineTo(x + radius, y + height);
            this.quadraticCurveTo(x, y + height, x, y + height - radius);
            this.lineTo(x, y + radius);
            this.quadraticCurveTo(x, y, x + radius, y);
            this.closePath();
        };
    }
});

        if (range.max === undefined) {
            if (count >= range.min) return range.label;
        } else {
            if (count >= range.min && count < range.max) return range.label;
        }
    }
    return COLOR_RANGES[COLOR_RANGES.length - 1].label;
}

// 显示城市详细视图
function showCityDetail(cityKey) {
    currentCity = cityKey;
    const city = WANBEI_CITIES.find(c => c.key === cityKey);
    
    // 显示地图详细视图的头部（返回按钮）
    const viewHeader = document.querySelector('.view-header');
    if (viewHeader) {
        viewHeader.style.display = 'flex';
    }
    
    // 更新城市名称
    const cityNameEl = document.getElementById('currentCityName');
    if (cityNameEl && city) {
        cityNameEl.textContent = city.fullName;
    }
    
    // 筛选该城市的事件
    filteredEvents = allEvents.filter(event => {
        const region = event.properties?.地区 || event.properties?.region || '';
        const eventLng = event.properties?.lng || event.properties?.经度;
        const eventLat = event.properties?.lat || event.properties?.纬度;
        
        // 如果事件有坐标，检查是否在该城市边界内
        if (eventLng && eventLat) {
            const cityOutline = cityOutlines[cityKey];
            if (cityOutline && cityOutline.outline) {
                return isPointInPolygon(eventLng, eventLat, cityOutline.outline.geometry);
            }
        }
        
        // 否则按地区名称匹配
        return region.includes(cityKey) || (city && region.includes(city.fullName));
    });
    
    console.log(`${cityKey}筛选后的事件数量:`, filteredEvents.length);
    console.log('筛选后的事件示例:', filteredEvents.slice(0, 3));
    
    // 重新加载边界（只加载该城市的完整features）
    loadCityBoundaries(cityKey).then(() => {
        // 重新统计（按县/镇统计）
        calculateRegionStats();
        
        console.log(`进入${cityKey}详细视图，县/镇统计:`, regionStats);
        
        // 调整视图
        adjustViewToData();
        
        // 重绘地图
        drawMap();
    });
}

// 返回六市视图
function backToTilesView() {
    currentCity = null;
    
    // 隐藏地图详细视图的头部（返回按钮）
    const viewHeader = document.querySelector('.view-header');
    if (viewHeader) {
        viewHeader.style.display = 'none';
    }
    
    // 恢复所有事件
    filteredEvents = [...allEvents];
    
    // 重新加载所有边界（只显示外边界）
    loadBoundaries().then(() => {
        calculateRegionStats();
        adjustViewToData();
        drawMap();
    });
}

// 加载单个城市的边界
async function loadCityBoundaries(cityKey) {
    boundaries = [];
    
    // 从 cityOutlines 中获取该城市的完整 features
    const cityOutline = cityOutlines[cityKey];
    if (cityOutline && cityOutline.features) {
        cityOutline.features.forEach(feature => {
            boundaries.push({
                city: cityKey,
                feature: feature,
                isOutline: false
            });
        });
        return;
    }
    
    // 如果 cityOutlines 中没有，重新加载
    try {
        const cityFiles = [
            { key: '亳州', file: 'boundaries/亳州市.json' },
            { key: '淮北', file: 'boundaries/淮北市.json' },
            { key: '阜阳', file: 'boundaries/阜阳市.json' },
            { key: '淮南', file: 'boundaries/淮南市.json' },
            { key: '宿州', file: 'boundaries/宿州市.json' },
            { key: '蚌埠', file: 'boundaries/蚌埠市.json' },
        ];
        
        const targetCity = cityFiles.find(c => c.key === cityKey);
        if (!targetCity) return;
        
        try {
            const res = await fetch(targetCity.file);
            if (!res.ok) return;
            const gj = await res.json();
            
            const features = gj.features || [];
            features.forEach(feature => {
                boundaries.push({
                    city: targetCity.key,
                    feature: feature,
                    isOutline: false
                });
            });
        } catch (e) {
            console.error(`加载${cityKey}边界失败:`, e);
        }
    } catch (error) {
        console.error('加载城市边界数据失败:', error);
    }
}

// 绘制事件节点
function drawEvents() {
    if (!filteredEvents || filteredEvents.length === 0) return;
    
    filteredEvents.forEach(event => {
        const lng = event.properties?.lng || event.properties?.经度 || 0;
        const lat = event.properties?.lat || event.properties?.纬度 || 0;
        
        if (!lng || !lat) return;
        
        const point = geoToCanvas(lng, lat);
        
        // 绘制事件节点图标（红色圆点）
        ctx.beginPath();
        ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#ff0000';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.stroke();
    });
}

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', () => {
    // 获取视图容器
    cityTilesView = document.getElementById('cityTilesView');
    mapDetailView = document.getElementById('mapDetailView');
    
    // 初始化Canvas
    initCanvas();
    
    // 加载数据
    loadData();
    
    // 绑定返回按钮
    const backBtn = document.getElementById('backToTilesBtn');
    if (backBtn) {
        backBtn.addEventListener('click', backToTilesView);
    }
    
    // 绑定筛选事件（仅在详细视图中使用）
    const eventTypeFilter = document.getElementById('eventTypeFilter');
    const regionFilter = document.getElementById('regionFilter');
    
    if (eventTypeFilter) {
        eventTypeFilter.addEventListener('change', () => {
            if (currentCity) {
                applyFilters();
            }
        });
    }
    
    if (regionFilter) {
        regionFilter.addEventListener('change', () => {
            if (currentCity) {
                applyFilters();
            }
        });
    }
    
    // 添加roundRect polyfill（如果浏览器不支持）
    if (!CanvasRenderingContext2D.prototype.roundRect) {
        CanvasRenderingContext2D.prototype.roundRect = function(x, y, width, height, radius) {
            this.beginPath();
            this.moveTo(x + radius, y);
            this.lineTo(x + width - radius, y);
            this.quadraticCurveTo(x + width, y, x + width, y + radius);
            this.lineTo(x + width, y + height - radius);
            this.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
            this.lineTo(x + radius, y + height);
            this.quadraticCurveTo(x, y + height, x, y + height - radius);
            this.lineTo(x, y + radius);
            this.quadraticCurveTo(x, y, x + radius, y);
            this.closePath();
        };
    }
});


// 绘制事件节点
function drawEvents() {
    if (!filteredEvents || filteredEvents.length === 0) return;
    
    filteredEvents.forEach(event => {
        const lng = event.properties?.lng || event.properties?.经度 || 0;
        const lat = event.properties?.lat || event.properties?.纬度 || 0;
        
        if (!lng || !lat) return;
        
        const point = geoToCanvas(lng, lat);
        
        // 绘制事件节点图标（红色圆点）
        ctx.beginPath();
        ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#ff0000';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.stroke();
    });
}

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', () => {
    // 获取视图容器
    cityTilesView = document.getElementById('cityTilesView');
    mapDetailView = document.getElementById('mapDetailView');
    
    // 初始化Canvas
    initCanvas();
    
    // 加载数据
    loadData();
    
    // 绑定返回按钮
    const backBtn = document.getElementById('backToTilesBtn');
    if (backBtn) {
        backBtn.addEventListener('click', backToTilesView);
    }
    
    // 绑定筛选事件（仅在详细视图中使用）
    const eventTypeFilter = document.getElementById('eventTypeFilter');
    const regionFilter = document.getElementById('regionFilter');
    
    if (eventTypeFilter) {
        eventTypeFilter.addEventListener('change', () => {
            if (currentCity) {
                applyFilters();
            }
        });
    }
    
    if (regionFilter) {
        regionFilter.addEventListener('change', () => {
            if (currentCity) {
                applyFilters();
            }
        });
    }
    
    // 添加roundRect polyfill（如果浏览器不支持）
    if (!CanvasRenderingContext2D.prototype.roundRect) {
        CanvasRenderingContext2D.prototype.roundRect = function(x, y, width, height, radius) {
            this.beginPath();
            this.moveTo(x + radius, y);
            this.lineTo(x + width - radius, y);
            this.quadraticCurveTo(x + width, y, x + width, y + radius);
            this.lineTo(x + width, y + height - radius);
            this.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
            this.lineTo(x + radius, y + height);
            this.quadraticCurveTo(x, y + height, x, y + height - radius);
            this.lineTo(x, y + radius);
            this.quadraticCurveTo(x, y, x + radius, y);
            this.closePath();
        };
    }
});

        if (range.max === undefined) {
            if (count >= range.min) return range.label;
        } else {
            if (count >= range.min && count < range.max) return range.label;
        }
    }
    return COLOR_RANGES[COLOR_RANGES.length - 1].label;
}

// 显示城市详细视图
function showCityDetail(cityKey) {
    currentCity = cityKey;
    const city = WANBEI_CITIES.find(c => c.key === cityKey);
    
    // 显示地图详细视图的头部（返回按钮）
    const viewHeader = document.querySelector('.view-header');
    if (viewHeader) {
        viewHeader.style.display = 'flex';
    }
    
    // 更新城市名称
    const cityNameEl = document.getElementById('currentCityName');
    if (cityNameEl && city) {
        cityNameEl.textContent = city.fullName;
    }
    
    // 筛选该城市的事件
    filteredEvents = allEvents.filter(event => {
        const region = event.properties?.地区 || event.properties?.region || '';
        const eventLng = event.properties?.lng || event.properties?.经度;
        const eventLat = event.properties?.lat || event.properties?.纬度;
        
        // 如果事件有坐标，检查是否在该城市边界内
        if (eventLng && eventLat) {
            const cityOutline = cityOutlines[cityKey];
            if (cityOutline && cityOutline.outline) {
                return isPointInPolygon(eventLng, eventLat, cityOutline.outline.geometry);
            }
        }
        
        // 否则按地区名称匹配
        return region.includes(cityKey) || (city && region.includes(city.fullName));
    });
    
    console.log(`${cityKey}筛选后的事件数量:`, filteredEvents.length);
    console.log('筛选后的事件示例:', filteredEvents.slice(0, 3));
    
    // 重新加载边界（只加载该城市的完整features）
    loadCityBoundaries(cityKey).then(() => {
        // 重新统计（按县/镇统计）
        calculateRegionStats();
        
        console.log(`进入${cityKey}详细视图，县/镇统计:`, regionStats);
        
        // 调整视图
        adjustViewToData();
        
        // 重绘地图
        drawMap();
    });
}

// 返回六市视图
function backToTilesView() {
    currentCity = null;
    
    // 隐藏地图详细视图的头部（返回按钮）
    const viewHeader = document.querySelector('.view-header');
    if (viewHeader) {
        viewHeader.style.display = 'none';
    }
    
    // 恢复所有事件
    filteredEvents = [...allEvents];
    
    // 重新加载所有边界（只显示外边界）
    loadBoundaries().then(() => {
        calculateRegionStats();
        adjustViewToData();
        drawMap();
    });
}

// 加载单个城市的边界
async function loadCityBoundaries(cityKey) {
    boundaries = [];
    
    // 从 cityOutlines 中获取该城市的完整 features
    const cityOutline = cityOutlines[cityKey];
    if (cityOutline && cityOutline.features) {
        cityOutline.features.forEach(feature => {
            boundaries.push({
                city: cityKey,
                feature: feature,
                isOutline: false
            });
        });
        return;
    }
    
    // 如果 cityOutlines 中没有，重新加载
    try {
        const cityFiles = [
            { key: '亳州', file: 'boundaries/亳州市.json' },
            { key: '淮北', file: 'boundaries/淮北市.json' },
            { key: '阜阳', file: 'boundaries/阜阳市.json' },
            { key: '淮南', file: 'boundaries/淮南市.json' },
            { key: '宿州', file: 'boundaries/宿州市.json' },
            { key: '蚌埠', file: 'boundaries/蚌埠市.json' },
        ];
        
        const targetCity = cityFiles.find(c => c.key === cityKey);
        if (!targetCity) return;
        
        try {
            const res = await fetch(targetCity.file);
            if (!res.ok) return;
            const gj = await res.json();
            
            const features = gj.features || [];
            features.forEach(feature => {
                boundaries.push({
                    city: targetCity.key,
                    feature: feature,
                    isOutline: false
                });
            });
        } catch (e) {
            console.error(`加载${cityKey}边界失败:`, e);
        }
    } catch (error) {
        console.error('加载城市边界数据失败:', error);
    }
}

// 绘制事件节点
function drawEvents() {
    if (!filteredEvents || filteredEvents.length === 0) return;
    
    filteredEvents.forEach(event => {
        const lng = event.properties?.lng || event.properties?.经度 || 0;
        const lat = event.properties?.lat || event.properties?.纬度 || 0;
        
        if (!lng || !lat) return;
        
        const point = geoToCanvas(lng, lat);
        
        // 绘制事件节点图标（红色圆点）
        ctx.beginPath();
        ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#ff0000';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.stroke();
    });
}

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', () => {
    // 获取视图容器
    cityTilesView = document.getElementById('cityTilesView');
    mapDetailView = document.getElementById('mapDetailView');
    
    // 初始化Canvas
    initCanvas();
    
    // 加载数据
    loadData();
    
    // 绑定返回按钮
    const backBtn = document.getElementById('backToTilesBtn');
    if (backBtn) {
        backBtn.addEventListener('click', backToTilesView);
    }
    
    // 绑定筛选事件（仅在详细视图中使用）
    const eventTypeFilter = document.getElementById('eventTypeFilter');
    const regionFilter = document.getElementById('regionFilter');
    
    if (eventTypeFilter) {
        eventTypeFilter.addEventListener('change', () => {
            if (currentCity) {
                applyFilters();
            }
        });
    }
    
    if (regionFilter) {
        regionFilter.addEventListener('change', () => {
            if (currentCity) {
                applyFilters();
            }
        });
    }
    
    // 添加roundRect polyfill（如果浏览器不支持）
    if (!CanvasRenderingContext2D.prototype.roundRect) {
        CanvasRenderingContext2D.prototype.roundRect = function(x, y, width, height, radius) {
            this.beginPath();
            this.moveTo(x + radius, y);
            this.lineTo(x + width - radius, y);
            this.quadraticCurveTo(x + width, y, x + width, y + radius);
            this.lineTo(x + width, y + height - radius);
            this.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
            this.lineTo(x + radius, y + height);
            this.quadraticCurveTo(x, y + height, x, y + height - radius);
            this.lineTo(x, y + radius);
            this.quadraticCurveTo(x, y, x + radius, y);
            this.closePath();
        };
    }
});
