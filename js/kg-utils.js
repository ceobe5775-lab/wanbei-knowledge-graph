// 知识图谱工具函数

/**
 * 处理标签文本，自动换行以适应圆圈
 * @param {string} text - 原始文本
 * @param {number} maxWidth - 节点大小（px）
 * @returns {string} - 格式化后的文本（使用 \n 分隔行）
 */
function formatLabel(text, maxWidth) {
    if (!text) return '';
    const textStr = String(text);
    
    const config = window.KGConfig || {
        label: {
            charsPerLineSmall: 4,
            charsPerLineLarge: 6,
            maxLinesSmall: 2,
            maxLinesLarge: 3
        }
    };
    
    // 根据节点大小估算每行字符数（基于实际节点大小80px）
    const charsPerLine = maxWidth >= 80 ? config.label.charsPerLineLarge : config.label.charsPerLineSmall;
    const maxLines = maxWidth >= 80 ? config.label.maxLinesLarge : config.label.maxLinesSmall;
    
    if (textStr.length <= charsPerLine) return textStr;
    
    // 智能换行：优先在标点符号、空格处换行
    const lines = [];
    let currentLine = '';
    let charCount = 0;
    
    for (let i = 0; i < textStr.length; i++) {
        const char = textStr[i];
        currentLine += char;
        charCount++;
        
        // 如果达到最大长度，或者遇到标点符号
        if (charCount >= charsPerLine || /[，。、；：！？\s]/.test(char)) {
            if (currentLine.trim()) {
                lines.push(currentLine.trim());
                if (lines.length >= maxLines) break; // 达到最大行数就停止
            }
            currentLine = '';
            charCount = 0;
        }
    }
    
    // 如果还有剩余文本且未达到最大行数
    if (currentLine.trim() && lines.length < maxLines) {
        lines.push(currentLine.trim());
    }
    
    return lines.join('\n');
}

/**
 * 判断节点是否是某个事件集的子事件（被事件集包含）
 * @param {string} nodeId - 节点ID
 * @param {Array} edges - 所有边
 * @param {Map} nodeMap - 节点映射
 * @returns {boolean} - 是否被事件集包含
 */
function isChildOfEventSet(nodeId, edges, nodeMap) {
    const config = window.KGConfig || {
        eventSet: {
            relationshipTypes: ['包含', '事件_事件'],
            keywords: ['关联', '系列']
        }
    };
    const eventSetTypes = config.eventSet.relationshipTypes;
    
    return edges.some(edge => {
        if (edge.data.target !== nodeId) return false;
        const sourceNode = nodeMap.get(edge.data.source);
        if (!sourceNode) return false;
        const relType = edge.data.label || '';
        const isEventSetByFlag = sourceNode.data.isEventSet === true;
        const isEventSetByCalc = isEventSet(sourceNode.data.id, edges, nodeMap);
        const isEventSetNode = isEventSetByFlag || isEventSetByCalc;
        if (!isEventSetNode) return false;
        return eventSetTypes.some(type => relType.includes(type)) ||
               (config.eventSet.keywords || []).some(keyword => relType.includes(keyword));
    });
}

/**
 * 判断节点是否是事件集（有包含关系指向其他事件）
 * @param {string} nodeId - 节点ID
 * @param {Array} edges - 所有边
 * @param {Map} nodeMap - 节点映射
 * @returns {boolean} - 是否是事件集
 */
function isEventSet(nodeId, edges, nodeMap) {
    const config = window.KGConfig || {
        eventSet: {
            relationshipTypes: ['包含', '事件_事件'],
            keywords: ['关联', '系列'],
            minChildEvents: 2
        }
    };
    
    const eventSetTypes = config.eventSet.relationshipTypes;
    let childEventCount = 0;
    
    edges.forEach(edge => {
        if (edge.data.source === nodeId) {
            const targetNode = nodeMap.get(edge.data.target);
            if (targetNode && targetNode.data.type === 'event') {
                const relType = edge.data.label || '';
                // 检查关系类型是否包含关键词
                if (eventSetTypes.some(type => relType.includes(type)) || 
                    config.eventSet.keywords.some(keyword => relType.includes(keyword))) {
                    childEventCount++;
                }
            }
        }
    });
    
    // 如果有关系指向至少 minChildEvents 个事件，认为是事件集
    if (childEventCount >= config.eventSet.minChildEvents) return true;
    
    // 兜底：如果节点标签本身含有“事件集”，也认为是事件集
    const node = nodeMap.get(nodeId);
    if (node && node.data && node.data.originalNode && Array.isArray(node.data.originalNode.labels)) {
        if (node.data.originalNode.labels.includes('事件集')) return true;
    }
    return false;
}

// 导出函数
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { formatLabel, isEventSet, isChildOfEventSet };
} else {
    window.KGUtils = { formatLabel, isEventSet, isChildOfEventSet };
}

