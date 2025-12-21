// ECharts地图显示脚本 - 使用zrender底层渲染

let echartsMap = null;
let allEvents = [];
let filteredEvents = [];
let regionStats = {};
let currentCity = null;
let cityTilesView = null;
let mapDetailView = null;

// 皖北六市配置
const WANBEI_CITIES = [
    { key: '阜阳', name: '阜阳市', fullName: '阜阳市' },
    { key: '亳州', name: '亳州市', fullName: '亳州市' },
    { key: '淮北', name: '淮北市', fullName: '淮北市' },
    { key: '宿州', name: '宿州市', fullName: '宿州市' },
    { key: '蚌埠', name: '蚌埠市', fullName: '蚌埠市' },
    { key: '淮南', name: '淮南市', fullName: '淮南市' }
];

// 颜色配置
const COLOR_RANGES = [
    { min: 150, color: '#FFD700', label: '150件以上' },
    { min: 120, max: 150, color: '#FFA500', label: '120-150件' },
    { min: 90, max: 120, color: '#FF6347', label: '90-120件' },
    { min: 60, max: 90, color: '#FF69B4', label: '60-90件' },
    { min: 30, max: 60, color: '#9370DB', label: '30-60件' },
    { min: 0, max: 30, color: '#87CEEB', label: '30件以下' }
];

// 根据事件数量获取颜色
function getColorByCount(count) {
    for (const range of COLOR_RANGES) {
        if (range.max === undefined) {
            if (count >= range.min) return range.color;
        } else {
            if (count >= range.min && count < range.max) return range.color;
        }
    }
    return COLOR_RANGES[COLOR_RANGES.length - 1].color;
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

// 统计各区域的事件数量
function calculateRegionStats() {
    regionStats = {};
    
    // 初始化所有城市
    WANBEI_CITIES.forEach(city => {
        regionStats[city.key] = {
            count: 0,
            events: [],
            name: city.name,
            fullName: city.fullName
        };
    });
    
    // 统计事件
    filteredEvents.forEach(event => {
        const region = event.properties?.地区 || event.properties?.region || '';
        
        // 匹配城市
        WANBEI_CITIES.forEach(city => {
            if (region.includes(city.key) || region.includes(city.fullName)) {
                regionStats[city.key].count++;
                regionStats[city.key].events.push(event);
            }
        });
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
        
        console.log('加载的事件数量:', allEvents.length);
        
        filteredEvents = [...allEvents];
        
        // 统计区域数据
        calculateRegionStats();
        
        // 渲染六市图块
        renderCityTiles();
    } catch (error) {
        console.error('加载数据失败:', error);
    }
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
        
        tile.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-8px) scale(1.02)';
        });
        
        tile.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0) scale(1)';
        });
        
        tile.addEventListener('click', function() {
            const cityKey = this.dataset.cityKey;
            showCityDetail(cityKey);
        });
        
        grid.appendChild(tile);
    });
}

// 显示城市详细视图
function showCityDetail(cityKey) {
    currentCity = cityKey;
    const city = WANBEI_CITIES.find(c => c.key === cityKey);
    
    // 隐藏六市图块视图
    if (cityTilesView) {
        cityTilesView.style.display = 'none';
    }
    
    // 显示地图详细视图
    if (mapDetailView) {
        mapDetailView.style.display = 'block';
    }
    
    // 更新城市名称
    const cityNameEl = document.getElementById('currentCityName');
    if (cityNameEl && city) {
        cityNameEl.textContent = city.fullName;
    }
    
    // 筛选该城市的事件
    filteredEvents = allEvents.filter(event => {
        const region = event.properties?.地区 || event.properties?.region || '';
        return region.includes(cityKey) || (city && region.includes(city.fullName));
    });
    
    console.log(`${cityKey}的事件数量:`, filteredEvents.length);
    
    // 重新统计
    calculateRegionStats();
    
    // 初始化ECharts地图
    initEChartsMap();
}

// 初始化ECharts地图
function initEChartsMap() {
    const mapContainer = document.getElementById('echartsMap');
    if (!mapContainer) return;
    
    // 销毁旧实例
    if (echartsMap) {
        echartsMap.dispose();
    }
    
    // 创建新实例
    echartsMap = echarts.init(mapContainer);
    
    // 加载GeoJSON数据并注册地图
    loadAndRegisterMap().then(() => {
        renderEChartsMap();
    });
}

// 加载并注册地图
async function loadAndRegisterMap() {
    if (!currentCity) return;
    
    try {
        const cityFiles = {
            '亳州': 'boundaries/亳州市.json',
            '淮北': 'boundaries/淮北市.json',
            '阜阳': 'boundaries/阜阳市.json',
            '淮南': 'boundaries/淮南市.json',
            '宿州': 'boundaries/宿州市.json',
            '蚌埠': 'boundaries/蚌埠市.json'
        };
        
        const file = cityFiles[currentCity];
        if (!file) return;
        
        const response = await fetch(file);
        if (!response.ok) {
            console.error('加载地图数据失败');
            return;
        }
        
        const geoJson = await response.json();
        
        // 注册地图
        echarts.registerMap(currentCity, geoJson);
        
    } catch (error) {
        console.error('加载地图数据失败:', error);
    }
}

// 渲染ECharts地图
function renderEChartsMap() {
    if (!echartsMap || !currentCity) return;
    
    // 准备数据
    const mapData = [];
    const cityStats = regionStats[currentCity] || { count: 0 };
    
    // 如果有子区域数据，可以在这里添加
    // 目前只显示整个城市的数据
    
    const option = {
        backgroundColor: 'transparent',
        tooltip: {
            trigger: 'item',
            formatter: function(params) {
                if (params.data) {
                    return `${params.name}<br/>事件数量: ${params.value}件`;
                }
                return `${params.name}<br/>事件数量: ${cityStats.count}件`;
            }
        },
        visualMap: {
            min: 0,
            max: 200,
            left: 'left',
            top: 'bottom',
            text: ['高', '低'],
            calculable: true,
            inRange: {
                color: ['#87CEEB', '#9370DB', '#FF69B4', '#FF6347', '#FFA500', '#FFD700']
            },
            textStyle: {
                color: '#333'
            }
        },
        series: [
            {
                name: '事件数量',
                type: 'map',
                map: currentCity,
                roam: true,
                label: {
                    show: true,
                    fontSize: 12,
                    fontWeight: 'bold',
                    color: '#333'
                },
                emphasis: {
                    label: {
                        show: true,
                        fontSize: 14,
                        fontWeight: 'bold'
                    },
                    itemStyle: {
                        areaColor: '#ffd700'
                    }
                },
                data: [
                    {
                        name: currentCity,
                        value: cityStats.count
                    }
                ],
                itemStyle: {
                    areaColor: getColorByCount(cityStats.count),
                    borderColor: '#fff',
                    borderWidth: 2
                }
            },
            {
                name: '事件分布',
                type: 'scatter',
                coordinateSystem: 'geo',
                data: filteredEvents.map(event => {
                    const lng = event.properties?.lng || event.properties?.经度;
                    const lat = event.properties?.lat || event.properties?.纬度;
                    const name = event.properties?.事件名称 || event.properties?.name || '事件';
                    
                    if (lng && lat) {
                        return {
                            name: name,
                            value: [lng, lat, 1]
                        };
                    }
                    return null;
                }).filter(item => item !== null),
                symbolSize: 8,
                itemStyle: {
                    color: '#ef4444',
                    shadowBlur: 10,
                    shadowColor: 'rgba(239, 68, 68, 0.5)'
                },
                emphasis: {
                    itemStyle: {
                        color: '#dc2626'
                    }
                }
            }
        ]
    };
    
    echartsMap.setOption(option);
    
    // 添加点击事件
    echartsMap.on('click', function(params) {
        if (params.componentType === 'series') {
            if (params.seriesType === 'scatter') {
                // 点击事件点
                const eventName = params.name;
                alert(`事件: ${eventName}`);
            } else if (params.seriesType === 'map') {
                // 点击地图区域
                const stats = regionStats[currentCity] || { count: 0, events: [] };
                if (stats.events.length > 0) {
                    const eventList = stats.events.slice(0, 10).map(e => 
                        e.properties?.事件名称 || e.properties?.name || '未知事件'
                    ).join('\n');
                    const more = stats.events.length > 10 ? `\n...还有${stats.events.length - 10}个事件` : '';
                    alert(`${currentCity} (${stats.count}件事件)\n\n${eventList}${more}`);
                }
            }
        }
    });
}

// 返回六市视图
function backToTilesView() {
    currentCity = null;
    
    if (cityTilesView) {
        cityTilesView.style.display = 'block';
    }
    
    if (mapDetailView) {
        mapDetailView.style.display = 'none';
    }
    
    filteredEvents = [...allEvents];
    calculateRegionStats();
    renderCityTiles();
    
    if (echartsMap) {
        echartsMap.dispose();
        echartsMap = null;
    }
}

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', () => {
    cityTilesView = document.getElementById('cityTilesView');
    mapDetailView = document.getElementById('mapDetailView');
    
    // 加载数据
    loadData();
    
    // 绑定返回按钮
    const backBtn = document.getElementById('backToTilesBtn');
    if (backBtn) {
        backBtn.addEventListener('click', backToTilesView);
    }
    
    // 窗口大小改变时调整地图
    window.addEventListener('resize', () => {
        if (echartsMap) {
            echartsMap.resize();
        }
    });
});





























