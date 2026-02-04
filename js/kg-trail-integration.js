// 线索延展功能集成
// 将线索延展功能集成到现有的知识图谱系统中

(function() {
    'use strict';
    
    // 延展模式：'replace'（替换）或 'extend'（延展）
    let extendMode = 'extend'; // 默认使用延展模式
    
    // 延展选项
    let extendOptions = {
        depth: 1, // 每次延展的深度
        relationTypes: [], // 空数组表示所有关系类型
        nodeTypes: [], // 空数组表示所有节点类型
        includeSameEvent: true, // 包含同事件的节点
        includeOtherEvents: true // 包含其他事件的节点
    };
    
    /**
     * 初始化线索延展功能
     */
    function initTrailExtend() {
        // 确保 KGTrailExtend 已加载
        if (!window.KGTrailExtend) {
            console.warn('线索延展模块未加载');
            return;
        }
        
        // 初始化线索延展
        window.KGTrailExtend.init();
        
        // 创建UI控制面板
        createTrailControlPanel();
        
        console.log('线索延展功能已初始化');
    }
    
    /**
     * 创建线索延展控制面板
     */
    function createTrailControlPanel() {
        const controlsContainer = document.querySelector('.graph-controls');
        if (!controlsContainer) return;
        
        // 检查是否已存在控制面板
        if (document.getElementById('trail-control-panel')) return;
        
        const panel = document.createElement('div');
        panel.id = 'trail-control-panel';
        panel.style.cssText = `
            margin-top: 12px;
            padding: 12px;
            background: #f9fafb;
            border-radius: 8px;
            border: 1px solid #e5e7eb;
        `;
        
        panel.innerHTML = `
            <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <label style="font-size: 13px; color: #374151;">
                        <input type="radio" name="extend-mode" value="extend" checked style="margin-right: 4px;">
                        延展模式（累积显示）
                    </label>
                    <label style="font-size: 13px; color: #374151;">
                        <input type="radio" name="extend-mode" value="replace" style="margin-right: 4px;">
                        替换模式（跳转显示）
                    </label>
                </div>
                <button id="trail-reset-btn" class="search-btn" style="padding: 6px 12px; font-size: 13px;">
                    重置线索
                </button>
                <button id="trail-back-btn" class="search-btn" style="padding: 6px 12px; font-size: 13px;">
                    回退一步
                </button>
            </div>
            <div id="trail-path-display" style="margin-top: 8px; font-size: 12px; color: #6b7280; min-height: 20px;">
                线索路径：未开始
            </div>
        `;
        
        controlsContainer.appendChild(panel);
        
        // 绑定事件
        const modeRadios = panel.querySelectorAll('input[name="extend-mode"]');
        modeRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                extendMode = e.target.value;
                console.log('延展模式切换为:', extendMode);
                
                // 如果当前在延展视图中，重新渲染以反映新模式
                if (window.KGTrailExtend && window.KGTrailExtend.currentTrail.length > 0) {
                    // 获取当前线索的最后一个节点
                    const lastNodeId = window.KGTrailExtend.currentTrail[window.KGTrailExtend.currentTrail.length - 1];
                    
                    // 根据模式重新延展
                    if (extendMode === 'replace') {
                        // 替换模式：重置并重新延展最后一个节点
                        console.log('[模式切换] 替换模式：重置并重新延展节点', lastNodeId);
                        window.KGTrailExtend.reset();
                        const view = window.KGTrailExtend.extendFromNode(lastNodeId, extendOptions);
                        if (view && view.nodes && view.nodes.length > 0 && window.KGRenderer) {
                            window.KGRenderer.render(view.nodes, view.edges || []);
                            updateTrailPathDisplay();
                            console.log('[模式切换] 替换模式渲染完成:', { nodes: view.nodes.length, edges: (view.edges || []).length });
                        }
                    } else {
                        // 延展模式：重新渲染当前累积的视图
                        console.log('[模式切换] 延展模式：重新渲染累积视图');
                        const currentView = window.KGTrailExtend.getCurrentView();
                        if (currentView && currentView.nodes && currentView.nodes.length > 0 && window.KGRenderer) {
                            window.KGRenderer.render(currentView.nodes, currentView.edges || []);
                            updateTrailPathDisplay();
                            console.log('[模式切换] 延展模式渲染完成:', { nodes: currentView.nodes.length, edges: (currentView.edges || []).length });
                        }
                    }
                } else {
                    console.log('[模式切换] 当前不在延展视图中，无需重新渲染');
                }
            });
        });
        
        const resetBtn = document.getElementById('trail-reset-btn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                window.KGTrailExtend.reset();
                if (window.KGViews) {
                    window.KGViews.showInitialView();
                }
                updateTrailPathDisplay();
            });
        }
        
        const backBtn = document.getElementById('trail-back-btn');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                const view = window.KGTrailExtend.stepBack();
                if (view) {
                    if (window.KGRenderer) {
                        window.KGRenderer.render(view.nodes, view.edges);
                    }
                    updateTrailPathDisplay();
                } else {
                    // 如果无法回退，显示初始视图
                    if (window.KGViews) {
                        window.KGViews.showInitialView();
                    }
                    updateTrailPathDisplay();
                }
            });
        }
    }
    
    /**
     * 更新线索路径显示
     */
    function updateTrailPathDisplay() {
        const display = document.getElementById('trail-path-display');
        if (!display) return;
        
        if (!window.KGTrailExtend) {
            display.textContent = '线索路径：未初始化';
            return;
        }
        
        const description = window.KGTrailExtend.getTrailDescription();
        display.textContent = `线索路径：${description}`;
    }
    
    /**
     * 处理节点点击（集成到现有系统）
     */
    function handleNodeClick(nodeId) {
        if (!window.KGTrailExtend) {
            console.warn('线索延展模块未加载');
            return;
        }
        
        if (extendMode === 'extend') {
            // 延展模式：累积显示
            try {
                const view = window.KGTrailExtend.extendFromNode(nodeId, extendOptions);
                if (view && view.nodes && view.nodes.length > 0) {
                    if (window.KGRenderer) {
                        window.KGRenderer.render(view.nodes, view.edges || []);
                    }
                    updateTrailPathDisplay();
                }
            } catch (error) {
                console.error('延展节点失败:', error);
            }
        } else {
            // 替换模式：使用原有的视图系统
            if (window.KGViews) {
                const cache = window.KGCache.cache;
                if (!cache) return;
                
                const node = cache.nodeMap.get(nodeId);
                if (!node) return;
                
                const nodeType = node.data.type;
                
                if (nodeType === 'event') {
                    // 判断是事件集还是单个事件
                    const utils = window.KGUtils || {};
                    const isEventSet = node.data.isEventSet || 
                                      (utils.isEventSet && utils.isEventSet(nodeId, cache.allEdges, cache.nodeMap));
                    
                    if (isEventSet) {
                        window.KGViews.showEventSetView(nodeId);
                    } else {
                        window.KGViews.showEventView(nodeId);
                    }
                } else if (nodeType === 'person' || nodeType === 'location') {
                    window.KGViews.showPersonLocationView(nodeId);
                }
            }
        }
    }
    
    /**
     * 修改 vis.js 渲染器的点击处理
     * 注意：不直接替换，而是增强现有逻辑
     */
    function patchVisRenderer() {
        if (!window.KGRendererVis) return;
        
        // 监听网络创建事件
        const checkNetwork = setInterval(() => {
            if (window.__visNetwork) {
                clearInterval(checkNetwork);
                
                // 注意：kg-renderer-vis.js 中已经有点击处理逻辑
                // 我们通过修改 KGViews 的方法来集成延展功能
                // 不需要重复绑定点击事件
                
                console.log('线索延展：已检测到 vis.js 网络，点击处理已集成到 KGViews');
            }
        }, 500);
        
        // 10秒后停止检查
        setTimeout(() => clearInterval(checkNetwork), 10000);
    }
    
    /**
     * 初始化
     */
    function init() {
        // 等待所有模块加载完成
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                setTimeout(init, 500);
            });
            return;
        }
        
        // 延迟初始化，确保其他模块已加载
        setTimeout(() => {
            initTrailExtend();
            patchVisRenderer();
        }, 1000);
    }
    
    // 开始初始化
    init();
    
    // 导出函数供外部调用
    window.KGTrailIntegration = {
        setExtendMode: (mode) => { extendMode = mode; },
        setExtendOptions: (options) => { extendOptions = { ...extendOptions, ...options }; },
        getExtendMode: () => extendMode,
        getExtendOptions: () => extendOptions,
        handleNodeClick: handleNodeClick,
        updateTrailPathDisplay: updateTrailPathDisplay,
        // 重新渲染当前延展视图
        rerenderCurrentView: () => {
            if (!window.KGTrailExtend || !window.KGTrailExtend.currentTrail.length) {
                return;
            }
            
            const currentView = window.KGTrailExtend.getCurrentView();
            if (currentView && currentView.nodes && currentView.nodes.length > 0 && window.KGRenderer) {
                window.KGRenderer.render(currentView.nodes, currentView.edges || []);
                updateTrailPathDisplay();
            }
        }
    };
})();

