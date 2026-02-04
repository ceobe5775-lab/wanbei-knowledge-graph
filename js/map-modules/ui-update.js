// UI更新模块

function updateFilterStatus() {
    const statusEl = document.getElementById('filterStatusContent');
    if (!statusEl) return;
    
    const eventType = document.getElementById('eventTypeFilter')?.value || '';
    const region = document.getElementById('regionFilter')?.value || '';
    
    let statusText = '';
    
    // 事件类型
    if (eventType && eventType !== '') {
        statusText += `事件类型=${eventType}`;
    } else {
        statusText += '事件类型=全部';
    }
    
    // 地区
    if (currentCity) {
        const city = WANBEI_CITIES.find(c => c.key === currentCity);
        statusText += `；地区=${city ? city.fullName : currentCity}`;
    } else if (region && region !== '') {
        statusText += `；地区=${region}`;
    } else {
        statusText += '；地区=全部';
    }
    
    // 样本量
    const count = filteredEvents ? filteredEvents.length : allEvents.length;
    statusText += `；样本量=${count}件`;
    
    statusEl.textContent = statusText;
}

// 更新面包屑导航（已删除该元素，保留函数以避免错误）
function updateBreadcrumb() {
    // 元素已删除，无需更新
}

// 更新地区筛选器的选项
function updateRegionFilterOptions() {
    const regionFilter = document.getElementById('regionFilter');
    if (!regionFilter) return;
    
    // 清空现有选项（保留第一个"选择地区"选项）
    const firstOption = regionFilter.querySelector('option[value=""]');
    regionFilter.innerHTML = '';
    if (firstOption) {
        regionFilter.appendChild(firstOption);
    } else {
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = '选择地区';
        regionFilter.appendChild(defaultOption);
    }
    
    if (!currentCity) {
        // 六市总览视图：显示六个市
        const allOption = document.createElement('option');
        allOption.value = '全部地区';
        allOption.textContent = '全部地区';
        regionFilter.appendChild(allOption);
        
        WANBEI_CITIES.forEach(city => {
            const option = document.createElement('option');
            option.value = city.fullName;
            option.textContent = city.fullName;
            regionFilter.appendChild(option);
        });
    } else {
        // 详细视图：显示该市的区县
        const allOption = document.createElement('option');
        allOption.value = '全部地区';
        allOption.textContent = '全部地区';
        regionFilter.appendChild(allOption);
        
        // 从 boundaries 中获取区县名称
        const regionNames = new Set();
        boundaries.forEach(boundary => {
            const props = boundary.feature.properties || {};
            const name = props.name || props.名称 || '';
            if (name && !name.endsWith('市') && name !== '') {
                // 移除可能的"市"后缀（如"亳州市" -> "亳州"）
                const cleanName = name.replace('市', '');
                if (cleanName) {
                    regionNames.add(cleanName);
                }
            }
        });
        
        // 如果 boundaries 中没有区县数据，尝试从 cityOutlines 获取
        if (regionNames.size === 0) {
            const cityOutline = cityOutlines[currentCity];
            if (cityOutline && cityOutline.countyFeatures) {
                cityOutline.countyFeatures.forEach(feature => {
                    const props = feature.properties || {};
                    const name = props.name || props.名称 || '';
                    if (name && !name.endsWith('市') && name !== '') {
                        const cleanName = name.replace('市', '');
                        if (cleanName) {
                            regionNames.add(cleanName);
                        }
                    }
                });
            }
        }
        
        // 按字母顺序排序并添加到选项
        Array.from(regionNames).sort().forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            regionFilter.appendChild(option);
        });
        
        // 如果没有找到区县，至少显示当前城市
        if (regionNames.size === 0) {
            const city = WANBEI_CITIES.find(c => c.key === currentCity);
            if (city) {
                const option = document.createElement('option');
                option.value = city.fullName;
                option.textContent = city.fullName;
                regionFilter.appendChild(option);
            }
        }
    }
}

// 更新地图区域标题（已删除该元素，保留函数以避免错误）
function updateMapSectionTitle() {
    // 元素已删除，无需更新
}

// 重置筛选
function resetFilters() {
    const eventTypeFilter = document.getElementById('eventTypeFilter');
    const regionFilter = document.getElementById('regionFilter');
    
    if (eventTypeFilter) eventTypeFilter.value = '';
    if (regionFilter) regionFilter.value = '';
    
    // 如果在详细视图，重新应用筛选
    if (currentCity) {
        applyFilters();
    } else {
        // 在总览视图，重新加载所有事件
        filteredEvents = allEvents;
        calculateRegionStats();
        drawMap();
    }
    
    updateFilterStatus();
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
    
    // 更新筛选状态
    updateFilterStatus();
}

