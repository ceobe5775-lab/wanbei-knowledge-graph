// 视图切换模块

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
    console.log(`=== 切换到 ${cityKey} 详细视图 ===`);
    
    // 设置当前城市
    currentCity = cityKey;
    const city = WANBEI_CITIES.find(c => c.key === cityKey);
    
    // mapSelected 容器始终显示，不需要隐藏/显示
    
    // 返回按钮始终显示（在六市视图和详细视图都显示）
    
    // 重置筛选器
    const eventTypeFilter = document.getElementById('eventTypeFilter');
    const regionFilter = document.getElementById('regionFilter');
    if (eventTypeFilter) eventTypeFilter.value = '';
    if (regionFilter) regionFilter.value = '';
    
    // 筛选该城市的事件
    filteredEvents = allEvents.filter(event => {
        const region = event.properties?.地区 || event.properties?.region || '';
        const eventLng = event.properties?.lng || event.properties?.经度;
        const eventLat = event.properties?.lat || event.properties?.纬度;
        
        // 如果事件有坐标，检查是否在该城市边界内
        if (eventLng && eventLat) {
            const cityOutline = cityOutlines[cityKey];
            if (cityOutline && cityOutline.outline) {
                const inBounds = isPointInPolygon(eventLng, eventLat, cityOutline.outline.geometry);
                if (inBounds) return true;
            }
        }
        
        // 按地区名称匹配（排除'未知'和空）
        if (region && region !== '未知' && region.trim() !== '') {
            if (region.includes(cityKey) || (city && region.includes(city.fullName))) {
                return true;
            }
        }
        
        // 如果没有坐标和地区信息，不包含该事件
        return false;
    });
    
    // 如果筛选后没有事件，使用所有事件（数据质量问题，暂时这样处理）
    if (filteredEvents.length === 0) {
        console.warn(`${cityKey}筛选后没有事件，使用所有事件（数据质量问题）`);
        filteredEvents = [...allEvents];
    }
    
    // 清空边界数组，准备加载详细视图的边界
    boundaries = [];
    
    
    // 加载该城市的详细边界（县/区边界）
    loadCityBoundaries(cityKey).then(() => {
        // 重新统计（按县/镇统计）- 使用筛选后的事件
        calculateRegionStats();
        
        // 调整视图以适应该城市的边界
        adjustViewToData();
        
        // 重绘地图
        drawMap();
        
        // 更新UI
        updateBreadcrumb();
        updateMapSectionTitle();
        updateFilterStatus();
        updateRegionFilterOptions(); // 更新地区筛选器选项
    }).catch(error => {
        console.error(`loadCityBoundaries(${cityKey})失败:`, error);
        // 即使失败，也要更新UI
        updateBreadcrumb();
        updateMapSectionTitle();
        updateFilterStatus();
        updateRegionFilterOptions(); // 更新地区筛选器选项
    });
}

// 返回六市视图或重置视图到最佳视角
function backToTilesView() {
    console.log('=== 返回六市总览视图或重置视图 ===');
    
    // 如果当前在详细视图，返回六市视图
    if (currentCity) {
        // 先清空当前城市，确保 loadBoundaries() 知道这是初始视图
        currentCity = null;
        
        // 恢复所有事件
        filteredEvents = [...allEvents];
        
        // 重置筛选器
        const eventTypeFilter = document.getElementById('eventTypeFilter');
        const regionFilter = document.getElementById('regionFilter');
        if (eventTypeFilter) eventTypeFilter.value = '';
        if (regionFilter) regionFilter.value = '';
        
        // 清空边界数组，准备重新加载
        boundaries = [];
        
        // 重新加载所有边界（只显示外边界）
        loadBoundaries().then(() => {
            // 重新统计（按市统计）
            calculateRegionStats();
            
            // 调整视图以适应六市总览
            adjustViewToData();
            
            // 重绘地图
            drawMap();
            
            // 更新UI
            updateBreadcrumb();
            updateMapSectionTitle();
            updateFilterStatus();
            updateRegionFilterOptions(); // 更新地区筛选器选项
        });
    } else {
        // 如果已经在六市视图，重置视图到最佳视角
        adjustViewToData();
        drawMap();
    }
}
