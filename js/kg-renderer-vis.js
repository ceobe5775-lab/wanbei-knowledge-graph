// vis.js 渲染器实现 - 完全匹配 Neo4j Browser

const KGRendererVis = {
    /**
     * 渲染知识图谱（使用 vis.js）
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

        if (typeof vis === 'undefined') {
            console.warn('知识图谱：vis.js 未加载');
            return;
        }

        console.log('知识图谱渲染（vis.js）：节点数量', nodes.length, '边数量', edges ? edges.length : 0);

        const config = window.KGConfig || {};
        const utils = window.KGUtils || { formatLabel: (text) => text };

        // 转换为 vis.js 格式（基于实际提取的 Neo4j Browser 值）
        const visNodes = new vis.DataSet(nodes.map(node => {
            const size = node.data.size || config.node?.defaultSize || 80;
            const label = utils.formatLabel(node.data.label, size);
            
            // 根据节点类型使用不同的颜色（与图例统一）
            const nodeType = node.data.type || 'event';
            const typeColors = config.node?.typeColors || {};
            const typeColor = typeColors[nodeType] || {};
            const nodeBgColor = typeColor.background || config.node?.backgroundColor || '#68bdf6';
            const nodeBorderColor = typeColor.border || config.node?.borderColor || '#5dade2';
            
            return {
                id: node.data.id,
                label: label,
                size: size,
                color: {
                    background: nodeBgColor,
                    border: nodeBorderColor,
                    highlight: {
                        background: nodeBgColor,
                        border: nodeBgColor
                    },
                    hover: {
                        background: nodeBgColor,
                        border: nodeBorderColor
                    }
                },
                // 边框宽度：内圈边框 2px（基于实际提取值）
                borderWidth: config.node?.innerBorderWidth || 2,
                borderWidthSelected: config.node?.innerBorderWidth || 2,
                font: {
                    color: config.node?.fontColor || '#2A2C34',  // 基于实际提取值
                    size: config.node?.fontSize || 14,           // 增大字体以便阅读（基础大小，会随缩放变化）
                    face: config.node?.fontFamily || '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                    strokeWidth: config.node?.fontStrokeWidth || 0,
                    strokeColor: config.node?.fontStrokeColor || 'transparent',
                    align: 'center',      // 文字水平居中对齐
                    vadjust: -size * 1.5,  // 略微下移，让位置更居中
                    multi: 'md'          // 多行文本模式，支持换行
                },
                shape: 'dot',
                type: node.data.type || 'event',
                isEventSet: node.data.isEventSet || false
            };
        }));

        // 去重边：确保每条边只有一个唯一的ID
        const edgeMap = new Map();
        const uniqueEdges = [];
        (edges || []).forEach(edge => {
            // 生成唯一ID：优先使用 edge.data.id，否则使用 source-label-target
            const edgeId = edge.data.id || `${edge.data.source}-${edge.data.label || ''}-${edge.data.target}`;
            if (!edgeMap.has(edgeId)) {
                edgeMap.set(edgeId, edge);
                uniqueEdges.push(edge);
            }
        });
        
        const visEdges = new vis.DataSet(uniqueEdges.map(edge => {
            const edgeId = edge.data.id || `${edge.data.source}-${edge.data.label || ''}-${edge.data.target}`;
            return {
                id: edgeId,
                from: edge.data.source,
                to: edge.data.target,
                label: edge.data.label || '',
                color: {
                color: config.edge?.color || '#A5ABB6',  // 基于实际提取值 fill="#A5ABB6"
                highlight: config.edge?.highlightColor || '#68bdf6',
                hover: config.edge?.highlightColor || '#68bdf6',
                opacity: config.edge?.opacity || 1
            },
            width: config.edge?.width || 1,
            arrows: {
                to: {
                    enabled: true,
                    scaleFactor: config.edge?.arrowScaleFactor || 0.7,
                    type: 'arrow'
                }
            },
            smooth: {
                type: 'continuous',
                roundness: 0.5
            },
                font: {
                    color: config.edge?.fontColor || '#000000',  // 基于实际提取值 fill="#000000"
                    size: config.edge?.fontSize || 8,            // 基于实际提取值 font-size="8px"
                    face: config.edge?.fontFamily || '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                    align: 'middle'
                }
            };
        }));

        // 使用配置中的选项
        const options = {
            nodes: {
                shape: 'dot',
                font: {
                    color: config.node?.fontColor || '#2A2C34',  // 基于实际提取值
                    size: config.node?.fontSize || 14,           // 增大字体以便阅读
                    face: config.node?.fontFamily || '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                    strokeWidth: config.node?.fontStrokeWidth || 0,
                    strokeColor: config.node?.fontStrokeColor || 'transparent',
                    align: 'center',      // 文字水平居中对齐
                    vadjust: -66,         // 略微下移
                    multi: 'md'          // 多行文本模式
                },
                borderWidth: config.node?.innerBorderWidth || 2,  // 基于实际提取值
                borderWidthSelected: config.node?.innerBorderWidth || 2,
                shadow: false,
                // 文字大小随缩放变化（匹配 Neo4j Browser 的行为）
                scaling: {
                    label: {
                        enabled: true,    // 启用标签缩放
                        min: 12,         // 最小字体大小（缩放时）- 增大以便阅读
                        max: 24,         // 最大字体大小（缩放时）- 增大以便阅读
                        maxVisible: 36,   // 最大可见字体大小
                        drawThreshold: 0  // 设置为 0，确保无论怎么缩放都能看到文字
                    }
                },
                chosen: {
                    node: function(values, id, selected, hovering) {
                        if (selected || hovering) {
                            values.borderWidth = config.node?.innerBorderWidth || 2;
                        }
                    }
                }
            },
            edges: {
                color: {
                    color: config.edge?.color || '#A5ABB6',  // 基于实际提取值
                    highlight: config.edge?.highlightColor || '#68bdf6',
                    hover: config.edge?.highlightColor || '#68bdf6',
                    opacity: config.edge?.opacity || 1
                },
                width: config.edge?.width || 1,
                arrows: {
                    to: {
                        enabled: true,
                        scaleFactor: config.edge?.arrowScaleFactor || 0.7,
                        type: 'arrow'
                    }
                },
                smooth: {
                    type: 'continuous',
                    roundness: 0.5
                },
                font: {
                    color: config.edge?.fontColor || '#000000',  // 基于实际提取值
                    size: config.edge?.fontSize || 8,            // 基于实际提取值
                    face: config.edge?.fontFamily || '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                    align: 'middle',
                    // vis.js 期望 background 为字符串，不能是对象
                    background: config.edge?.fontBackgroundColor || '#ffffff'
                },
                selectionWidth: 2,
                hoverWidth: 1.5
            },
            // 交互配置（确保选择功能启用）
            interaction: {
                dragNodes: true,
                dragView: true,
                zoomView: true,
                hover: true,
                tooltipDelay: 100,
                selectConnectedEdges: false,
                // 选择功能配置
                multiselect: true,          // 允许多选（Ctrl+点击）
                hoverConnectedEdges: true,  // 悬停时高亮连接的边
                keyboard: {
                    enabled: true,          // 启用键盘支持
                    speed: { x: 10, y: 10, zoom: 0.02 },
                    bindToWindow: true
                }
            },
            ...(config.layout || {})
        };

        // 为防止外层 config.layout 里有嵌套的 layout 冲突，强制关闭 improvedLayout
        if (!options.layout) options.layout = {};
        options.layout.improvedLayout = false;

        // 创建或更新网络
        const data = { nodes: visNodes, edges: visEdges };
        
        if (!window.__visNetwork) {
            // 设置容器背景色（Neo4j Browser 的 rect fill="none" 表示透明，背景由父元素控制）
            // 使用白色背景以匹配 Neo4j Browser 的实际显示效果
            container.style.backgroundColor = '#ffffff';  // 白色背景，匹配 Neo4j Browser
            
            window.__visNetwork = new vis.Network(container, data, options);
            
            // 使用标志来跟踪是否应该执行导航
            let shouldNavigate = true;
            let lastClickTime = 0;
            let lastClickNode = null;
            
            // 绑定点击事件 - 支持选择和导航
            window.__visNetwork.on('click', (params) => {
                const clickTime = Date.now();
                const hasNode = params.nodes.length > 0;
                const hasEdge = params.edges.length > 0;
                
                // 检查是否是双击（在 300ms 内点击同一节点）
                const isDoubleClick = (clickTime - lastClickTime < 300) && 
                                     hasNode && 
                                     params.nodes[0] === lastClickNode;
                
                lastClickTime = clickTime;
                if (hasNode) {
                    lastClickNode = params.nodes[0];
                }
                
                // Ctrl+点击或双击：只选择，不导航
                if (params.event && (params.event.ctrlKey || params.event.metaKey || isDoubleClick)) {
                    shouldNavigate = false;
                    // vis.js 会自动处理选择，我们不做任何操作
                    setTimeout(() => {
                        shouldNavigate = true; // 重置标志
                    }, 100);
                    return;
                }
                
                // 如果点击了节点
                if (hasNode && shouldNavigate) {
                    const nodeId = params.nodes[0];
                    const nodeData = visNodes.get(nodeId);
                    if (!nodeData) return;
                    
                    // 延迟执行导航，确保选择操作先完成
                    setTimeout(() => {
                        if (!shouldNavigate) return; // 如果标志被重置，不执行导航
                        
                        const views = window.KGViews;
                        if (!views) return;
                        
                        const currentView = views.getCurrentView();
                        if (!currentView) return;
                        
                        // 检查是否使用线索延展模式
                        // 需要同时满足：1. 延展关系开关打开 2. 延展模式为 'extend' 或 'replace'
                        const extendRelationsEnabled = window.__kgExtendRelations === true;
                        const extendMode = window.KGTrailIntegration ? window.KGTrailIntegration.getExtendMode() : 'extend';
                        const useTrailExtend = extendRelationsEnabled && (extendMode === 'extend' || extendMode === 'replace');
                        
                        console.log('[点击处理]', {
                            nodeId,
                            nodeType: nodeData.type,
                            currentViewType: currentView ? currentView.type : 'null',
                            useTrailExtend,
                            hasKGTrailExtend: !!window.KGTrailExtend
                        });
                        
                        if (useTrailExtend && window.KGTrailExtend) {
                            // 获取当前延展模式
                            const currentExtendMode = window.KGTrailIntegration && window.KGTrailIntegration.getExtendMode 
                                ? window.KGTrailIntegration.getExtendMode() 
                                : 'extend';
                            
                            // 使用线索延展模式
                            console.log('[延展模式] 开始延展节点:', nodeId, '模式:', currentExtendMode);
                            try {
                                const view = window.KGTrailExtend.extendFromNode(nodeId, {
                                    depth: 1,
                                    relationTypes: [],
                                    nodeTypes: [],
                                    includeSameEvent: true,
                                    includeOtherEvents: true,
                                    replaceMode: currentExtendMode === 'replace' // 传递替换模式标志，内部会自动处理重置
                                });
                                
                                console.log('[延展模式] 延展结果:', {
                                    hasView: !!view,
                                    nodesCount: view ? (view.nodes ? view.nodes.length : 0) : 0,
                                    edgesCount: view ? (view.edges ? view.edges.length : 0) : 0,
                                    trail: view ? view.trail : null
                                });
                                
                                if (view && view.nodes && view.nodes.length > 0) {
                                    if (window.KGRenderer) {
                                        console.log('[延展模式] 开始渲染...');
                                        window.KGRenderer.render(view.nodes, view.edges || []);
                                        console.log('[延展模式] 渲染完成');
                                    } else {
                                        console.error('[延展模式] KGRenderer 未加载');
                                    }
                                    if (window.KGTrailIntegration) {
                                        window.KGTrailIntegration.updateTrailPathDisplay();
                                    }
                                } else {
                                    console.warn('[延展模式] 延展返回空视图，回退到原有逻辑');
                                    // 回退到原有逻辑
                                    if (currentView && currentView.type === 'initial') {
                                        if (nodeData.type === 'event') {
                                            if (nodeData.isEventSet) {
                                                views.showEventSetView(nodeId);
                                            } else {
                                                views.showEventView(nodeId);
                                            }
                                        }
                                    }
                                }
                            } catch (error) {
                                console.error('[延展模式] 延展失败:', error);
                                console.error(error.stack);
                                // 失败时回退到原有逻辑
                                if (currentView && currentView.type === 'initial') {
                                    if (nodeData.type === 'event') {
                                        if (nodeData.isEventSet) {
                                            views.showEventSetView(nodeId);
                                        } else {
                                            views.showEventView(nodeId);
                                        }
                                    }
                                }
                            }
                        } else {
                            // 使用替换模式：原有逻辑
                            console.log('[替换模式] 使用原有逻辑');
                            if (currentView && currentView.type === 'initial') {
                                if (nodeData.type === 'event') {
                                    if (nodeData.isEventSet) {
                                        views.showEventSetView(nodeId);
                                    } else {
                                        views.showEventView(nodeId);
                                    }
                                }
                            } else if (currentView && currentView.type === 'eventSet') {
                                if (nodeData.type === 'event' && !nodeData.isEventSet) {
                                    views.showEventView(nodeId);
                                }
                            } else if (currentView && currentView.type === 'event') {
                                if (nodeData.type === 'person' || nodeData.type === 'location') {
                                    views.showPersonLocationView(nodeId);
                                }
                            }
                        }
                        
                        views.updateFocusHint();
                    }, 200); // 延迟执行导航
                } 
                // 如果点击了边 - vis.js 会自动处理选择
                else if (hasEdge) {
                    // vis.js 会自动处理边的选择
                    shouldNavigate = false; // 点击边时不导航
                }
                // 点击空白处
                else {
                    // 取消所有选择
                    window.__visNetwork.unselectAll();
                    shouldNavigate = true;
                }
            });
            
            // 监听选择变化事件（用于调试和确认选择功能）
            window.__visNetwork.on('selectNode', (params) => {
                console.log('节点已选择:', params.nodes);
                this.showDebugInfo('node', params.nodes[0], visNodes, visEdges);
            });
            
            window.__visNetwork.on('selectEdge', (params) => {
                console.log('边已选择:', params.edges);
                this.showDebugInfo('edge', params.edges[0], visNodes, visEdges);
            });
            
            // 监听悬停事件（用于调试）
            window.__visNetwork.on('hoverNode', (params) => {
                this.showDebugInfo('node', params.node, visNodes, visEdges);
            });
            
            window.__visNetwork.on('hoverEdge', (params) => {
                this.showDebugInfo('edge', params.edge, visNodes, visEdges);
            });
            
            window.__visNetwork.on('blurNode', () => {
                this.hideDebugInfo();
            });
            
            window.__visNetwork.on('blurEdge', () => {
                this.hideDebugInfo();
            });
        } else {
            // 更新数据
            window.__visNetwork.setData(data);
        }
    },
    
    /**
     * 显示调试信息面板
     * @param {string} type - 'node' 或 'edge'
     * @param {string} id - 节点或边的ID
     * @param {vis.DataSet} visNodes - 节点数据集
     * @param {vis.DataSet} visEdges - 边数据集
     */
    showDebugInfo(type, id, visNodes, visEdges) {
        // 禁用调试面板（用户反馈不需要）
        return;

        let debugPanel = document.getElementById('kg-debug-panel');
        if (!debugPanel) {
            debugPanel = document.createElement('div');
            debugPanel.id = 'kg-debug-panel';
            debugPanel.style.cssText = `
                position: fixed;
                top: 80px;
                right: 20px;
                background: white;
                border: 2px solid #007bff;
                border-radius: 8px;
                padding: 15px;
                min-width: 300px;
                max-width: 500px;
                max-height: 600px;
                overflow-y: auto;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                z-index: 10000;
                font-family: 'Courier New', monospace;
                font-size: 12px;
                line-height: 1.6;
            `;
            document.body.appendChild(debugPanel);
        }
        
        let info = '';
        if (type === 'node') {
            const node = visNodes.get(id);
            if (node) {
                info = `
                    <div style="font-weight: bold; color: #007bff; margin-bottom: 10px; font-size: 14px;">
                        🔵 节点信息 (可在控制台中使用)
                    </div>
                    <div style="margin-bottom: 8px;"><strong>ID:</strong> <code>${node.id}</code></div>
                    <div style="margin-bottom: 8px;"><strong>标签:</strong> ${node.label || '无'}</div>
                    <div style="margin-bottom: 8px;"><strong>类型:</strong> ${node.type || 'unknown'}</div>
                    <div style="margin-bottom: 8px;"><strong>大小:</strong> ${node.size || 'N/A'}</div>
                    <div style="margin-bottom: 8px;"><strong>颜色:</strong> 
                        <span style="display: inline-block; width: 20px; height: 20px; background: ${node.color?.background || '#ccc'}; border: 1px solid #000; vertical-align: middle;"></span>
                        ${node.color?.background || 'N/A'}
                    </div>
                    <div style="margin-bottom: 8px;"><strong>边框颜色:</strong> ${node.color?.border || 'N/A'}</div>
                    <div style="margin-bottom: 8px;"><strong>边框宽度:</strong> ${node.borderWidth || 'N/A'}px</div>
                    <div style="margin-bottom: 8px;"><strong>字体大小:</strong> ${node.font?.size || 'N/A'}px</div>
                    <div style="margin-bottom: 8px;"><strong>字体颜色:</strong> ${node.font?.color || 'N/A'}</div>
                    <div style="margin-top: 15px; padding-top: 10px; border-top: 1px solid #ddd;">
                        <strong>控制台命令:</strong><br>
                        <code style="background: #f5f5f5; padding: 5px; display: block; margin-top: 5px;">
                            window.__visNetwork.getNodePositions()['${node.id}']
                        </code>
                    </div>
                    <div style="margin-top: 10px; padding: 8px; background: #f0f8ff; border-radius: 4px; font-size: 11px;">
                        <strong>💡 提示:</strong> 在控制台输入 <code>window.__kgDebugNode</code> 查看完整节点数据
                    </div>
                `;
                // 将节点数据存储到全局变量，方便在控制台访问
                window.__kgDebugNode = node;
            }
        } else if (type === 'edge') {
            const edge = visEdges.get(id);
            if (edge) {
                info = `
                    <div style="font-weight: bold; color: #28a745; margin-bottom: 10px; font-size: 14px;">
                        🔗 边信息 (可在控制台中使用)
                    </div>
                    <div style="margin-bottom: 8px;"><strong>ID:</strong> <code>${edge.id}</code></div>
                    <div style="margin-bottom: 8px;"><strong>标签:</strong> ${edge.label || '无'}</div>
                    <div style="margin-bottom: 8px;"><strong>从:</strong> ${edge.from}</div>
                    <div style="margin-bottom: 8px;"><strong>到:</strong> ${edge.to}</div>
                    <div style="margin-bottom: 8px;"><strong>颜色:</strong> 
                        <span style="display: inline-block; width: 20px; height: 3px; background: ${edge.color?.color || '#ccc'}; vertical-align: middle;"></span>
                        ${edge.color?.color || 'N/A'}
                    </div>
                    <div style="margin-bottom: 8px;"><strong>宽度:</strong> ${edge.width || 'N/A'}px</div>
                    <div style="margin-top: 15px; padding-top: 10px; border-top: 1px solid #ddd;">
                        <strong>控制台命令:</strong><br>
                        <code style="background: #f5f5f5; padding: 5px; display: block; margin-top: 5px;">
                            window.__visNetwork.getConnectedNodes('${edge.from}')
                        </code>
                    </div>
                    <div style="margin-top: 10px; padding: 8px; background: #f0f8ff; border-radius: 4px; font-size: 11px;">
                        <strong>💡 提示:</strong> 在控制台输入 <code>window.__kgDebugEdge</code> 查看完整边数据
                    </div>
                `;
                // 将边数据存储到全局变量，方便在控制台访问
                window.__kgDebugEdge = edge;
            }
        }
        
        debugPanel.innerHTML = info;
        debugPanel.style.display = 'block';
    },
    
    /**
     * 隐藏调试信息面板
     */
    hideDebugInfo() {
        const debugPanel = document.getElementById('kg-debug-panel');
        if (debugPanel) {
            debugPanel.style.display = 'none';
        }
    },
    
    /**
     * 清理渲染器实例
     */
    destroy() {
        if (window.__visNetwork) {
            try {
                window.__visNetwork.destroy();
            } catch (e) {
                console.warn('清理vis.js实例失败:', e);
            }
            window.__visNetwork = null;
        }
        // 清理调试面板
        const debugPanel = document.getElementById('kg-debug-panel');
        if (debugPanel) {
            debugPanel.remove();
        }
    }
};

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = KGRendererVis;
} else {
    window.KGRendererVis = KGRendererVis;
}

