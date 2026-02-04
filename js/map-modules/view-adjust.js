// 视图调整模块

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
    const canvasMinSize = Math.min(canvas.width, canvas.height);
    const maxRange = Math.max(adjustedLngRange, adjustedLatRange);
    
    // 计算缩放：确保最大范围能完全显示在Canvas中
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










































































