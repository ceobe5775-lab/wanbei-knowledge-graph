// 主入口模块

document.addEventListener('DOMContentLoaded', () => {
    // 获取视图容器
    cityTilesView = document.getElementById('cityTilesView');
    mapDetailView = document.getElementById('mapDetailView');
    
    // 初始化Canvas
    initCanvas();
    
    // 加载数据
    loadData();
    
    // 绑定返回按钮
    const backBtn = document.getElementById('back');
    if (backBtn) {
        backBtn.addEventListener('click', backToTilesView);
    }
    
    // 绑定筛选事件
    const eventTypeFilter = document.getElementById('eventTypeFilter');
    const regionFilter = document.getElementById('regionFilter');
    
    if (eventTypeFilter) {
        eventTypeFilter.addEventListener('change', () => {
            if (currentCity) {
                applyFilters();
            } else {
                updateFilterStatus();
            }
        });
    }
    
    if (regionFilter) {
        regionFilter.addEventListener('change', () => {
            if (currentCity) {
                applyFilters();
            } else {
                updateFilterStatus();
            }
        });
    }
    
    // 添加roundRect polyfill（如果浏览器不支持）
    if (!CanvasRenderingContext2D.prototype.roundRect) {
        CanvasRenderingContext2D.prototype.roundRect = function(x, y, width, height, radius) {
            this.beginPath();
            this.moveTo(x + radius, y);
            this.lineTo(x + width - radius, y);
            this.quadraticCurveTo(x + width, y, x + width, y + radius);
            this.lineTo(x + width, y + height - radius);
            this.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
            this.lineTo(x + radius, y + height);
            this.quadraticCurveTo(x, y + height, x, y + height - radius);
            this.lineTo(x, y + radius);
            this.quadraticCurveTo(x, y, x + radius, y);
            this.closePath();
        };
    }
});
