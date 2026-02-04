// 知识图谱缓存管理

const KGCache = {
    // 缓存数据结构
    cache: {
        allNodes: [],
        allEdges: [],
        nodeMap: new Map(),
        edgeMap: new Map()
    },
    
    /**
     * 初始化缓存
     */
    init() {
        this.cache = {
            allNodes: [],
            allEdges: [],
            nodeMap: new Map(),
            edgeMap: new Map()
        };
    },
    
    /**
     * 从数据源构建缓存
     * @param {Array} sourceNodes - 源节点数据
     * @param {Array} rels - 关系数据
     */
    build(sourceNodes, rels) {
        this.init();
        
        // 构建节点缓存
        sourceNodes.forEach(node => {
            if (!node || !node.id) return;
            const labels = node.labels || [];
            const labelStr = Array.isArray(labels) ? labels.join('') : String(labels);
            let type = 'other';
            let isEventSet = false;
            // 先用ID前缀兜底识别事件集
            if (typeof node.id === 'string' && node.id.startsWith('ES')) {
                type = 'event';
                isEventSet = true;
            }
            if ((Array.isArray(labels) && labels.includes('事件集')) || labelStr.includes('事件集')) {
                // 事件集也归为事件类型，便于初始视图显示
                type = 'event';
                isEventSet = true;
            } else if (labels.includes && labels.includes('事件')) type = 'event';
            else if (labels.includes && labels.includes('人物')) type = 'person';
            else if (labels.includes && labels.includes('地点')) type = 'location';
            else if (labels.includes && labels.includes('时间')) type = 'time';
            
            const cyNode = {
                data: { 
                    id: node.id, 
                    label: (node.properties && (node.properties.名称 || node.properties.姓名 || node.properties.name)) || node.id, 
                    type,
                    isEventSet,
                    originalNode: node
                }
            };
            this.cache.allNodes.push(cyNode);
            this.cache.nodeMap.set(node.id, cyNode);
        });
        
        // 构建边缓存
        rels.forEach(rel => {
            if (!rel.start || !rel.end) return;
            const cyEdge = {
                data: {
                    id: rel.id || `${rel.start}-${rel.type || 'REL'}-${rel.end}`,
                    source: rel.start,
                    target: rel.end,
                    label: rel.type || '',
                    originalRel: rel
                }
            };
            this.cache.allEdges.push(cyEdge);
            const key = `${rel.start}-${rel.end}`;
            if (!this.cache.edgeMap.has(key)) this.cache.edgeMap.set(key, []);
            this.cache.edgeMap.get(key).push(cyEdge);
        });

        /**
         * 补充“事件-人物/地点”等关系
         * 说明：
         * - Neo4j 导出的节点中，人物/地点等通过属性 `相关事件ID`、`相关地点` 等与事件关联
         * - 为了在知识图谱中点开事件能看到关联人物和地点，这里根据这些属性动态生成补充关系
         */
        try {
            if (Array.isArray(sourceNodes) && sourceNodes.length > 0) {
                // 1) 建立 domainId -> 节点内部ID 的映射（如 E114 -> "1886"）
                const domainIdToNodeId = new Map();
                sourceNodes.forEach(node => {
                    if (!node || !node.id) return;
                    const props = node.properties || {};
                    const domainId = props.id; // Neo4j 中的业务ID，如 E114 / P475 / L169
                    if (domainId) {
                        domainIdToNodeId.set(String(domainId), String(node.id));
                    }
                });

                // 2) 根据 `相关事件ID` 为人物/地点等补充“事件-实体”关系
                sourceNodes.forEach(node => {
                    if (!node || !node.id) return;
                    const props = node.properties || {};
                    const rawRelated = props['相关事件ID'];
                    if (!rawRelated) return;

                    // 统一转为数组，支持字符串 / 数组 / 多个ID用逗号或空格分隔的情况
                    let relatedIds = [];
                    if (Array.isArray(rawRelated)) {
                        relatedIds = rawRelated.map(v => String(v));
                    } else {
                        relatedIds = String(rawRelated)
                            .split(/[，,;；\s]+/)
                            .map(s => s.trim())
                            .filter(Boolean);
                    }

                    if (relatedIds.length === 0) return;

                    const targetNodeId = String(node.id);
                    const targetCyNode = this.cache.nodeMap.get(targetNodeId);
                    if (!targetCyNode) return;

                    const targetType = targetCyNode.data.type || 'other';

                    relatedIds.forEach(eventDomainId => {
                        const eventNodeId = domainIdToNodeId.get(String(eventDomainId));
                        if (!eventNodeId) return;

                        const eventCyNode = this.cache.nodeMap.get(String(eventNodeId));
                        if (!eventCyNode) return;

                        // 构造关系类型：区分事件-人物 / 事件-地点，其余归为事件-实体
                        let relType = '事件_实体';
                        if (targetType === 'person') {
                            relType = '事件_人物';
                        } else if (targetType === 'location') {
                            relType = '事件_地点';
                        }

                        const sourceId = String(eventNodeId);
                        const edgeKey = `${sourceId}-${targetNodeId}`;
                        const edgeId = `${sourceId}-${relType}-${targetNodeId}`;

                        // 避免重复添加
                        const existedList = this.cache.edgeMap.get(edgeKey) || [];
                        if (existedList.some(e => e.data && e.data.id === edgeId)) {
                            return;
                        }

                        const syntheticEdge = {
                            data: {
                                id: edgeId,
                                source: sourceId,
                                target: targetNodeId,
                                label: relType,
                                type: relType,
                                originalRel: {
                                    synthetic: true,
                                    reason: 'from_related_event_id',
                                    eventDomainId: String(eventDomainId)
                                }
                            }
                        };

                        this.cache.allEdges.push(syntheticEdge);
                        if (!this.cache.edgeMap.has(edgeKey)) {
                            this.cache.edgeMap.set(edgeKey, []);
                        }
                        this.cache.edgeMap.get(edgeKey).push(syntheticEdge);
                    });
                });
            }
        } catch (e) {
            console.warn('知识图谱：根据相关事件ID 补充事件-实体关系失败:', e);
        }
        
        console.log('知识图谱缓存构建完成:', {
            allNodes: this.cache.allNodes.length,
            allEdges: this.cache.allEdges.length,
            eventNodes: this.cache.allNodes.filter(n => n.data.type === 'event').length,
            eventSets: this.cache.allNodes.filter(n => n.data.isEventSet).length
        });
    },
    
    /**
     * 获取所有节点
     * @returns {Array}
     */
    getAllNodes() {
        return this.cache.allNodes;
    },
    
    /**
     * 获取所有边
     * @returns {Array}
     */
    getAllEdges() {
        return this.cache.allEdges;
    },
    
    /**
     * 获取节点映射
     * @returns {Map}
     */
    getNodeMap() {
        return this.cache.nodeMap;
    },
    
    /**
     * 获取边映射
     * @returns {Map}
     */
    getEdgeMap() {
        return this.cache.edgeMap;
    },
    
    /**
     * 根据ID获取节点
     * @param {string} nodeId - 节点ID
     * @returns {Object|null}
     */
    getNode(nodeId) {
        return this.cache.nodeMap.get(nodeId) || null;
    }
};

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = KGCache;
} else {
    window.KGCache = KGCache;
}



