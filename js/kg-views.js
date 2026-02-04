// 知识图谱视图管理

const KGViews = {
    // 视图栈
    viewStack: [],
    
    /**
     * 初始化视图栈
     */
    init() {
        this.viewStack = [];
    },
    
    /**
     * 显示初始视图：只显示事件节点（事件集大圆圈，单个事件小圆圈）
     */
    showInitialView() {
        const cache = window.KGCache.cache;
        const utils = window.KGUtils;
        
        if (!cache || cache.allNodes.length === 0) {
            console.warn('知识图谱：缓存为空，无法显示初始视图');
            return;
        }
        
        // 仅保留事件集节点 + 未被事件集包含的单事件，避免初始界面重复显示
        const eventNodesRaw = cache.allNodes.filter(n => n.data.type === 'event');
        const eventNodes = eventNodesRaw.filter(n => {
            const isChild = utils.isChildOfEventSet ? utils.isChildOfEventSet(n.data.id, cache.allEdges, cache.nodeMap) : false;
            // 事件集或未被包含的单事件才显示在初始视图
            return n.data.isEventSet === true || !isChild;
        });
        console.log('知识图谱初始视图：事件节点数量', eventNodes.length);
        
        if (eventNodes.length === 0) {
            console.warn('知识图谱：没有找到事件节点');
            // 如果没有事件节点，显示所有节点
            const config = window.KGConfig || { node: { defaultSize: 58 } };
            const allNodesWithSize = cache.allNodes.map(n => ({
                ...n,
                data: {
                    ...n.data,
                    size: config.node.defaultSize,
                    isEventSet: false
                }
            }));
            
            const view = {
                type: 'initial',
                centerId: null,
                nodes: allNodesWithSize,
                edges: []
            };
            
            this.viewStack = [view];
            if (window.KGRenderer) {
                window.KGRenderer.render(view.nodes, view.edges);
            } else {
                console.warn('知识图谱：渲染器未加载');
            }
            return;
        }
        
        // 为事件节点添加size属性
        const config = window.KGConfig || { node: { defaultSize: 58, eventSetSize: 80 } };
        const nodesWithSize = eventNodes.map(n => {
            // 优先使用标签标记的事件集，其次用边关系判断
            const isSetByLabel = n.data.isEventSet === true;
            const isSetByEdges = utils.isEventSet(n.data.id, cache.allEdges, cache.nodeMap);
            const isSet = isSetByLabel || isSetByEdges;
            return {
                ...n,
                data: {
                    ...n.data,
                    size: isSet ? config.node.eventSetSize : config.node.defaultSize,
                    isEventSet: isSet
                }
            };
        });
        
        const eventSetCount = nodesWithSize.filter(n => n.data.isEventSet).length;
        const singleEventCount = nodesWithSize.length - eventSetCount;
        console.log(`知识图谱初始视图：节点准备完成 ${nodesWithSize.length}（事件集 ${eventSetCount}，单事件 ${singleEventCount}）`);
        
        // 初始视图不显示关系
        const view = {
            type: 'initial',
            centerId: null,
            nodes: nodesWithSize,
            edges: []
        };
        
        this.viewStack = [view];
        window.KGRenderer.render(view.nodes, view.edges);
    },
    
    /**
     * 点击事件集：显示其包含的子事件及子事件之间的关系
     * @param {string} eventSetId - 事件集ID
     */
    showEventSetView(eventSetId) {
        const cache = window.KGCache.cache;
        const config = window.KGConfig || {
            eventSet: {
                relationshipTypes: ['包含', '事件_事件'],
                keywords: ['关联', '系列']
            },
            node: { eventSetSize: 80, defaultSize: 58 }
        };
        
        const eventSetNode = cache.nodeMap.get(eventSetId);
        if (!eventSetNode || eventSetNode.data.type !== 'event') return;
        
        // 找到该事件集包含的所有子事件
        const childEventIds = new Set();
        const eventSetTypes = config.eventSet.relationshipTypes;
        
        cache.allEdges.forEach(edge => {
            if (edge.data.source === eventSetId) {
                const targetNode = cache.nodeMap.get(edge.data.target);
                if (targetNode && targetNode.data.type === 'event') {
                    const relType = edge.data.label || '';
                    // 检查关系类型是否包含关键词
                    if (eventSetTypes.some(type => relType.includes(type)) || 
                        config.eventSet.keywords.some(keyword => relType.includes(keyword))) {
                        childEventIds.add(edge.data.target);
                    }
                }
            }
        });
        
        // 找到子事件之间的关系
        const childEventSet = new Set(childEventIds);
        const childEdges = [];
        cache.allEdges.forEach(edge => {
            if (childEventSet.has(edge.data.source) && childEventSet.has(edge.data.target)) {
                childEdges.push(edge);
            }
        });
        
        // 构建节点列表（包含事件集节点和子事件节点）
        const nodes = [{
            ...eventSetNode,
            data: { ...eventSetNode.data, size: config.node.eventSetSize, isEventSet: true }
        }];
        
        childEventIds.forEach(id => {
            const node = cache.nodeMap.get(id);
            if (node) {
                nodes.push({
                    ...node,
                    data: { ...node.data, size: config.node.defaultSize, isEventSet: false }
                });
            }
        });
        
        const view = {
            type: 'eventSet',
            centerId: eventSetId,
            nodes,
            edges: childEdges
        };
        
        this.viewStack.push(view);
        if (window.KGRenderer) {
            window.KGRenderer.render(view.nodes, view.edges);
        } else {
            console.warn('知识图谱：渲染器未加载');
        }
    },
    
    /**
     * 点击单个事件：显示该事件关联的人物和地点及关系
     * @param {string} eventId - 事件ID
     */
    showEventView(eventId) {
        const cache = window.KGCache.cache;
        const config = window.KGConfig || { node: { defaultSize: 58 } };
        
        const eventNode = cache.nodeMap.get(eventId);
        if (!eventNode || eventNode.data.type !== 'event') return;
        
        const relatedPersonIds = new Set();
        const relatedLocationIds = new Set();
        const relatedEdges = [];
        
        // 找到与该事件相关的人物和地点（支持双向关系）
        cache.allEdges.forEach(edge => {
            // 检查是否是事件-人物或事件-地点关系（忽略"相同实体"关系）
            if (edge.data.type === '相同实体') return; // 跳过"相同实体"关系
            
            if (edge.data.source === eventId) {
                const targetNode = cache.nodeMap.get(edge.data.target);
                if (targetNode) {
                    if (targetNode.data.type === 'person') {
                        relatedPersonIds.add(edge.data.target);
                        relatedEdges.push(edge);
                    } else if (targetNode.data.type === 'location') {
                        relatedLocationIds.add(edge.data.target);
                        relatedEdges.push(edge);
                    } else if (targetNode.data.type === 'event') {
                        // 也包含事件-事件关系（如"导致"、"触发"等）
                        relatedEdges.push(edge);
                    }
                }
            } else if (edge.data.target === eventId) {
                const sourceNode = cache.nodeMap.get(edge.data.source);
                if (sourceNode) {
                    if (sourceNode.data.type === 'person') {
                        relatedPersonIds.add(edge.data.source);
                        relatedEdges.push(edge);
                    } else if (sourceNode.data.type === 'location') {
                        relatedLocationIds.add(edge.data.source);
                        relatedEdges.push(edge);
                    } else if (sourceNode.data.type === 'event') {
                        // 也包含事件-事件关系
                        relatedEdges.push(edge);
                    }
                }
            }
        });
        
        // 构建节点列表
        const nodes = [{
            ...eventNode,
            data: { ...eventNode.data, size: config.node.defaultSize, isEventSet: false }
        }];
        
        relatedPersonIds.forEach(id => {
            const node = cache.nodeMap.get(id);
            if (node) nodes.push({ ...node, data: { ...node.data, size: config.node.defaultSize } });
        });
        
        relatedLocationIds.forEach(id => {
            const node = cache.nodeMap.get(id);
            if (node) nodes.push({ ...node, data: { ...node.data, size: config.node.defaultSize } });
        });

        // 如果开启“延展关系”模式，则补充人物/地点之间以及它们与事件之间的其他关系
        if (window.__kgExtendRelations) {
            const visibleIds = new Set([eventId, ...relatedPersonIds, ...relatedLocationIds]);
            cache.allEdges.forEach(edge => {
                const s = edge.data.source;
                const t = edge.data.target;
                if (visibleIds.has(s) && visibleIds.has(t)) {
                    // 已经添加过的关系不重复加入
                    if (!relatedEdges.includes(edge)) {
                        relatedEdges.push(edge);
                    }
                }
            });
        }
        
        const view = {
            type: 'event',
            centerId: eventId,
            nodes,
            edges: relatedEdges
        };
        
        this.viewStack.push(view);
        if (window.KGRenderer) {
            window.KGRenderer.render(view.nodes, view.edges);
        } else {
            console.warn('知识图谱：渲染器未加载');
        }
    },
    
    /**
     * 点击人物/地点：显示与它们相关的其他节点（不显示关系）
     * @param {string} nodeId - 节点ID
     */
    showPersonLocationView(nodeId) {
        const cache = window.KGCache.cache;
        const config = window.KGConfig || { node: { defaultSize: 58 } };
        
        const centerNode = cache.nodeMap.get(nodeId);
        if (!centerNode || (centerNode.data.type !== 'person' && centerNode.data.type !== 'location')) return;
        
        const relatedNodeIds = new Set();
        
        // 找到与该节点相关的所有其他节点
        cache.allEdges.forEach(edge => {
            if (edge.data.source === nodeId) {
                relatedNodeIds.add(edge.data.target);
            } else if (edge.data.target === nodeId) {
                relatedNodeIds.add(edge.data.source);
            }
        });
        
        // 构建节点列表（不包含关系）
        const nodes = [{
            ...centerNode,
            data: { ...centerNode.data, size: config.node.defaultSize }
        }];
        
        relatedNodeIds.forEach(id => {
            const node = cache.nodeMap.get(id);
            if (node) nodes.push({ ...node, data: { ...node.data, size: config.node.defaultSize } });
        });
        
        // 默认不显示关系；如果开启延展模式，则显示这些节点之间的所有关系
        let edges = [];
        if (window.__kgExtendRelations) {
            const visibleIds = new Set([nodeId, ...relatedNodeIds]);
            cache.allEdges.forEach(edge => {
                const s = edge.data.source;
                const t = edge.data.target;
                if (visibleIds.has(s) && visibleIds.has(t)) {
                    edges.push(edge);
                }
            });
        }
        
        const view = {
            type: centerNode.data.type,
            centerId: nodeId,
            nodes,
            edges
        };
        
        this.viewStack.push(view);
        if (window.KGRenderer) {
            window.KGRenderer.render(view.nodes, view.edges);
        } else {
            console.warn('知识图谱：渲染器未加载');
        }
    },
    
    /**
     * 获取当前视图
     * @returns {Object|null}
     */
    getCurrentView() {
        return this.viewStack.length > 0 ? this.viewStack[this.viewStack.length - 1] : null;
    },
    
    /**
     * 更新视图提示（已移除，不再需要）
     */
    updateFocusHint() {
        // 视图提示功能已移除，subgraph-controls 已删除
    }
};

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = KGViews;
} else {
    window.KGViews = KGViews;
}

