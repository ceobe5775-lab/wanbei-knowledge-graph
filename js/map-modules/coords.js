// 坐标转换模块

// 坐标转换：地理坐标 -> Canvas坐标
function geoToCanvas(lng, lat) {
    // 使用更合适的缩放因子，确保坐标正确映射
    // 参考 Leaflet 的坐标系统：1度经度约等于111km（在纬度33度附近）
    const scale = currentView.zoom * Math.min(canvas.width, canvas.height) / 2;
    const x = (lng - currentView.centerX) * scale + canvas.width / 2;
    const y = (currentView.centerY - lat) * scale + canvas.height / 2;
    return { x, y };
}

// 坐标转换：Canvas坐标 -> 地理坐标
function canvasToGeo(x, y) {
    const scale = currentView.zoom * Math.min(canvas.width, canvas.height) / 2;
    const lng = (x - canvas.width / 2) / scale + currentView.centerX;
    const lat = currentView.centerY - (y - canvas.height / 2) / scale;
    return { lng, lat };
}










































































