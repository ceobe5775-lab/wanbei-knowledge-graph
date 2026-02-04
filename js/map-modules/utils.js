// 工具函数模块

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
    
    // 使用边界框创建外边界
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










































































