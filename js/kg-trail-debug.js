// 线索延展调试工具
// 用于测试和调试线索延展功能

window.KGTrailDebug = {
    /**
     * 检查所有模块是否已加载
     */
    checkModules() {
        const modules = {
            'KGTrailExtend': window.KGTrailExtend,
            'KGTrailIntegration': window.KGTrailIntegration,
            'KGViews': window.KGViews,
            'KGCache': window.KGCache,
            'KGRenderer': window.KGRenderer,
            '__visNetwork': window.__visNetwork
        };
        
        console.log('=== 模块加载检查 ===');
        for (const [name, module] of Object.entries(modules)) {
            console.log(`${name}: ${module ? '✅ 已加载' : '❌ 未加载'}`);
        }
        
        return Object.values(modules).every(m => m !== undefined);
    },
    
    /**
     * 检查延展模式
     */
    checkExtendMode() {
        if (!window.KGTrailIntegration) {
            console.log('❌ KGTrailIntegration 未加载');
            return;
        }
        
        const mode = window.KGTrailIntegration.getExtendMode();
        console.log(`延展模式: ${mode}`);
        console.log(`延展选项:`, window.KGTrailIntegration.getExtendOptions());
        
        return mode;
    },
    
    /**
     * 检查当前视图
     */
    checkCurrentView() {
        if (!window.KGViews) {
            console.log('❌ KGViews 未加载');
            return;
        }
        
        const view = window.KGViews.getCurrentView();
        if (view) {
            console.log('当前视图:', {
                type: view.type,
                centerId: view.centerId,
                nodes: view.nodes ? view.nodes.length : 0,
                edges: view.edges ? view.edges.length : 0
            });
        } else {
            console.log('当前视图: 无');
        }
        
        return view;
    },
    
    /**
     * 检查线索状态
     */
    checkTrail() {
        if (!window.KGTrailExtend) {
            console.log('❌ KGTrailExtend 未加载');
            return;
        }
        
        const description = window.KGTrailExtend.getTrailDescription();
        console.log(`线索路径: ${description}`);
        
        const view = window.KGTrailExtend.getCurrentView();
        if (view) {
            console.log('线索视图:', {
                trail: view.trail,
                nodes: view.nodes ? view.nodes.length : 0,
                edges: view.edges ? view.edges.length : 0
            });
        }
        
        return view;
    },
    
    /**
     * 测试延展节点
     */
    testExtend(nodeId) {
        console.log(`=== 测试延展节点: ${nodeId} ===`);
        
        if (!window.KGTrailExtend) {
            console.error('❌ KGTrailExtend 未加载');
            return;
        }
        
        if (!window.KGCache) {
            console.error('❌ KGCache 未加载');
            return;
        }
        
        const cache = window.KGCache.cache;
        const node = cache.nodeMap.get(nodeId);
        
        if (!node) {
            console.error(`❌ 找不到节点: ${nodeId}`);
            return;
        }
        
        console.log('节点信息:', {
            id: node.data.id,
            label: node.data.label,
            type: node.data.type
        });
        
        // 检查节点的关系
        const relatedEdges = cache.allEdges.filter(e => 
            e.data.source === nodeId || e.data.target === nodeId
        );
        console.log(`节点关系数: ${relatedEdges.length}`);
        
        // 尝试延展
        try {
            const view = window.KGTrailExtend.extendFromNode(nodeId, {
                depth: 1,
                relationTypes: [],
                nodeTypes: [],
                includeSameEvent: true,
                includeOtherEvents: true
            });
            
            if (view) {
                console.log('✅ 延展成功:', {
                    nodes: view.nodes ? view.nodes.length : 0,
                    edges: view.edges ? view.edges.length : 0,
                    trail: view.trail
                });
                
                // 渲染
                if (window.KGRenderer) {
                    window.KGRenderer.render(view.nodes, view.edges || []);
                    console.log('✅ 已渲染');
                } else {
                    console.error('❌ KGRenderer 未加载');
                }
            } else {
                console.error('❌ 延展返回 null');
            }
        } catch (error) {
            console.error('❌ 延展失败:', error);
            console.error(error.stack);
        }
    },
    
    /**
     * 完整诊断
     */
    diagnose() {
        console.log('=== 线索延展功能诊断 ===');
        console.log('');
        
        // 1. 检查模块
        console.log('1. 模块加载检查:');
        const modulesOk = this.checkModules();
        console.log('');
        
        // 2. 检查延展模式
        console.log('2. 延展模式检查:');
        const mode = this.checkExtendMode();
        console.log('');
        
        // 3. 检查当前视图
        console.log('3. 当前视图检查:');
        const view = this.checkCurrentView();
        console.log('');
        
        // 4. 检查线索状态
        console.log('4. 线索状态检查:');
        const trail = this.checkTrail();
        console.log('');
        
        // 5. 检查数据
        if (window.KGCache) {
            const cache = window.KGCache.cache;
            console.log('5. 数据检查:');
            console.log(`  节点总数: ${cache.allNodes.length}`);
            console.log(`  关系总数: ${cache.allEdges.length}`);
            console.log('');
        }
        
        // 总结
        console.log('=== 诊断总结 ===');
        if (modulesOk && mode === 'extend') {
            console.log('✅ 基本配置正常，可以尝试延展');
        } else {
            console.log('❌ 发现问题，请检查上述输出');
        }
        
        return {
            modulesOk,
            mode,
            view,
            trail
        };
    }
};

// 自动诊断（延迟执行，确保所有模块已加载）
setTimeout(() => {
    if (window.KGTrailDebug) {
        console.log('线索延展调试工具已加载，使用 KGTrailDebug.diagnose() 进行诊断');
        console.log('或使用 KGTrailDebug.testExtend(nodeId) 测试延展特定节点');
    }
}, 2000);





























































