// 知识图谱渲染器 - 统一入口，自动选择最佳渲染器

const KGRenderer = {
    /**
     * 渲染知识图谱
     * @param {Array} nodes - 节点数组
     * @param {Array} edges - 边数组
     */
    render(nodes, edges) {
        const container = document.getElementById('cy');
        if (!container) {
            console.warn('知识图谱：容器不存在');
            return;
        }

        if (!nodes || nodes.length === 0) {
            console.warn('知识图谱：没有节点可渲染');
            return;
        }

        // 优先使用 vis.js，如果未加载则使用 Cytoscape.js
        if (typeof vis !== 'undefined' && window.KGRendererVis) {
            window.KGRendererVis.render(nodes, edges);
        } else if (typeof cytoscape !== 'undefined' && window.KGRendererCytoscape) {
            window.KGRendererCytoscape.render(nodes, edges);
        } else {
            console.warn('知识图谱：没有可用的渲染器，请确保 vis.js 或 Cytoscape.js 已加载');
        }
    },
    
    /**
     * 清理渲染器实例
     */
    destroy() {
        if (window.KGRendererVis) {
            window.KGRendererVis.destroy();
        }
        if (window.KGRendererCytoscape) {
            window.KGRendererCytoscape.destroy();
        }
    }
};

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = KGRenderer;
} else {
    window.KGRenderer = KGRenderer;
}

