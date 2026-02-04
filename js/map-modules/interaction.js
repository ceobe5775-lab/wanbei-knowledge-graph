// 用户交互模块

// 移除之前的节流函数，使用drawing.js中的全局节流
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
        showEventsPanel(stats.events, cityKey);
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
