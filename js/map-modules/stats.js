// 统计模块

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
        if (!cityOutline) {
            console.warn(`cityOutlines[${currentCity}]不存在`);
            return;
        }
        
        // 使用 boundaries 数组中的 features（详细视图中已经加载的县/区边界）
        // 优先使用 countyFeatures，如果没有则使用 boundaries
        let features = cityOutline.countyFeatures;
        if (!features || features.length === 0) {
            features = boundaries.map(b => b.feature).filter(f => f);
        }
        
        if (!features || features.length === 0) {
            console.warn(`cityOutlines[${currentCity}]没有features数据`);
            return;
        }
        
        // 为每个县/镇创建统计
        features.forEach(feature => {
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
        // 注意：使用 filteredEvents（已在 view-switch.js 中筛选为该城市的事件）
        filteredEvents.forEach(event => {
            const eventLng = event.properties?.lng || event.properties?.经度;
            const eventLat = event.properties?.lat || event.properties?.纬度;
            const region = event.properties?.地区 || event.properties?.region || '';
            
            let matchedFeature = null;
            let matchedRegionKey = null;
            
            // 检查事件属于哪个县/镇
            for (const feature of features) {
                const props = feature.properties || {};
                const regionName = props.name || props.名称 || '未知区域';
                const regionKey = regionName.replace('市', '').replace('县', '').replace('区', '');
                
                let matched = false;
                
                // 如果事件有坐标，检查是否在该县/镇边界内
                if (eventLng && eventLat) {
                    matched = isPointInPolygon(eventLng, eventLat, feature.geometry);
                }
                
                // 如果没有坐标，按地区名称匹配
                if (!matched && region && region !== '未知' && region.trim() !== '') {
                    matched = region.includes(regionName) || region.includes(regionKey);
                }
                
                if (matched) {
                    matchedFeature = feature;
                    matchedRegionKey = regionKey;
                    break; // 找到匹配的县/镇后跳出循环
                }
            }
            
            // 如果找到了匹配的县/镇，添加到统计中
            if (matchedRegionKey) {
                if (!regionStats[matchedRegionKey]) {
                    const props = matchedFeature.properties || {};
                    const regionName = props.name || props.名称 || '未知区域';
                    regionStats[matchedRegionKey] = {
                        count: 0,
                        events: [],
                        name: regionName,
                        fullName: regionName
                    };
                }
                regionStats[matchedRegionKey].count++;
                regionStats[matchedRegionKey].events.push(event);
            }
        });
    }
}

























