// 全局状态管理模块

let canvas = null;
let ctx = null;
let allEvents = [];
let filteredEvents = [];
let boundaries = [];
let regionStats = {}; // 区域统计：{区域名: {count: 数量, events: [事件列表]}}
let currentView = {
    centerX: 116.5,
    centerY: 33.0,
    zoom: 1.0
};
let isDragging = false;
let lastMouseX = 0;
let lastMouseY = 0;
let hoveredRegion = null;
let currentCity = null; // 当前选中的城市
let cityTilesView = null; // 六市图块视图容器
let mapDetailView = null; // 地图详细视图容器
let cityOutlines = {}; // 存储每个市的外边界轮廓 {cityKey: {bounds: {...}, outline: Feature}}










































































