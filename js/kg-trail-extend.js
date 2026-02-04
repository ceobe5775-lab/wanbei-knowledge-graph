// 知识图谱线索延展机制
// 实现从一个节点开始，沿着关系不断延展，累积显示相关节点的功能

const KGTrailExtend = {
    // 当前延展的线索（节点ID序列）
    currentTrail: [],
    
    // 已显示的节点集合（避免重复显示）
    displayedNodes: new Set(),
    
    // 已显示的关系集合
    displayedEdges: new Set(),
    
    /**
     * 初始化线索延展
     */
    init() {
        this.currentTrail = [];
        this.displayedNodes.clear();
        this.displayedEdges.clear();
    },
    
    /**
     * 从指定节点开始延展
     * @param {string} startNodeId - 起始节点ID
     * @param {Object} options - 延展选项
     * @param {number} options.depth - 延展深度（默认1，表示只延展一层）
     * @param {Array} options.relationTypes - 要延展的关系类型（空数组表示所有类型）
     * @param {Array} options.nodeTypes - 要延展的节点类型（空数组表示所有类型）
     * @param {boolean} options.includeSameEvent - 是否包含同事件的其他节点（默认true）
     * @param {boolean} options.includeOtherEvents - 是否包含其他事件的节点（默认true）
     */
    extendFromNode(startNodeId, options = {}) {
        const cache = window.KGCache.cache;
        if (!cache) {
            console.warn('[延展] 缓存未加载');
            return null;
        }
        
        const {
            depth = 1,
            relationTypes = [],
            nodeTypes = [],
            includeSameEvent = true,
            includeOtherEvents = true,
            replaceMode = false // 替换模式：不累积，只显示当前节点的关系
        } = options;
        
        const startNode = cache.nodeMap.get(startNodeId);
        if (!startNode) {
            console.warn(`[延展] 找不到节点 ${startNodeId}`);
            return null;
        }
        
        console.log(`[延展] 开始延展节点: ${startNode.data.label || startNodeId} (ID: ${startNodeId}), 模式: ${replaceMode ? '替换' : '延展'}`);
        
        // 先检查节点是否有关系
        const allRelatedEdges = cache.allEdges.filter(e => 
            e.data.source === startNodeId || e.data.target === startNodeId
        );
        const validEdges = allRelatedEdges.filter(e => 
            e.data.type !== '相同实体' && e.data.label !== '相同实体'
        );
        console.log(`[延展] 节点关系检查: 总关系 ${allRelatedEdges.length} 条, 有效关系 ${validEdges.length} 条`);
        
        // 替换模式：重置并只显示当前节点
        if (replaceMode) {
            this.init();
            this.currentTrail = [startNodeId];
            this.displayedNodes = new Set([startNodeId]);
            this.displayedEdges = new Set();
        } else {
            // 延展模式：累积显示
            // 如果是第一次延展，初始化
            if (this.currentTrail.length === 0) {
                this.init();
                this.currentTrail.push(startNodeId);
                this.displayedNodes.add(startNodeId);
            } else {
                // 如果节点已经在线索中，不重复添加
                if (this.currentTrail.includes(startNodeId)) {
                    return this.getCurrentView();
                }
                this.currentTrail.push(startNodeId);
                this.displayedNodes.add(startNodeId);
            }
        }
        
        // 获取起始节点的事件信息（如果有）
        const startEventId = this.getNodeEventId(startNodeId, cache);
        
        // 延展节点和关系
        // 替换模式：只从当前节点开始；延展模式：从已显示的节点累积
        const extendedNodes = replaceMode 
            ? new Set([startNodeId])  // 替换模式：只包含当前节点
            : new Set([...this.displayedNodes]);  // 延展模式：累积已显示的节点
        const extendedEdges = replaceMode 
            ? new Set()  // 替换模式：从空开始
            : new Set([...this.displayedEdges]);  // 延展模式：累积已显示的关系
        
        // 统计信息
        const stats = {
            foundEdgesCount: 0,
            filteredEdgesCount: 0
        };
        
        // 递归延展
        this._extendRecursive(
            startNodeId,
            depth,
            relationTypes,
            nodeTypes,
            includeSameEvent,
            includeOtherEvents,
            startEventId,
            extendedNodes,
            extendedEdges,
            cache,
            new Set(), // 已访问的节点（防止循环）
            stats // 传递统计信息
        );
        
        // 更新已显示的节点和关系
        // 替换模式：只更新当前节点的关系；延展模式：累积更新
        if (replaceMode) {
            // 替换模式：只保存当前节点的关系，不累积（extendedNodes 已经包含 startNodeId）
            this.displayedNodes = extendedNodes;
            this.displayedEdges = extendedEdges;
        } else {
            // 延展模式：累积更新
            this.displayedNodes = extendedNodes;
            this.displayedEdges = extendedEdges;
        }
        
        console.log(`[延展] 延展完成: 节点 ${extendedNodes.size} 个, 关系 ${extendedEdges.size} 条, 模式: ${replaceMode ? '替换' : '延展'}`);
        console.log(`[延展] 调试信息: 找到 ${stats.foundEdgesCount} 条关系, 过滤 ${stats.filteredEdgesCount} 条"相同实体"关系`);
        
        // 构建视图
        const nodes = Array.from(extendedNodes).map(id => {
            const node = cache.nodeMap.get(id);
            if (!node) return null;
            
            // 标记节点在线索中的位置
            const trailIndex = this.currentTrail.indexOf(id);
            const isInTrail = trailIndex !== -1;
            const isStartNode = id === startNodeId;
            const isLatestNode = trailIndex === this.currentTrail.length - 1;
            
            return {
                ...node,
                data: {
                    ...node.data,
                    isInTrail,
                    isStartNode,
                    isLatestNode,
                    trailIndex
                }
            };
        }).filter(n => n !== null);
        
        // 将 edgeId 转换回 edge 对象
        const edges = [];
        for (const edgeId of extendedEdges) {
            // edgeId 格式可能是 "source->target:label" 或 edge.data.id
            const edge = cache.allEdges.find(e => {
                const eid = this._getEdgeId(e);
                return eid === edgeId || e.data.id === edgeId;
            });
            if (edge) {
                edges.push(edge);
            } else {
                console.warn(`[延展] 找不到关系: ${edgeId}`);
            }
        }
        
        return {
            type: 'trail',
            trail: [...this.currentTrail],
            centerId: startNodeId,
            nodes,
            edges
        };
    },
    
    /**
     * 递归延展节点
     */
    _extendRecursive(
        nodeId,
        remainingDepth,
        relationTypes,
        nodeTypes,
        includeSameEvent,
        includeOtherEvents,
        startEventId,
        extendedNodes,
        extendedEdges,
        cache,
        visited,
        stats = { foundEdgesCount: 0, filteredEdgesCount: 0 }
    ) {
        if (remainingDepth <= 0 || visited.has(nodeId)) {
            return;
        }
        
        visited.add(nodeId);
        
        // 找到与该节点相关的所有关系
        cache.allEdges.forEach(edge => {
            // 跳过"相同实体"关系
            if (edge.data.type === '相同实体' || edge.data.label === '相同实体') {
                if (stats) stats.filteredEdgesCount++;
                return;
            }
            
            const edgeId = this._getEdgeId(edge);
            if (extendedEdges.has(edgeId)) return; // 已显示的关系跳过
            
            let relatedNodeId = null;
            let isOutgoing = false;
            
            if (edge.data.source === nodeId) {
                relatedNodeId = edge.data.target;
                isOutgoing = true;
            } else if (edge.data.target === nodeId) {
                relatedNodeId = edge.data.source;
                isOutgoing = false;
            }
            
            if (!relatedNodeId) return;
            
            if (stats) stats.foundEdgesCount++;
            
            // 检查关系类型过滤
            if (relationTypes.length > 0) {
                const relType = edge.data.label || '';
                if (!relationTypes.some(type => relType.includes(type))) {
                    return;
                }
            }
            
            const relatedNode = cache.nodeMap.get(relatedNodeId);
            if (!relatedNode) return;
            
            // 检查节点类型过滤
            if (nodeTypes.length > 0) {
                if (!nodeTypes.includes(relatedNode.data.type)) {
                    return;
                }
            }
            
            // 检查事件过滤
            const relatedEventId = this.getNodeEventId(relatedNodeId, cache);
            if (startEventId) {
                if (relatedEventId === startEventId && !includeSameEvent) {
                    return; // 同事件节点被排除
                }
                if (relatedEventId !== startEventId && relatedEventId && !includeOtherEvents) {
                    return; // 其他事件节点被排除
                }
            }
            
            // 添加节点和关系
            extendedNodes.add(relatedNodeId);
            // 确保 edgeId 是字符串格式
            const edgeIdStr = typeof edgeId === 'string' ? edgeId : this._getEdgeId(edge);
            extendedEdges.add(edgeIdStr);
            
            // 递归延展
            if (remainingDepth > 1) {
                this._extendRecursive(
                    relatedNodeId,
                    remainingDepth - 1,
                    relationTypes,
                    nodeTypes,
                    includeSameEvent,
                    includeOtherEvents,
                    startEventId,
                    extendedNodes,
                    extendedEdges,
                    cache,
                    visited,
                    stats // 传递统计信息
                );
            }
        });
    },
    
    /**
     * 获取节点所属的事件ID（如果节点是事件的一部分）
     */
    getNodeEventId(nodeId, cache) {
        const node = cache.nodeMap.get(nodeId);
        if (!node) return null;
        
        // 如果节点本身就是事件，返回自己的ID
        if (node.data.type === 'event') {
            return nodeId;
        }
        
        // 查找节点通过关系连接的事件
        for (const edge of cache.allEdges) {
            if (edge.data.source === nodeId) {
                const targetNode = cache.nodeMap.get(edge.data.target);
                if (targetNode && targetNode.data.type === 'event') {
                    return edge.data.target;
                }
            } else if (edge.data.target === nodeId) {
                const sourceNode = cache.nodeMap.get(edge.data.source);
                if (sourceNode && sourceNode.data.type === 'event') {
                    return edge.data.source;
                }
            }
        }
        
        return null;
    },
    
    /**
     * 生成关系的唯一ID
     */
    _getEdgeId(edge) {
        if (!edge || !edge.data) {
            console.warn('[延展] 无效的关系对象:', edge);
            return '';
        }
        // 使用 edge.data.id 如果存在，否则生成唯一ID
        if (edge.data.id) {
            return edge.data.id;
        }
        return `${edge.data.source}->${edge.data.target}:${edge.data.label || ''}`;
    },
    
    /**
     * 获取当前视图
     */
    getCurrentView() {
        const cache = window.KGCache.cache;
        if (!cache || this.displayedNodes.size === 0) {
            return null;
        }
        
        const nodes = Array.from(this.displayedNodes).map(id => {
            const node = cache.nodeMap.get(id);
            if (!node) return null;
            
            const trailIndex = this.currentTrail.indexOf(id);
            return {
                ...node,
                data: {
                    ...node.data,
                    isInTrail: trailIndex !== -1,
                    trailIndex
                }
            };
        }).filter(n => n !== null);
        
        const edges = Array.from(this.displayedEdges).map(edgeId => {
            return cache.allEdges.find(e => this._getEdgeId(e) === edgeId);
        }).filter(e => e !== undefined);
        
        return {
            type: 'trail',
            trail: [...this.currentTrail],
            centerId: this.currentTrail[0],
            nodes,
            edges
        };
    },
    
    /**
     * 回退到上一个节点
     */
    stepBack() {
        if (this.currentTrail.length <= 1) {
            return null; // 无法回退
        }
        
        // 移除最后一个节点
        const removedNodeId = this.currentTrail.pop();
        this.displayedNodes.delete(removedNodeId);
        
        // 移除与该节点相关的边（如果这些边的另一端节点不在显示列表中）
        const cache = window.KGCache.cache;
        if (cache) {
            const edgesToRemove = [];
            this.displayedEdges.forEach(edgeId => {
                const edge = cache.allEdges.find(e => this._getEdgeId(e) === edgeId);
                if (edge) {
                    const sourceInDisplay = this.displayedNodes.has(edge.data.source);
                    const targetInDisplay = this.displayedNodes.has(edge.data.target);
                    if (!sourceInDisplay || !targetInDisplay) {
                        edgesToRemove.push(edgeId);
                    }
                }
            });
            edgesToRemove.forEach(id => this.displayedEdges.delete(id));
        }
        
        return this.getCurrentView();
    },
    
    /**
     * 重置线索
     */
    reset() {
        this.init();
    },
    
    /**
     * 获取线索路径描述
     */
    getTrailDescription() {
        if (this.currentTrail.length === 0) {
            return '未开始延展';
        }
        
        const cache = window.KGCache.cache;
        if (!cache) return '';
        
        const trailNames = this.currentTrail.map(id => {
            const node = cache.nodeMap.get(id);
            return node ? (node.data.label || node.data.name || id) : id;
        });
        
        return trailNames.join(' → ');
    }
};

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = KGTrailExtend;
} else {
    window.KGTrailExtend = KGTrailExtend;
}

