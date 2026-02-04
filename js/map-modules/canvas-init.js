// Canvas 初始化模块

function initCanvas() {
    canvas = document.getElementById('eventMapCanvas');
    if (!canvas) {
        console.error('Canvas元素未找到: eventMapCanvas');
        return;
    }
    
    ctx = canvas.getContext('2d');
    if (!ctx) {
        console.error('无法获取Canvas上下文');
        return;
    }
    
    console.log('Canvas 初始化成功:', { 
        width: canvas.width, 
        height: canvas.height,
        containerWidth: canvas.parentElement?.clientWidth,
        containerHeight: canvas.parentElement?.clientHeight
    });
    
    // 设置Canvas尺寸
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // 绑定事件
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('wheel', onWheel);
    canvas.addEventListener('click', onCanvasClick);
}

// 调整Canvas尺寸（防抖）
let resizeTimer = null;
function resizeCanvas() {
    const container = canvas.parentElement;
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    
    if (resizeTimer) {
        clearTimeout(resizeTimer);
    }
    resizeTimer = setTimeout(() => {
        drawMap();
        resizeTimer = null;
    }, 100);
}

























