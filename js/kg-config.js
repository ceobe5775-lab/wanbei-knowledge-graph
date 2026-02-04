// 知识图谱配置和样式 - 完全匹配 Neo4j Browser

const KGConfig = {
    // 节点样式配置（基于实际提取的 Neo4j Browser HTML 元素值）
    node: {
        // 节点大小：内圈 r="40"，所以直径是 80px
        // 外圈 r="44"，stroke-width="8px" 是外边框
        // 调整事件集与单个事件的尺寸差异，便于区分
        defaultSize: 70,        // 单个事件节点大小（px）
        eventSetSize: 110,      // 事件集节点大小（px）
        innerRadius: 40,        // 内圈半径（实际节点半径，r="40"）
        outerRadius: 44,        // 外圈半径（包含边框，r="44"）
        
        // 节点颜色（根据图例颜色统一）
        backgroundColor: '#68bdf6',  // 默认背景色（如果类型未指定）
        borderColor: '#5dade2',     // 默认边框色
        outerBorderColor: '#68bdf6', // 外圈边框色
        // 按类型设置颜色（与图例统一）
        typeColors: {
            event: { background: '#ef4444', border: '#dc2626' },      // 事件：红色
            person: { background: '#f59e0b', border: '#d97706' },      // 人物：橙色
            location: { background: '#10b981', border: '#059669' },   // 地点：绿色
            time: { background: '#3b82f6', border: '#2563eb' }        // 时间：蓝色
        },
        
        // 边框宽度（基于实际提取的值）
        innerBorderWidth: 2,        // 内圈边框宽度（stroke-width="2px"）
        outerBorderWidth: 8,        // 外圈边框宽度（stroke-width="8px"）
        
        // 文字样式（基于实际提取的值：font-size="10px", fill="#2A2C34"）
        fontColor: '#2A2C34',       // 文字颜色（fill="#2A2C34"）
        fontSize: 24,               // 字体调为24
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        fontStrokeWidth: 0,
        fontStrokeColor: 'transparent'
    },
    
    // 边样式配置（基于实际提取的 Neo4j Browser 值）
    edge: {
        color: '#A5ABB6',       // 边颜色（fill="#A5ABB6"）
        highlightColor: '#68bdf6',
        width: 1,
        opacity: 1,             // 边本身不透明，通过 fill 颜色控制
        arrowScaleFactor: 1.4,  // 放大箭头
        
        // 边标签文字样式（基于实际提取的值）
        fontColor: '#000000',    // 文字颜色（fill="#000000"）
        fontSize: 24,            // 文字大小与节点文字统一为24
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        fontBackgroundColor: '#ffffff',
        fontBackgroundOpacity: 0.95
    },
    
    // 背景配置（基于实际提取：rect fill="none" 表示透明，实际背景为白色）
    background: {
        color: '#ffffff'        // Neo4j Browser 实际背景色（白色）
    },
    
    // 布局配置（vis.js）
    layout: {
        // 布局和交互选项会直接传递给 vis.Network
        physics: {
            enabled: true,
            stabilization: {
                enabled: true,
                iterations: 400,
                fit: true
            },
            barnesHut: {
                // 放大斥力与弹簧长度，让节点间距约为原来的 3 倍
                gravitationalConstant: -6000,
                centralGravity: 0.05,
                springLength: 1200,
                springConstant: 0.02,
                damping: 0.09,
                avoidOverlap: 1
            }
        },
        interaction: {
            dragNodes: true,
            dragView: true,
            zoomView: true,
            hover: true,
            tooltipDelay: 100,
            selectConnectedEdges: false,
            // 选择功能配置
            selectable: true,           // 允许选择节点
            multiselect: true,          // 允许多选（Ctrl+点击）
            hoverConnectedEdges: true,  // 悬停时高亮连接的边
            keyboard: {
                enabled: true,          // 启用键盘支持
                speed: { x: 10, y: 10, zoom: 0.02 },
                bindToWindow: true
            }
        },
        layout: {
            // vis 内置改进布局在大图上可能报错，关闭以避免定位失败
            improvedLayout: false
        },
        configure: {
            enabled: false
        }
    },
    
    // 布局配置（Cytoscape.js - 后备）
    cytoscapeLayout: {
        name: 'cose',
        animate: true,
        animationDuration: 800,
        animationEasing: 'ease-out',
        fit: true,
        padding: 60,
        nodeDimensionsIncludeLabels: true,
        idealEdgeLength: 400,
        edgeElasticity: 0.25,
        nestingFactor: 0.1,
        gravity: 0.1,
        componentSpacing: 100,
        numIter: 3000,
        initialTemp: 200,
        coolingFactor: 0.95,
        minTemp: 1.0,
        randomize: false
    },
    
    // 事件集判断配置
    eventSet: {
        relationshipTypes: ['包含', '事件_事件'],
        keywords: ['关联', '系列'],
        minChildEvents: 2  // 至少需要2个子事件才认为是事件集
    },
    
    // 标签格式化配置（基于实际节点大小80px）
    label: {
        charsPerLineSmall: 6,   // 标准节点(80px)每行字符数
        charsPerLineLarge: 8,    // 大节点(80px+)每行字符数
        maxLinesSmall: 2,        // 标准节点最大行数
        maxLinesLarge: 3         // 大节点最大行数
    }
};

// 导出配置
if (typeof module !== 'undefined' && module.exports) {
    module.exports = KGConfig;
} else {
    window.KGConfig = KGConfig;
}

