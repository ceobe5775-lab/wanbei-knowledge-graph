// 交互式地图脚本

let map = null;
let markers = [];
let boundaries = [];
let currentData = null;

// 加载GeoJSON边界数据（使用六市行政边界组合成皖北轮廓）
let wanbeiBoundary = null;
let citiesBoundaries = {};

const cityFiles = [
    { key: '亳州', file: 'boundaries/亳州市.json' },
    { key: '淮北', file: 'boundaries/淮北市.json' },
    { key: '阜阳', file: 'boundaries/阜阳市.json' },
    { key: '淮南', file: 'boundaries/淮南市.json' },
    { key: '宿州', file: 'boundaries/宿州市.json' },
    { key: '蚌埠', file: 'boundaries/蚌埠市.json' },
];

function getFeatureBounds(geo) {
    const coords = [];

    function collect(arr) {
        if (typeof arr[0] === 'number') {
            const [lng, lat] = arr;
            coords.push({ lat, lng });
        } else {
            arr.forEach(collect);
        }
    }

    const featuresArray = geo.type === 'FeatureCollection' ? geo.features : [geo];
    (featuresArray || []).forEach(feature => {
        const geom = feature?.geometry;
        if (!geom || !geom.coordinates) return;
        collect(geom.coordinates);
    });

    if (coords.length === 0) return null;

    const lats = coords.map(c => c.lat);
    const lngs = coords.map(c => c.lng);
    return {
        minLat: Math.min(...lats),
        maxLat: Math.max(...lats),
        minLng: Math.min(...lngs),
        maxLng: Math.max(...lngs),
    };
}

async function loadBoundaries() {
    try {
        const results = await Promise.all(
            cityFiles.map(async ({ key, file }) => {
                const res = await fetch(file);
                if (!res.ok) throw new Error(`${file} 加载失败`);
                const gj = await res.json();
                return { key, gj };
            })
        );

        // 组合六市边界作为皖北整体
        wanbeiBoundary = {
            type: 'FeatureCollection',
            features: results.flatMap(r => r.gj.features || [])
        };

        // 单独存储每个市的 FeatureCollection，便于过滤/缩放
        citiesBoundaries = {};
        results.forEach(({ key, gj }) => {
            citiesBoundaries[key] = {
                type: 'FeatureCollection',
                features: gj.features || [],
                bounds: getFeatureBounds(gj)
            };
        });
    } catch (error) {
        console.error('加载边界数据失败，使用默认数据:', error);
        // 使用默认简化数据兜底
        wanbeiBoundary = {
            type: "Feature",
            properties: { name: "皖北地区" },
            geometry: {
                type: "Polygon",
                coordinates: [[
                    [115.0, 32.0], [117.5, 32.0], [118.0, 33.5], [116.5, 34.5],
                    [115.0, 34.0], [114.5, 33.0], [115.0, 32.0]
                ]]
            }
        };
        citiesBoundaries = {};
    }
}

// 初始化地图
async function initMap() {
    // 先加载边界数据
    await loadBoundaries();
    
    // 创建地图，中心点在皖北地区
    map = L.map('map').setView([33.0, 116.5], 8);

    // 添加底图（使用多个备用方案）
    // 方案1: OpenStreetMap (主方案)
    const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 18,
        errorTileUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjU2IiBoZWlnaHQ9IjI1NiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjU2IiBoZWlnaHQ9IjI1NiIgZmlsbD0iI2U1ZTdlYiIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTIiIGZpbGw9IiM5Y2EzYWYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj7lm77niYfliqDovb08L3RleHQ+PC9zdmc+',
        crossOrigin: true
    });
    
    // 方案2: CartoDB Positron (备用方案)
    const cartoLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap contributors © CARTO',
        maxZoom: 19,
        subdomains: 'abcd',
        errorTileUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjU2IiBoZWlnaHQ9IjI1NiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjU2IiBoZWlnaHQ9IjI1NiIgZmlsbD0iI2YzZjRmNiIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTIiIGZpbGw9IiM5Y2EzYWYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj7lm77niYfliqDovb08L3RleHQ+PC9zdmc+'
    });
    
    // 尝试加载OSM，如果失败则使用Carto
    let layerAdded = false;
    osmLayer.on('load', function() {
        if (!layerAdded) {
            layerAdded = true;
        }
    });
    
    osmLayer.on('tileerror', function(error, tile) {
        console.warn('OSM瓦片加载失败，尝试使用备用方案');
        if (!layerAdded) {
            map.removeLayer(osmLayer);
            cartoLayer.addTo(map);
            layerAdded = true;
        }
    });
    
    // 添加超时检测
    setTimeout(() => {
        if (!layerAdded) {
            try {
                map.removeLayer(osmLayer);
            } catch(e) {}
            cartoLayer.addTo(map);
            layerAdded = true;
        }
    }, 3000);
    
    osmLayer.addTo(map);

    // 添加皖北地区轮廓（六市合并）
    if (wanbeiBoundary) {
        L.geoJSON(wanbeiBoundary, {
            style: {
                color: '#2563eb',
                weight: 2.5,
                fillColor: '#3b82f6',
                fillOpacity: 0.08
            }
        }).addTo(map).bindPopup('皖北地区');
    }

    // 添加六个市的轮廓（市线条更粗）
    Object.entries(citiesBoundaries).forEach(([name, fc]) => {
        if (fc && fc.features) {
            fc.features.forEach(feature => {
                const props = feature.properties || {};
                const isCity = props.type === 'city' || props.级别 === '市';
                const isCounty = props.type === 'county' || props.级别 === '县';
                
                // 根据级别设置线条粗细：市2.5，县1.0
                let lineWeight = 1.5; // 默认
                let lineColor = '#10b981';
                
                if (isCity) {
                    lineWeight = 2.5; // 市线条更粗
                    lineColor = '#2563eb';
                } else if (isCounty) {
                    lineWeight = 1.0; // 县线条更细
                    lineColor = '#10b981';
                }
                
                L.geoJSON(feature, {
                    style: {
                        color: lineColor,
                        weight: lineWeight,
                        fillColor: isCity ? '#2563eb' : '#10b981',
                        fillOpacity: isCity ? 0.06 : 0.04
                    }
                }).addTo(map).bindPopup(`${name}${isCounty ? '县' : '市'}`);
            });
        }
    });

    // 根据整体区域调整视图
    const regionBounds = wanbeiBoundary ? getFeatureBounds(wanbeiBoundary) : null;
    if (regionBounds) {
        map.fitBounds([
            [regionBounds.minLat, regionBounds.minLng],
            [regionBounds.maxLat, regionBounds.maxLng]
        ], { padding: [20, 20] });
    }
}

// 加载并显示数据
async function loadAndDisplayData() {
    try {
        // 优先使用 data-loader.js 提供的数据
        let events = [];
        let nodes = [];
        
        // 直接加载 data.json（不使用normalizedData，因为它可能还没有准备好）
        const response = await fetch('data.json');
        currentData = await response.json();
        
        if (!currentData || !currentData.combined) {
            console.error('数据格式错误');
            return;
        }
        
        // 加载所有类型的节点：事件、人物、地点
        nodes = [];
        
        // 加载事件
        if (currentData.combined.events && currentData.combined.events.length > 0) {
            nodes = nodes.concat(currentData.combined.events);
            console.log('map-interactive: 加载事件', currentData.combined.events.length);
        }
        
        // 加载人物
        if (currentData.combined.persons && currentData.combined.persons.length > 0) {
            nodes = nodes.concat(currentData.combined.persons);
            console.log('map-interactive: 加载人物', currentData.combined.persons.length);
        }
        
        // 加载地点
        if (currentData.combined.locations && currentData.combined.locations.length > 0) {
            nodes = nodes.concat(currentData.combined.locations);
            console.log('map-interactive: 加载地点', currentData.combined.locations.length);
        }
        
        console.log('map-interactive: 总共加载节点数', nodes.length);
        
        displayNodes(nodes);
        updateList(nodes);
    } catch (error) {
        console.error('加载数据失败:', error);
    }
}

// 显示节点
function displayNodes(nodes) {
    // 清除现有标记
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];

    // 过滤有效坐标的节点
    const validNodes = nodes.filter(node => {
        const lat = node.properties.lat || node.properties.纬度;
        const lng = node.properties.lng || node.properties.经度;
        return lat && lng && !isNaN(lat) && !isNaN(lng);
    });

    // 按照类型分类节点：事件、人物、地点
    const events = [];
    const persons = [];
    const locations = [];
    
    validNodes.forEach(node => {
        if (node.labels && node.labels.some(l => l.includes('事件'))) {
            events.push(node);
        } else if (node.labels && node.labels.some(l => l.includes('人物'))) {
            persons.push(node);
        } else if (node.labels && node.labels.some(l => l.includes('地点'))) {
            locations.push(node);
        }
    });

    // 按照顺序添加标记：先地点（底层），再人物（中层），最后事件（顶层）
    // 使用数组存储，按照添加顺序确定层级
    const nodesToDisplay = [...locations, ...persons, ...events];

    // 添加标记
    nodesToDisplay.forEach((node, index) => {
        const lat = node.properties.lat || node.properties.纬度;
        const lng = node.properties.lng || node.properties.经度;
        const name = node.properties.name || node.properties.名称 || '未知';
        
        // 确定节点类型和颜色
        let color = '#3b82f6'; // 默认蓝色
        let icon = '📍';
        
        if (node.labels && node.labels.some(l => l.includes('事件'))) {
            color = '#ef4444'; // 红色
            icon = '📅';
        } else if (node.labels && node.labels.some(l => l.includes('人物'))) {
            color = '#f59e0b'; // 黄色
            icon = '👤';
        } else if (node.labels && node.labels.some(l => l.includes('地点'))) {
            color = '#10b981'; // 绿色
            icon = '📍';
        }

        // 创建标记
        // 注意：按照nodesToDisplay的顺序添加（地点->人物->事件），
        // 后添加的标记会在上层，所以事件节点会在最上层
        const marker = L.circleMarker([lat, lng], {
            radius: 8,
            fillColor: color,
            color: '#fff',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.8
        }).addTo(map);

        // 添加弹出窗口
        const popupContent = `
            <div style="min-width: 200px;">
                <h4 style="margin: 0 0 10px 0; color: ${color};">${icon} ${name}</h4>
                <p style="margin: 5px 0;"><strong>类型:</strong> ${node.labels.join(', ')}</p>
                ${node.properties.时间 ? `<p style="margin: 5px 0;"><strong>时间:</strong> ${node.properties.时间}</p>` : ''}
                ${node.properties.描述 ? `<p style="margin: 5px 0;"><strong>描述:</strong> ${node.properties.描述}</p>` : ''}
                <p style="margin: 5px 0; font-size: 0.9em; color: #666;">坐标: ${lat.toFixed(4)}, ${lng.toFixed(4)}</p>
            </div>
        `;
        marker.bindPopup(popupContent);

        markers.push(marker);
    });

    // 如果有标记，调整地图视图
    if (markers.length > 0) {
        const group = new L.featureGroup(markers);
        map.fitBounds(group.getBounds().pad(0.1));
    }
}

// 更新列表视图
function updateList(nodes) {
    const listContainer = document.getElementById('mapList');
    if (!listContainer) return;

    listContainer.innerHTML = '';

    const validNodes = nodes.filter(node => {
        const lat = node.properties.lat || node.properties.纬度;
        const lng = node.properties.lng || node.properties.经度;
        return lat && lng;
    });

    validNodes.forEach(node => {
        const name = node.properties.name || node.properties.名称 || '未知';
        const lat = node.properties.lat || node.properties.纬度;
        const lng = node.properties.lng || node.properties.经度;
        const desc = node.properties.描述 || node.properties.description || '';

        const item = document.createElement('div');
        item.className = 'list-item';
        item.innerHTML = `
            <div class="item-icon">📍</div>
            <div class="item-content">
                <h3>${name}</h3>
                <p>${desc || `坐标: ${lat.toFixed(4)}, ${lng.toFixed(4)}`}</p>
                <div class="item-tags">
                    ${node.labels.map(label => `<span class="tag">${label}</span>`).join('')}
                </div>
            </div>
            <a href="mapDetail.html?id=${node.id}" class="item-link">查看详情 →</a>
        `;
        listContainer.appendChild(item);
    });
}

// 筛选功能
function applyMapFilters() {
    // 获取当前显示的所有节点
    let allNodes = [];
    
    // 优先使用标准化数据
    if (window.normalizedData && window.normalizedData.events && window.normalizedData.events.length > 0) {
        allNodes = window.normalizedData.events;
    } else if (currentData && currentData.combined) {
        // 优先使用 combined.events
        if (currentData.combined.events && currentData.combined.events.length > 0) {
            allNodes = currentData.combined.events;
        } else if (currentData.combined.nodes) {
            allNodes = currentData.combined.nodes;
        }
    }
    
    if (allNodes.length === 0) {
        console.warn('applyMapFilters: 没有可筛选的节点');
        return;
    }

    const eventType = document.getElementById('eventTypeFilter').value;
    const dataset = document.getElementById('datasetFilter').value;
    const city = document.getElementById('cityFilter').value;

    let filteredNodes = allNodes;

    // 按数据集筛选
    if (dataset !== 'all') {
        filteredNodes = filteredNodes.filter(node => 
            node.properties.data_source && node.properties.data_source.includes(dataset)
        );
    }

    // 按类型筛选
    if (eventType !== 'all') {
        filteredNodes = filteredNodes.filter(node => {
            if (eventType === 'event') return node.labels.some(l => l.includes('事件'));
            if (eventType === 'person') return node.labels.some(l => l.includes('人物'));
            if (eventType === 'location') return node.labels.some(l => l.includes('地点'));
            return true;
        });
    }

    // 按城市筛选（根据六市 GeoJSON 边界的包围盒）
    if (city !== 'all' && citiesBoundaries[city] && citiesBoundaries[city].bounds) {
        const { minLat, maxLat, minLng, maxLng } = citiesBoundaries[city].bounds;
        filteredNodes = filteredNodes.filter(node => {
            const lat = parseFloat(node.properties?.lat || node.properties?.纬度);
            const lng = parseFloat(node.properties?.lng || node.properties?.经度);
            if (isNaN(lat) || isNaN(lng)) return false;
            return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;
        });
    }

    displayNodes(filteredNodes);
    updateList(filteredNodes);
}

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', async () => {
    await initMap();
    await loadAndDisplayData();

    // 绑定筛选事件
    const eventTypeFilter = document.getElementById('eventTypeFilter');
    const datasetFilter = document.getElementById('datasetFilter');
    const cityFilter = document.getElementById('cityFilter');
    
    if (eventTypeFilter) eventTypeFilter.addEventListener('change', applyMapFilters);
    if (datasetFilter) datasetFilter.addEventListener('change', applyMapFilters);
    if (cityFilter) cityFilter.addEventListener('change', applyMapFilters);

    // 绑定视图切换
    document.getElementById('mapViewBtn').addEventListener('click', () => {
        document.getElementById('mapContainer').style.display = 'block';
        document.getElementById('mapList').style.display = 'none';
        document.getElementById('mapViewBtn').classList.add('active');
        document.getElementById('listViewBtn').classList.remove('active');
    });

    document.getElementById('listViewBtn').addEventListener('click', () => {
        document.getElementById('mapContainer').style.display = 'none';
        document.getElementById('mapList').style.display = 'grid';
        document.getElementById('listViewBtn').classList.add('active');
        document.getElementById('mapViewBtn').classList.remove('active');
    });
});