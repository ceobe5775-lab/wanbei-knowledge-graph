// 数据加载模块

// 加载数据
async function loadData() {
    try {
        // map-canvas模块始终直接从data.json加载，不使用normalizedData
        // 因为normalizedData可能还没有准备好，或者数据格式可能有问题
        let events = [];
        
        // 直接加载 data.json
        const response = await fetch('data.json');
        const data = await response.json();
        
        if (!data || !data.combined) {
            console.error('数据格式错误');
            return;
        }
        
        // 优先使用 combined.events，如果没有则从 nodes 中筛选
        if (data.combined.events && data.combined.events.length > 0) {
            events = data.combined.events;
            console.log('=== map-canvas 事件数据加载 ===');
            console.log('数据源: combined.events');
            console.log('加载的事件总数:', events.length);
        } else if (data.combined.nodes) {
            events = data.combined.nodes.filter(n => 
                n.labels && n.labels.some(l => l.includes('事件'))
            );
            console.log('=== map-canvas 事件数据加载 ===');
            console.log('数据源: 从 nodes 筛选');
            console.log('加载的事件总数:', events.length);
        }
        
        if (events.length === 0) {
            console.warn('map-canvas: 未找到事件数据');
            return;
        }
        
        // 转换事件格式（如果需要）
        allEvents = events.map(event => {
            // 如果事件已经有 properties，直接使用
            if (event.properties) {
                return event;
            }
            // 否则创建一个带有 properties 的对象
            return {
                id: event.id,
                labels: event.labels || ['事件'],
                properties: event.properties || {}
            };
        });
        
        console.log('事件示例:', allEvents.slice(0, 5));
        console.log('事件地区分布:', allEvents.map(e => e.properties?.地区 || e.properties?.region || '未知').slice(0, 10));
        
        // 检查事件坐标 - 添加详细调试
        if (allEvents.length > 0) {
            const sampleEvent = allEvents[0];
            console.log('第一个事件的详细结构:', {
                id: sampleEvent.id,
                hasProperties: !!sampleEvent.properties,
                propertiesKeys: sampleEvent.properties ? Object.keys(sampleEvent.properties).slice(0, 20) : [],
                lngValue: sampleEvent.properties?.lng,
                latValue: sampleEvent.properties?.lat,
                lngType: typeof sampleEvent.properties?.lng,
                latType: typeof sampleEvent.properties?.lat,
                fullProperties: sampleEvent.properties
            });
        }
        
        const eventsWithCoords = allEvents.filter(e => {
            const props = e.properties || {};
            const lng = props.lng || props.经度 || props.longitude;
            const lat = props.lat || props.纬度 || props.latitude;
            const lngNum = lng !== null && lng !== undefined ? parseFloat(lng) : NaN;
            const latNum = lat !== null && lat !== undefined ? parseFloat(lat) : NaN;
            const hasCoords = !isNaN(lngNum) && !isNaN(latNum) && lngNum !== 0 && latNum !== 0;
            return hasCoords;
        });
        console.log(`事件坐标统计: 总数=${allEvents.length}, 有坐标=${eventsWithCoords.length}, 无坐标=${allEvents.length - eventsWithCoords.length}`);
        if (eventsWithCoords.length > 0) {
            const sample = eventsWithCoords[0];
            console.log('有坐标的事件示例:', {
                id: sample.properties?.id,
                name: sample.properties?.名称,
                lng: sample.properties?.lng || sample.properties?.经度,
                lat: sample.properties?.lat || sample.properties?.纬度
            });
        } else if (allEvents.length > 0) {
            // 如果没有事件有坐标，显示前几个事件的坐标字段
            console.warn('所有事件都没有坐标，前3个事件的坐标字段值:', allEvents.slice(0, 3).map(e => ({
                id: e.properties?.id || e.id,
                name: e.properties?.名称,
                lng: e.properties?.lng,
                lat: e.properties?.lat,
                经度: e.properties?.经度,
                纬度: e.properties?.纬度
            })));
        }
        
        filteredEvents = [...allEvents];
        
        // 加载边界数据（所有城市）
        await loadBoundaries();
        
        // 统计区域数据
        calculateRegionStats();
        
        // 调整视图以适应数据范围
        adjustViewToData();
        
        // 绘制地图（初始显示6个市的外边界）
        drawMap();
        
        // 更新UI状态
        updateFilterStatus();
        updateBreadcrumb();
        updateMapSectionTitle();
        updateRegionFilterOptions(); // 更新地区筛选器选项
    } catch (error) {
        console.error('加载数据失败:', error);
    }
}

// 注意：calculateCityOutline 和 createMergedCityBoundary 已在 utils.js 中定义

// 加载边界数据（仅用于初始视图：六市总览）
async function loadBoundaries() {
    // 如果当前在详细视图，不应该调用此函数
    if (currentCity) {
        console.warn('loadBoundaries() 不应该在详细视图中调用，当前城市:', currentCity);
        return Promise.resolve();
    }
    
    boundaries = [];
    // 注意：不要清空 cityOutlines，因为详细视图可能需要使用缓存的数据
    
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
            // 注意：loadBoundaries() 只在初始视图时调用，所以这里不需要检查 currentCity
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
                level: f.properties?.level,
                isCityBoundary: f.properties?.isCityBoundary
            })));
            
            let addedCount = 0;
            let skippedCount = 0;
            
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
                    addedCount++;
                    console.log(`  ✓ 添加县/区边界: ${name} (adcode=${adcode}, level=${props.level || level})`);
                } else {
                    skippedCount++;
                    console.log(`  ✗ 跳过市边界: ${name} (adcode=${adcode}, isRealCityBoundary=${isRealCityBoundary})`);
                }
            });
            
            console.log(`✓ 详细边界加载完成: 添加了${addedCount}个县/区边界，跳过了${skippedCount}个市边界，总共${boundaries.length}个边界`);
            
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
