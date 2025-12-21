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

    // 添加底图
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 18
    }).addTo(map);

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
        const response = await fetch('data.json');
        currentData = await response.json();
        
        if (!currentData || !currentData.combined) {
            console.error('数据格式错误');
            return;
        }

        displayNodes(currentData.combined.nodes);
        updateList(currentData.combined.nodes);
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

    // 添加标记
    validNodes.forEach(node => {
        const lat = node.properties.lat || node.properties.纬度;
        const lng = node.properties.lng || node.properties.经度;
        const name = node.properties.name || node.properties.名称 || '未知';
        
        // 确定节点类型和颜色
        let color = '#3b82f6'; // 默认蓝色
        let icon = '📍';
        
        if (node.labels.some(l => l.includes('事件'))) {
            color = '#ef4444'; // 红色
            icon = '📅';
        } else if (node.labels.some(l => l.includes('人物'))) {
            color = '#f59e0b'; // 黄色
            icon = '👤';
        } else if (node.labels.some(l => l.includes('地点'))) {
            color = '#10b981'; // 绿色
            icon = '📍';
        }

        // 创建标记
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
function applyFilters() {
    if (!currentData) return;

    const eventType = document.getElementById('eventTypeFilter').value;
    const dataset = document.getElementById('datasetFilter').value;
    const city = document.getElementById('cityFilter').value;

    let filteredNodes = currentData.combined.nodes;

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
            const lat = node.properties.lat || node.properties.纬度;
            const lng = node.properties.lng || node.properties.经度;
            return lat && lng && lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;
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
    document.getElementById('eventTypeFilter').addEventListener('change', applyFilters);
    document.getElementById('datasetFilter').addEventListener('change', applyFilters);
    document.getElementById('cityFilter').addEventListener('change', applyFilters);

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
