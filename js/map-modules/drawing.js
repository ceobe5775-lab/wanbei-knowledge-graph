// 绘制模块

// 节流绘制函数 - 使用 requestAnimationFrame 节流
let drawMapPending = false;
let drawMapTimer = null;

// 绘制地图（带节流）
function drawMap() {
    if (!ctx) {
        console.error('Canvas context 未初始化');
        return;
    }
    
    if (!canvas || canvas.width === 0 || canvas.height === 0) {
        console.error('Canvas 尺寸无效:', { width: canvas?.width, height: canvas?.height });
        return;
    }
    
    // 如果已经有待处理的绘制请求，取消之前的请求并重新调度
    if (drawMapPending) {
        if (drawMapTimer) {
            cancelAnimationFrame(drawMapTimer);
        }
    }
    
    drawMapPending = true;
    
    drawMapTimer = requestAnimationFrame(() => {
        drawMapPending = false;
        drawMapTimer = null;
        _drawMapImpl();
    });
}

// 实际绘制函数
function _drawMapImpl() {
    
    // 清空画布
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 绘制背景（白色）
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // 绘制区域（带颜色填充）- 只在详细视图时填充
    if (currentCity) {
        drawRegions();
    }
    
    // 绘制边界线条
    drawBoundaries();
    
    // 绘制区域标签
    drawRegionLabels();
    
    // 绘制事件节点
    drawEvents();
}

// 绘制区域（根据事件数量填充颜色）
function drawRegions() {
    if (!boundaries || boundaries.length === 0) return;
    
    boundaries.forEach(boundary => {
        const feature = boundary.feature;
        const props = feature.properties || {};
        const cityName = boundary.city || props.name || '';
        const cityKey = cityName.replace('市', '').replace('县', '');
        
        // 获取该区域的事件数量
        const stats = regionStats[cityKey] || { count: 0 };
        const color = getColorByCount(stats.count);
        
        // 绘制填充区域
        ctx.fillStyle = color;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        
        const coords = feature.geometry.coordinates;
        
        if (feature.geometry.type === 'Polygon') {
            drawFilledPolygon(coords[0], color);
        } else if (feature.geometry.type === 'MultiPolygon') {
            coords.forEach(polygon => {
                drawFilledPolygon(polygon[0], color);
            });
        }
        
        // 存储区域信息用于交互
        feature._cityKey = cityKey;
        feature._stats = stats;
    });
}

// 绘制填充的多边形
function drawFilledPolygon(coords, fillColor) {
    if (!coords || coords.length === 0) return;
    
    ctx.beginPath();
    const firstPoint = geoToCanvas(coords[0][0], coords[0][1]);
    ctx.moveTo(firstPoint.x, firstPoint.y);
    
    for (let i = 1; i < coords.length; i++) {
        const point = geoToCanvas(coords[i][0], coords[i][1]);
        ctx.lineTo(point.x, point.y);
    }
    
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.stroke();
}

// 绘制边界（市和县区分粗细）
function drawBoundaries() {
    if (!boundaries || boundaries.length === 0) {
        console.warn('没有边界数据可绘制');
        return;
    }
    
    let drawnCount = 0;
    let skippedCount = 0;
    
    boundaries.forEach(boundary => {
        const feature = boundary.feature;
        const props = feature.properties || {};
        const isOutline = boundary.isOutline; // 是否是外边界
        const isCity = props.type === 'city' || props.级别 === '市' || (isOutline && !currentCity);
        const isCounty = props.type === 'county' || props.级别 === '县' || props.级别 === '区' || props.level === 'district';
        
        // 初始视图：只绘制市边界，不绘制县/镇边界
        // 确保只绘制标记为isOutline的市边界，不绘制任何内部边界
        if (!currentCity) {
            // 初始视图：只绘制市的外边界（isOutline为true的feature）
            if (!isOutline) {
                skippedCount++;
                return; // 跳过所有非市边界的features
            }
        }
        
        // 详细视图：只绘制县/区边界，不绘制市边界
        if (currentCity && isOutline) {
            skippedCount++;
            return; // 跳过市边界
        }
        
        drawnCount++;
        
        // 获取统计信息
        let stats;
        if (!currentCity) {
            // 初始视图：使用市的统计
            const cityKey = boundary.city;
            stats = regionStats[cityKey] || { count: 0 };
        } else {
            // 详细视图：使用县/镇的统计
            const regionName = props.name || props.名称 || '未知区域';
            const regionKey = regionName.replace('市', '').replace('县', '').replace('区', '');
            stats = regionStats[regionKey] || { count: 0 };
        }
        
        const fillColor = getColorByCount(stats.count);
        
        // 如果是外边界（初始视图），填充颜色
        if (isOutline && !currentCity) {
            // 填充区域
            const coords = feature.geometry.coordinates;
            ctx.fillStyle = fillColor + '80'; // 80 = 50%透明度
            ctx.beginPath();
            
            if (feature.geometry.type === 'Polygon') {
                drawPolygonPath(coords[0]);
            } else if (feature.geometry.type === 'MultiPolygon') {
                coords.forEach(polygon => {
                    drawPolygonPath(polygon[0]);
                });
            }
            ctx.closePath();
            ctx.fill();
        }
        
        // 详细视图：填充县/镇区域
        if (currentCity && !isOutline) {
            const coords = feature.geometry.coordinates;
            ctx.fillStyle = fillColor + 'CC'; // CC = 80%不透明度，颜色更接近图例
            ctx.beginPath();
            
            if (feature.geometry.type === 'Polygon') {
                drawPolygonPath(coords[0]);
            } else if (feature.geometry.type === 'MultiPolygon') {
                coords.forEach(polygon => {
                    drawPolygonPath(polygon[0]);
                });
            }
            ctx.closePath();
            ctx.fill();
        }
        
        // 根据级别设置线条粗细和颜色（确保边界线清晰可见）
        let lineWidth = 1.0;
        let color = '#333';
        
        if (isOutline && !currentCity) {
            // 市外边界（确保清晰可见）
            lineWidth = 2.0;
            color = '#1e40af'; // 深蓝色，更明显
        } else if (currentCity && isCounty) {
            // 详细视图中的县/镇边界
            lineWidth = 1.0;
            color = '#666';
        } else if (currentCity && isCity) {
            // 详细视图中的市边界（如果有）
            lineWidth = 1.5;
            color = '#1e40af';
        }
        
        // 设置线条样式，确保边界线清晰可见
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        
        const coords = feature.geometry.coordinates;
        
        // 绘制边界线
        if (feature.geometry.type === 'Polygon') {
            drawPolygon(coords[0]);
        } else if (feature.geometry.type === 'MultiPolygon') {
            coords.forEach(polygon => {
                drawPolygon(polygon[0]);
            });
        }
        
        // 存储区域信息用于点击检测
        if (!currentCity) {
            feature._cityKey = boundary.city;
            feature._stats = stats;
        } else {
            const regionName = props.name || props.名称 || '未知区域';
            const regionKey = regionName.replace('市', '').replace('县', '').replace('区', '');
            feature._regionKey = regionKey;
            feature._stats = stats;
        }
    });
}

// 绘制多边形路径（用于填充，不自动stroke）
function drawPolygonPath(coords) {
    if (!coords || coords.length === 0) return;
    
    const firstPoint = geoToCanvas(coords[0][0], coords[0][1]);
    ctx.moveTo(firstPoint.x, firstPoint.y);
    
    for (let i = 1; i < coords.length; i++) {
        const point = geoToCanvas(coords[i][0], coords[i][1]);
        ctx.lineTo(point.x, point.y);
    }
}

// 绘制多边形边界
function drawPolygon(coords) {
    if (!coords || coords.length === 0) return;
    
    ctx.beginPath();
    const firstPoint = geoToCanvas(coords[0][0], coords[0][1]);
    ctx.moveTo(firstPoint.x, firstPoint.y);
    
    for (let i = 1; i < coords.length; i++) {
        const point = geoToCanvas(coords[i][0], coords[i][1]);
        ctx.lineTo(point.x, point.y);
    }
    
    ctx.closePath();
    ctx.stroke();
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

// 绘制区域标签（区域名称 + 事件数量）
function drawRegionLabels() {
    boundaries.forEach(boundary => {
        const feature = boundary.feature;
        const props = feature.properties || {};
        const isOutline = boundary.isOutline;
        
        // 初始视图：只显示市标签
        if (!currentCity && !isOutline) {
            return; // 跳过县/镇标签
        }
        
        let stats, labelText, fullName;
        
        if (!currentCity) {
            // 初始视图：显示市标签
            const cityKey = feature._cityKey || boundary.city;
            if (!cityKey) return;
            
            const city = WANBEI_CITIES.find(c => c.key === cityKey);
            fullName = city?.fullName || cityKey;
            stats = feature._stats || regionStats[cityKey] || { count: 0 };
            labelText = `${fullName}\n${stats.count || 0}件`;
        } else {
            // 详细视图：显示县/镇标签
            const regionName = props.name || props.名称 || '未知区域';
            const regionKey = feature._regionKey || regionName.replace('市', '').replace('县', '').replace('区', '');
            stats = feature._stats || regionStats[regionKey] || { count: 0 };
            fullName = regionName;
            labelText = `${fullName}\n${stats.count || 0}件`;
        }
        
        // 计算区域中心点
        const coords = feature.geometry.coordinates;
        let center = null;
        
        if (feature.geometry.type === 'Polygon') {
            center = getPolygonCenter(coords[0]);
        } else if (feature.geometry.type === 'MultiPolygon') {
            center = getPolygonCenter(coords);
        }
        
        if (!center) return;
        
        const point = geoToCanvas(center.lng, center.lat);
        
        // 设置文字样式（缩小、白色）
        ctx.font = 'bold 12px "Microsoft YaHei", Arial, sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // 绘制多行文字（地方名称和事件数分行显示）
        const lines = labelText.split('\n');
        const lineHeight = 14;
        const totalHeight = lines.length * lineHeight;
        const startY = point.y - (totalHeight - lineHeight) / 2;
        
        lines.forEach((line, index) => {
            ctx.fillText(line, point.x, startY + index * lineHeight);
        });
        
        // 存储标签位置用于点击检测（简化，不计算实际宽度）
        feature._labelX = point.x;
        feature._labelY = point.y;
        feature._labelWidth = 100; // 简化宽度
        feature._labelHeight = totalHeight;
    });
}

// 绘制事件节点
function drawEvents() {
    if (!filteredEvents || filteredEvents.length === 0) {
        console.warn('drawEvents: filteredEvents为空或长度为0', { filteredEvents });
        return;
    }
    
    let drawnCount = 0;
    let skippedCount = 0;
    
    filteredEvents.forEach(event => {
        const props = event.properties || {};
        const lng = props.lng || props.经度 || props.longitude || null;
        const lat = props.lat || props.纬度 || props.latitude || null;
        
        // 检查坐标是否存在且为有效数字
        if (lng === null || lat === null || lng === undefined || lat === undefined) {
            skippedCount++;
            return;
        }
        
        const lngNum = parseFloat(lng);
        const latNum = parseFloat(lat);
        
        if (isNaN(lngNum) || isNaN(latNum)) {
            skippedCount++;
            return;
        }
        
        const point = geoToCanvas(lngNum, latNum);
        
        // 检查点是否在画布范围内（可选，允许绘制超出范围的点）
        // if (point.x < 0 || point.x > canvas.width || point.y < 0 || point.y > canvas.height) {
        //     return;
        // }
        
        // 绘制事件节点图标（红色圆点）
        ctx.beginPath();
        ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#ff0000';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.stroke();
        
        drawnCount++;
    });
    
    if (drawnCount > 0 || skippedCount > 0) {
        console.log(`drawEvents: 绘制了${drawnCount}个事件节点，跳过了${skippedCount}个无坐标事件`);
    }
}
