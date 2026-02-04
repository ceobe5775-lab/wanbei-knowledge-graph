// 数据加载器 - 从JSON文件加载数据并更新页面
// 重构版本：统一的数据加载管道

let allData = null;
let normalizedData = null;
let categorizedData = null;
let currentDataset = '全部';
let dataCache = {
    raw: null,
    normalized: null,
    categorized: null,
    lastUpdate: null
};

// ==================== 阶段1: 数据加载（优化版 - 懒加载）====================
// 按需加载数据 - 根据页面类型只加载需要的数据
async function loadData(pageType = 'auto') {
    // 自动检测页面类型
    if (pageType === 'auto') {
        const path = window.location.pathname;
        if (path.includes('index.html') || path.endsWith('/') || path === '/') {
            pageType = 'index';
        } else if (path.includes('overview.html')) {
            pageType = 'overview';
        } else if (path.includes('events.html')) {
            pageType = 'events';
        } else if (path.includes('persons.html')) {
            pageType = 'persons';
        } else if (path.includes('knowledgeGraph.html')) {
            pageType = 'knowledgeGraph';
        } else {
            pageType = 'full'; // 其他页面加载完整数据
        }
    }
    
    // 检查内存缓存
    if (dataCache.raw && dataCache.lastUpdate) {
        const cacheAge = Date.now() - dataCache.lastUpdate;
        if (cacheAge < 300000) { // 缓存5分钟有效
            console.log('使用内存缓存数据');
            allData = dataCache.raw;
            return allData;
        }
    }
    
    // 检查IndexedDB缓存
    const dbCache = await getIndexedDBCache();
    if (dbCache && dbCache.data) {
        const dbCacheAge = Date.now() - (dbCache.timestamp || 0);
        if (dbCacheAge < 3600000) { // IndexedDB缓存1小时有效
            console.log('使用IndexedDB缓存数据');
            allData = dbCache.data;
            dataCache.raw = allData;
            dataCache.lastUpdate = Date.now();
            return allData;
        }
    }
    
    try {
        // 显示加载指示器
        showLoadingIndicator();
        
        const startTime = performance.now();
        
        // 根据页面类型决定加载策略
        if (pageType === 'index') {
            // 首页：只加载summary，快速显示
            allData = await loadSummaryOnly();
        } else {
            // 其他页面：加载完整数据
            const response = await fetch('data.json');
            allData = await response.json();
        }
        
        const loadTime = performance.now() - startTime;
        console.log(`数据加载完成，耗时: ${loadTime.toFixed(2)}ms`);
        
        // 更新缓存
        dataCache.raw = allData;
        dataCache.lastUpdate = Date.now();
        
        // 保存到IndexedDB
        await saveToIndexedDB(allData);
        
        // 隐藏加载指示器
        hideLoadingIndicator();
        
        // 显示成功提示（仅在非首页且首次加载时）
        if (pageType !== 'index' && typeof window.toast !== 'undefined') {
            window.toast.success('数据加载成功', 2000);
        }
        
        return allData;
    } catch (error) {
        console.error('数据加载失败:', error);
        hideLoadingIndicator();
        
        // 显示错误提示
        if (typeof window.toast !== 'undefined') {
            window.toast.error('数据加载失败，请刷新页面重试', 5000);
        }
        
        // 显示错误状态UI
        showErrorState('数据加载失败', '无法从服务器加载数据，请检查网络连接后重试。', () => {
            window.location.reload();
        });
        
        // 使用示例数据
        allData = getSampleData();
        return allData;
    }
}

// 只加载summary数据（用于首页快速显示）
async function loadSummaryOnly() {
    try {
        // 尝试只加载summary部分
        const response = await fetch('data.json');
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let result = '';
        let summaryFound = false;
        
        // 流式读取，找到summary后停止
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            result += decoder.decode(value, { stream: true });
            
            // 检查是否找到summary
            if (result.includes('"summary"') && !summaryFound) {
                summaryFound = true;
                // 尝试提取summary部分（简化处理）
            }
            
            // 如果已经读取足够的数据（前50KB），尝试解析
            if (result.length > 50000) {
                break;
            }
        }
        
        // 如果流式读取失败，回退到完整加载
        const fullResponse = await fetch('data.json');
        const fullData = await fullResponse.json();
        
        // 返回只包含summary的简化数据
        return {
            combined: {
                summary: fullData.combined?.summary || fullData.summary || {},
                nodes: [], // 首页不需要节点详情
                relationships: []
            },
            summary: fullData.combined?.summary || fullData.summary || {}
        };
    } catch (error) {
        console.warn('快速加载失败，使用完整加载:', error);
        const response = await fetch('data.json');
        return await response.json();
    }
}

// IndexedDB缓存管理
let dbInstance = null;

async function initIndexedDB() {
    if (dbInstance) return dbInstance;
    
    // 检查浏览器是否支持IndexedDB
    if (!window.indexedDB) {
        console.warn('浏览器不支持IndexedDB');
        return null;
    }
    
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('KGDataCache', 1);
        
        request.onerror = (event) => {
            // 可能是Tracking Prevention阻止了访问，静默失败
            // 不影响正常功能，只是无法使用缓存
            if (event.target.error && event.target.error.name !== 'SecurityError') {
                console.warn('IndexedDB初始化失败，将使用内存缓存:', event.target.error.message);
            }
            resolve(null);
        };
        
        request.onsuccess = () => {
            dbInstance = request.result;
            resolve(dbInstance);
        };
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('dataCache')) {
                db.createObjectStore('dataCache', { keyPath: 'key' });
            }
        };
    });
}

async function saveToIndexedDB(data) {
    try {
        const db = await initIndexedDB();
        if (!db) {
            // IndexedDB不可用（可能是Tracking Prevention），跳过缓存
            return;
        }
        
        const transaction = db.transaction(['dataCache'], 'readwrite');
        const store = transaction.objectStore('dataCache');
        await store.put({
            key: 'mainData',
            data: data,
            timestamp: Date.now()
        });
        console.log('数据已保存到IndexedDB');
    } catch (error) {
        // Tracking Prevention或其他错误，静默失败
        // 不影响正常功能，只是无法使用缓存
        if (error.name !== 'SecurityError' && error.name !== 'QuotaExceededError') {
            console.warn('保存到IndexedDB失败:', error.message);
        }
    }
}

async function getIndexedDBCache() {
    try {
        const db = await initIndexedDB();
        if (!db) return null;
        
        const transaction = db.transaction(['dataCache'], 'readonly');
        const store = transaction.objectStore('dataCache');
        const request = store.get('mainData');
        
        return new Promise(async (resolve) => {
            request.onsuccess = async () => {
                const result = request.result;
                if (result && result.data) {
                    // 验证缓存数据的有效性
                    const data = result.data;
                    const eventsCount = data.combined?.events?.length || 0;
                    const nodesCount = data.combined?.nodes?.length || 0;
                    
                    // 如果缓存数据为空或事件数为0，认为缓存无效
                    if (eventsCount === 0 && nodesCount === 0) {
                        console.warn('IndexedDB缓存数据无效（事件数和节点数都为0），将清除缓存并重新加载');
                        await clearIndexedDBCache();
                        resolve(null);
                        return;
                    }
                    
                    console.log(`IndexedDB缓存验证通过: events=${eventsCount}, nodes=${nodesCount}`);
                }
                resolve(result);
            };
            request.onerror = (event) => {
                // 可能是Tracking Prevention，静默失败
                resolve(null);
            };
        });
    } catch (error) {
        // Tracking Prevention或其他错误，静默失败
        // 不影响正常功能，只是无法使用缓存
        if (error.name !== 'SecurityError') {
            console.warn('从IndexedDB读取失败:', error.message);
        }
        return null;
    }
}

// 清除IndexedDB缓存
async function clearIndexedDBCache() {
    try {
        const db = await initIndexedDB();
        if (!db) return;
        
        const transaction = db.transaction(['dataCache'], 'readwrite');
        const store = transaction.objectStore('dataCache');
        await store.delete('mainData');
        console.log('IndexedDB缓存已清除');
    } catch (error) {
        if (error.name !== 'SecurityError') {
            console.warn('清除IndexedDB缓存失败:', error.message);
        }
    }
}

// 加载指示器
function showLoadingIndicator() {
    // 移除现有的加载指示器
    let loader = document.getElementById('data-loading-indicator');
    if (loader) return;
    
    loader = document.createElement('div');
    loader.id = 'data-loading-indicator';
    loader.innerHTML = `
        <div class="loading-overlay">
            <div class="loading-spinner">
                <div class="spinner-ring"></div>
                <div class="spinner-ring"></div>
                <div class="spinner-ring"></div>
            </div>
            <p class="loading-text">正在加载数据...</p>
        </div>
    `;
    document.body.appendChild(loader);
}

function hideLoadingIndicator() {
    const loader = document.getElementById('data-loading-indicator');
    if (loader) {
        loader.style.opacity = '0';
        loader.style.transition = 'opacity 0.3s ease';
        setTimeout(() => {
            if (loader.parentNode) {
                loader.parentNode.removeChild(loader);
            }
        }, 300);
    }
}

// 获取示例数据（如果JSON文件不存在）
function getSampleData() {
    return {
        datasets: [],
        combined: {
            summary: {
                total_nodes: 2065,
                total_relationships: 5000,
                events: 100,
                persons: 500,
                locations: 800,
                times: 200
            }
        }
    };
}

// ==================== 阶段2: 数据标准化 ====================
// 标准化数据格式，确保数据结构一致
function normalizeData(rawData) {
    if (!rawData) {
        console.warn('normalizeData: 输入数据为空');
        return null;
    }
    
    // 添加调试日志
    console.log('normalizeData: 开始标准化，rawData结构:', {
        hasCombined: !!rawData.combined,
        combinedKeys: rawData.combined ? Object.keys(rawData.combined) : [],
        combinedEventsLength: rawData.combined?.events?.length || 0,
        combinedNodesLength: rawData.combined?.nodes?.length || 0,
        rawDataKeys: Object.keys(rawData)
    });
    
    // 检查缓存
    if (dataCache.normalized && dataCache.raw === rawData) {
        return dataCache.normalized;
    }
    
    const normalized = {
        nodes: [],
        relationships: [],
        summary: {},
        eventSets: [],
        events: [],
        persons: [],
        locations: [],
        times: []
    };
    
    // 获取combined数据
    const combined = rawData.combined || rawData;
    
    console.log('normalizeData: combined数据检查:', {
        hasEvents: !!combined.events,
        eventsLength: combined.events?.length || 0,
        hasNodes: !!combined.nodes,
        nodesLength: combined.nodes?.length || 0,
        combinedType: Array.isArray(combined) ? 'array' : typeof combined
    });
    
    // 标准化节点
    if (combined.nodes && Array.isArray(combined.nodes)) {
        normalized.nodes = combined.nodes.map(node => ({
            id: node.id || node.properties?.id || '',
            labels: node.labels || [],
            properties: node.properties || {},
            type: getNodeType(node.labels || [])
        }));
    }
    
    // 标准化关系
    if (combined.relationships && Array.isArray(combined.relationships)) {
        normalized.relationships = combined.relationships.map(rel => ({
            id: rel.id || `${rel.source || rel.start}-${rel.target || rel.end}`,
            source: rel.source || rel.start || '',
            target: rel.target || rel.end || '',
            type: rel.type || rel.label || '',
            properties: rel.properties || {}
        }));
    }
    
    // 优先使用combined中已有的events、persons、locations数组
    if (combined.events && Array.isArray(combined.events)) {
        normalized.events = combined.events.map(event => ({
            id: event.id || event.properties?.id || '',
            labels: event.labels || ['事件'],
            properties: event.properties || {},
            type: 'event'
        }));
    }
    
    if (combined.persons && Array.isArray(combined.persons)) {
        normalized.persons = combined.persons.map(person => ({
            id: person.id || person.properties?.id || '',
            labels: person.labels || ['人物'],
            properties: person.properties || {},
            type: 'person'
        }));
    }
    
    if (combined.locations && Array.isArray(combined.locations)) {
        normalized.locations = combined.locations.map(location => ({
            id: location.id || location.properties?.id || '',
            labels: location.labels || ['地点'],
            properties: location.properties || {},
            type: 'location'
        }));
    }
    
    if (combined.times && Array.isArray(combined.times)) {
        normalized.times = combined.times.map(time => ({
            id: time.id || time.properties?.id || '',
            labels: time.labels || ['时间'],
            properties: time.properties || {},
            type: 'time'
        }));
    }
    
    // 如果combined中没有这些数组，则从nodes中分类
    if (normalized.events.length === 0 && normalized.persons.length === 0 && normalized.locations.length === 0) {
        normalized.nodes.forEach(node => {
            if (node.type === 'event') {
                normalized.events.push(node);
            } else if (node.type === 'person') {
                normalized.persons.push(node);
            } else if (node.type === 'location') {
                normalized.locations.push(node);
            } else if (node.type === 'time') {
                normalized.times.push(node);
            } else if (node.type === 'eventSet') {
                normalized.eventSets.push(node);
            }
        });
    }
    
    // 标准化summary，优先使用combined.summary
    normalized.summary = combined.summary || {
        total_nodes: normalized.nodes.length,
        total_relationships: normalized.relationships.length,
        events: normalized.events.length,
        persons: normalized.persons.length,
        locations: normalized.locations.length,
        times: normalized.times.length,
        event_sets: normalized.eventSets.length
    };
    
    // 如果summary存在但字段不完整，补充缺失的字段
    if (combined.summary) {
        normalized.summary = {
            ...normalized.summary,
            events: normalized.summary.events || normalized.events.length,
            persons: normalized.summary.persons || normalized.persons.length,
            locations: normalized.summary.locations || normalized.locations.length,
            times: normalized.summary.times || normalized.times.length,
            total_nodes: normalized.summary.total_nodes || normalized.nodes.length,
            total_relationships: normalized.summary.total_relationships || normalized.relationships.length,
            event_sets: normalized.summary.event_sets || normalized.eventSets.length
        };
    }
    
    // 更新缓存
    dataCache.normalized = normalized;
    normalizedData = normalized;
    // 暴露到全局，方便其他脚本使用
    window.normalizedData = normalized;
    
    console.log('数据标准化完成:', {
        nodes: normalized.nodes.length,
        relationships: normalized.relationships.length,
        events: normalized.events.length,
        persons: normalized.persons.length,
        locations: normalized.locations.length
    });
    
    return normalized;
}

// 获取节点类型
function getNodeType(labels) {
    if (!Array.isArray(labels)) return 'unknown';
    
    if (labels.includes('事件集')) return 'eventSet';
    if (labels.includes('事件') || labels.includes('Event')) return 'event';
    if (labels.includes('人物') || labels.includes('Person')) return 'person';
    if (labels.includes('地点') || labels.includes('Location')) return 'location';
    if (labels.includes('时间') || labels.includes('Time')) return 'time';
    
    return 'unknown';
}

// ==================== 阶段3: 数据分类 ====================
// 按时间、事件集、地理等维度分类数据
function categorizeData(normalized) {
    if (!normalized) {
        console.warn('categorizeData: 输入数据为空');
        return null;
    }
    
    // 检查缓存
    if (dataCache.categorized && dataCache.normalized === normalized) {
        return dataCache.categorized;
    }
    
    const categorized = {
        byTime: {
            ancient: [],      // 古代（如淝水之战）
            modern: [],        // 近代（如花园口决堤）
            contemporary: []   // 现代（如双堆集歼灭战）
        },
        byEventSet: {},
        byLocation: {
            wanbei: [],        // 皖北地区
            related: []        // 相关地区
        },
        byPriority: {
            core: [],          // 核心信息（事件、事件集）
            secondary: [],     // 次要信息（人物、地点）
            auxiliary: []      // 辅助信息（关系统计等）
        }
    };
    
    // 按时间分类事件
    normalized.events.forEach(event => {
        const timeStr = event.properties.发生时间 || event.properties.时间 || '';
        const eventName = event.properties.名称 || event.properties.name || '';
        
        // 判断时间范围
        if (timeStr.includes('公元') || timeStr.includes('年') && parseInt(timeStr) < 1900) {
            categorized.byTime.ancient.push(event);
        } else if (timeStr.includes('193') || timeStr.includes('194') || timeStr.includes('195')) {
            categorized.byTime.contemporary.push(event);
        } else {
            categorized.byTime.modern.push(event);
        }
    });
    
    // 按事件集分类
    normalized.eventSets.forEach(eventSet => {
        const eventSetName = eventSet.properties.名称 || eventSet.properties.name || '';
        categorized.byEventSet[eventSetName] = {
            eventSet: eventSet,
            events: [],
            persons: [],
            locations: []
        };
    });
    
    // 将事件关联到事件集
    normalized.events.forEach(event => {
        // 通过关系找到所属事件集
        normalized.relationships.forEach(rel => {
            if (rel.target === event.id && rel.type === '包含') {
                const eventSet = normalized.eventSets.find(es => es.id === rel.source);
                if (eventSet) {
                    const eventSetName = eventSet.properties.名称 || eventSet.properties.name || '';
                    if (categorized.byEventSet[eventSetName]) {
                        categorized.byEventSet[eventSetName].events.push(event);
                    }
                }
            }
        });
    });
    
    // 按优先级分类
    normalized.eventSets.forEach(es => categorized.byPriority.core.push(es));
    normalized.events.forEach(e => categorized.byPriority.core.push(e));
    normalized.persons.forEach(p => categorized.byPriority.secondary.push(p));
    normalized.locations.forEach(l => categorized.byPriority.secondary.push(l));
    
    // 更新缓存
    dataCache.categorized = categorized;
    categorizedData = categorized;
    
    console.log('数据分类完成:', {
        byTime: {
            ancient: categorized.byTime.ancient.length,
            modern: categorized.byTime.modern.length,
            contemporary: categorized.byTime.contemporary.length
        },
        byEventSet: Object.keys(categorized.byEventSet).length
    });
    
    return categorized;
}

// ==================== 阶段4: 数据验证 ====================
// 验证数据完整性
function validateData(normalized) {
    if (!normalized) return false;
    
    const issues = [];
    
    // 检查节点ID唯一性
    const nodeIds = new Set();
    normalized.nodes.forEach(node => {
        if (!node.id) {
            issues.push(`节点缺少ID: ${JSON.stringify(node)}`);
        } else if (nodeIds.has(node.id)) {
            issues.push(`重复的节点ID: ${node.id}`);
        } else {
            nodeIds.add(node.id);
        }
    });
    
    // 检查关系引用完整性（只记录警告，不阻止加载）
    // 因为数据可能不完整，有些节点可能缺失
    const missingNodes = new Set();
    normalized.relationships.forEach(rel => {
        if (!nodeIds.has(rel.source)) {
            missingNodes.add(rel.source);
        }
        if (!nodeIds.has(rel.target)) {
            missingNodes.add(rel.target);
        }
    });
    
    if (missingNodes.size > 0) {
        // 只记录前10个缺失的节点，避免日志过长
        const missingList = Array.from(missingNodes).slice(0, 10);
        console.warn(`数据验证发现 ${missingNodes.size} 个关系引用了不存在的节点（前10个）:`, missingList);
        if (missingNodes.size > 10) {
            console.warn(`... 还有 ${missingNodes.size - 10} 个缺失节点未显示`);
        }
        // 不返回false，允许继续处理（数据可能不完整）
    }
    
    if (issues.length > 0) {
        console.warn('数据验证发现问题:', issues.slice(0, 10));
        if (issues.length > 10) {
            console.warn(`... 还有 ${issues.length - 10} 个问题未显示`);
        }
        // 只对严重问题返回false（如节点缺少ID）
        const criticalIssues = issues.filter(issue => issue.includes('节点缺少ID'));
        if (criticalIssues.length > 0) {
            console.error('发现严重问题：节点缺少ID');
            return false;
        }
    }
    
    if (issues.length === 0 && missingNodes.size === 0) {
        console.log('数据验证通过');
    }
    return true;
}

// ==================== 统一数据加载管道 ====================
// 完整的数据加载流程
async function loadDataPipeline(pageType = 'auto') {
    try {
        // 阶段1: 加载原始数据（按需加载）
        const rawData = await loadData(pageType);
        
        // 如果只是summary数据，跳过标准化和分类（首页快速显示）
        if (pageType === 'index' && (!rawData.combined?.nodes || rawData.combined.nodes.length === 0)) {
            return {
                raw: rawData,
                normalized: null,
                categorized: null,
                isSummaryOnly: true
            };
        }
        
        // 阶段2: 标准化数据（延迟执行，避免阻塞）
        const normalized = await delayExecute(() => normalizeData(rawData), 0);
        if (!normalized) {
            throw new Error('数据标准化失败');
        }
        
        // 阶段3: 验证数据（异步执行）
        await delayExecute(() => {
            if (!validateData(normalized)) {
                console.warn('数据验证未通过，但继续处理');
            }
        }, 0);
        
        // 阶段4: 分类数据（延迟执行）
        const categorized = await delayExecute(() => categorizeData(normalized), 0);
        
        return {
            raw: rawData,
            normalized: normalized,
            categorized: categorized,
            isSummaryOnly: false
        };
    } catch (error) {
        console.error('数据加载管道错误:', error);
        hideLoadingIndicator();
        return null;
    }
}

// 延迟执行函数，避免阻塞主线程
function delayExecute(fn, delay = 0) {
    return new Promise((resolve) => {
        setTimeout(() => {
            try {
                const result = fn();
                resolve(result);
            } catch (error) {
                console.error('延迟执行错误:', error);
                resolve(null);
            }
        }, delay);
    });
}

// ==================== 性能优化工具函数 ====================
// 防抖函数 - 延迟执行，只执行最后一次
function debounce(func, wait = 300) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// 节流函数 - 限制执行频率
function throttle(func, limit = 300) {
    let inThrottle;
    return function executedFunction(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// 使用requestAnimationFrame优化渲染
function rafThrottle(func) {
    let rafId = null;
    return function executedFunction(...args) {
        if (rafId === null) {
            rafId = requestAnimationFrame(() => {
                func.apply(this, args);
                rafId = null;
            });
        }
    };
}

// 获取当前数据集的数据（保持向后兼容）
function getCurrentData() {
    if (!normalizedData) {
        // 如果没有标准化数据，使用旧逻辑
        if (!allData) return null;
        
        if (currentDataset === '全部') {
            return allData.combined || allData;
        }
        
        const dataset = allData.datasets ? allData.datasets.find(d => d.dataset === currentDataset) : null;
        return dataset || allData.combined || allData;
    }
    
    // 返回标准化后的数据
    return normalizedData;
}

// 更新数据概览页面（使用优先级体系 + 性能优化）
const updateOverviewPage = rafThrottle(function() {
    // 如果没有数据，尝试重新加载
    if (!allData && !normalizedData) {
        console.warn('updateOverviewPage: 数据未加载，尝试重新加载...');
        // 异步加载，不阻塞
        loadDataPipeline('full').then(() => {
            if (normalizedData || allData) {
                updateOverviewPage();
            }
        });
        return;
    }
    
    const data = getCurrentData();
    if (!data) {
        console.warn('updateOverviewPage: 没有数据');
        return;
    }
    
    // 优先使用标准化数据的summary
    let stats = null;
    if (normalizedData && normalizedData.summary) {
        stats = normalizedData.summary;
    } else if (allData && allData.summary) {
        stats = allData.summary;
    } else if (data.summary) {
        stats = data.summary;
    } else if (data.combined && data.combined.summary) {
        stats = data.combined.summary;
    }
    
    // 若没有 summary，则动态计算
    if (!stats || Object.keys(stats).length === 0) {
        const nodes = normalizedData ? normalizedData.nodes : (data.nodes || data.combined?.nodes || []);
        const rels = normalizedData ? normalizedData.relationships : (data.relationships || data.combined?.relationships || []);
        const events = normalizedData ? normalizedData.events.length : (data.events?.length || data.combined?.events?.length || nodes.filter(n => n.labels && n.labels.includes('事件')).length);
        const persons = normalizedData ? normalizedData.persons.length : (data.persons?.length || data.combined?.persons?.length || nodes.filter(n => n.labels && n.labels.includes('人物')).length);
        const locations = normalizedData ? normalizedData.locations.length : (data.locations?.length || data.combined?.locations?.length || nodes.filter(n => n.labels && n.labels.includes('地点')).length);
        stats = {
            events,
            persons,
            locations,
            times: normalizedData ? normalizedData.times.length : (data.times?.length || data.combined?.times?.length || 0),
            total_relationships: rels.length,
            total_nodes: nodes.length,
            event_sets: normalizedData ? normalizedData.eventSets.length : 0
        };
    }
    
    console.log('updateOverviewPage stats:', stats);

    // 更新统计数据，按 data-type 定位（优先级顺序）
    const setStat = (type, val) => {
        const el = document.querySelector(`.stat-value[data-type="${type}"]`);
        if (el) {
            el.setAttribute('data-target', val);
            updateStatValue(`.stat-value[data-type="${type}"]`, val);
        }
    };
    
    // 第一优先级：核心信息（事件、事件集）
    setStat('events', stats.events || 0);
    if (stats.event_sets) {
        const eventSetEl = document.querySelector(`.stat-value[data-type="event_sets"]`);
        if (eventSetEl) {
            eventSetEl.setAttribute('data-target', stats.event_sets);
            updateStatValue(`.stat-value[data-type="event_sets"]`, stats.event_sets);
        }
    }
    
    // 第二优先级：次要信息（人物、地点）
    setStat('persons', stats.persons || 0);
    setStat('locations', stats.locations || 0);
    
    // 第三优先级：辅助信息（时间、关系、总数）
    setStat('times', stats.times || 0);
    setStat('relationships', stats.total_relationships || 0);
    setStat('total_nodes', stats.total_nodes || 0);
    
    // 如果有分类数据，显示事件集概览
    if (categorizedData && categorizedData.byEventSet) {
        updateEventSetOverview();
    }
});

// 更新事件集概览
function updateEventSetOverview() {
    const eventSetContainer = document.querySelector('.event-sets-overview');
    if (!eventSetContainer || !categorizedData) return;
    
    eventSetContainer.innerHTML = '';
    
    const eventSetNames = Object.keys(categorizedData.byEventSet);
    
    eventSetNames.forEach(eventSetName => {
        const eventSetData = categorizedData.byEventSet[eventSetName];
        const card = document.createElement('div');
        card.className = 'event-set-card';
        card.style.cssText = 'background: white; padding: 1.5rem; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); transition: all 0.3s ease;';
        card.innerHTML = `
            <h4 style="margin-bottom: 1rem; font-size: 1.3rem; color: #1f2937;">${eventSetName}</h4>
            <div class="event-set-stats" style="display: flex; gap: 1rem; margin-bottom: 1rem; font-size: 0.9rem; color: #6b7280;">
                <span>${eventSetData.events.length} 个事件</span>
                <span>${eventSetData.persons.length} 个人物</span>
                <span>${eventSetData.locations.length} 个地点</span>
            </div>
            <a href="events.html?eventSet=${encodeURIComponent(eventSetName)}" class="event-set-link" style="color: #2563eb; text-decoration: none; font-weight: 500;">查看详情 →</a>
        `;
        
        card.addEventListener('mouseenter', () => {
            card.style.transform = 'translateY(-5px)';
            card.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
        });
        
        card.addEventListener('mouseleave', () => {
            card.style.transform = 'translateY(0)';
            card.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
        });
        
        eventSetContainer.appendChild(card);
    });
    
    // 更新筛选器中的事件集选项
    updateFilterOptions();
}

// 更新筛选器选项（防抖优化）
const updateFilterOptions = debounce(function() {
    const eventSetFilter = document.getElementById('event-set-filter');
    if (!eventSetFilter || !categorizedData) return;
    
    // 清空现有选项（保留"全部"）
    while (eventSetFilter.children.length > 1) {
        eventSetFilter.removeChild(eventSetFilter.lastChild);
    }
    
    const eventSetNames = Object.keys(categorizedData.byEventSet);
    eventSetNames.forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        eventSetFilter.appendChild(option);
    });
    
    // 绑定筛选事件
    bindFilterEvents();
}, 100);

// 绑定筛选事件
function bindFilterEvents() {
    const applyBtn = document.getElementById('apply-filters');
    const resetBtn = document.getElementById('reset-filters');
    
    if (applyBtn) {
        // 使用防抖优化
        applyBtn.addEventListener('click', debounce(applyFilters, 300));
    }
    
    if (resetBtn) {
        resetBtn.addEventListener('click', resetFilters);
    }
}

// 应用筛选（防抖优化）
const applyFilters = debounce(function() {
    const timeFilter = document.getElementById('time-filter')?.value || 'all';
    const eventSetFilter = document.getElementById('event-set-filter')?.value || 'all';
    const typeFilter = document.getElementById('type-filter')?.value || 'all';
    
    console.log('应用筛选:', { timeFilter, eventSetFilter, typeFilter });
    
    // 获取当前数据
    const data = getCurrentData();
    if (!data) {
        if (typeof window.toast !== 'undefined') {
            window.toast.warning('数据未加载，请稍候再试', 3000);
        }
        return;
    }
    
    // 筛选数据
    let filteredData = {
        events: [],
        persons: [],
        locations: [],
        nodes: [],
        relationships: []
    };
    
    // 获取标准化数据
    const normalized = normalizedData || (data.nodes ? { nodes: data.nodes, events: data.events || [], persons: data.persons || [], locations: data.locations || [] } : null);
    
    if (!normalized) {
        if (typeof window.toast !== 'undefined') {
            window.toast.warning('数据格式不正确，无法筛选', 3000);
        }
        return;
    }
    
    // 按类型筛选
    if (typeFilter === 'events' || typeFilter === 'all') {
        filteredData.events = normalized.events || [];
    }
    if (typeFilter === 'persons' || typeFilter === 'all') {
        filteredData.persons = normalized.persons || [];
    }
    if (typeFilter === 'locations' || typeFilter === 'all') {
        filteredData.locations = normalized.locations || [];
    }
    
    // 按时间筛选
    if (timeFilter !== 'all' && normalized.events) {
        filteredData.events = filteredData.events.filter(event => {
            const props = event.properties || {};
            const date = props.日期 || props.date || props.时间 || '';
            if (!date) return true; // 没有日期信息的保留
            
            const year = parseInt(date.split('-')[0] || date.split('/')[0] || '0');
            if (isNaN(year)) return true;
            
            if (timeFilter === 'ancient') return year < 1840;
            if (timeFilter === 'modern') return year >= 1840 && year < 1949;
            if (timeFilter === 'contemporary') return year >= 1949;
            return true;
        });
    }
    
    // 按事件集筛选
    if (eventSetFilter !== 'all' && categorizedData && categorizedData.byEventSet) {
        const eventSetData = categorizedData.byEventSet[eventSetFilter];
        if (eventSetData) {
            const eventSetEventIds = new Set(eventSetData.events.map(e => e.id));
            filteredData.events = filteredData.events.filter(e => eventSetEventIds.has(e.id));
        }
    }
    
    // 更新显示
    updateFilteredDisplay(filteredData);
    
    // 显示筛选结果提示
    const totalCount = filteredData.events.length + filteredData.persons.length + filteredData.locations.length;
    if (typeof window.toast !== 'undefined') {
        window.toast.info(`筛选结果：找到 ${totalCount} 项`, 2000);
    }
    
    // 更新筛选状态
    const filterStatus = document.querySelector('.filter-status');
    if (filterStatus) {
        filterStatus.textContent = `筛选条件：时间=${timeFilter}, 事件集=${eventSetFilter}, 类型=${typeFilter} (${totalCount}项)`;
    }
}, 300);

// 更新筛选后的显示
function updateFilteredDisplay(filteredData) {
    // 更新概览页面的统计
    if (document.querySelector('.stats-section')) {
        updateOverviewPageWithFilteredData(filteredData);
    }
    
    // 更新事件页面
    if (document.querySelector('.timeline-container')) {
        updateEventsPageWithFilteredData(filteredData);
    }
    
    // 更新人物页面
    if (document.querySelector('.person-cards')) {
        updatePersonsPageWithFilteredData(filteredData);
    }
}

function updateOverviewPageWithFilteredData(filteredData) {
    const setStat = (type, val) => {
        const el = document.querySelector(`.stat-value[data-type="${type}"]`);
        if (el) {
            el.setAttribute('data-target', val);
            updateStatValue(`.stat-value[data-type="${type}"]`, val);
        }
    };
    
    setStat('events', filteredData.events.length);
    setStat('persons', filteredData.persons.length);
    setStat('locations', filteredData.locations.length);
}

function updateEventsPageWithFilteredData(filteredData) {
    const timelineContainer = document.querySelector('.timeline-container');
    if (!timelineContainer) return;
    
    timelineContainer.innerHTML = '';
    
    filteredData.events.slice(0, 20).forEach(event => {
        const item = createTimelineItem(event);
        timelineContainer.appendChild(item);
    });
}

function updatePersonsPageWithFilteredData(filteredData) {
    const personCards = document.querySelector('.person-cards');
    if (!personCards) return;
    
    personCards.innerHTML = '';
    
    filteredData.persons.slice(0, 20).forEach(person => {
        const props = person.properties || {};
        const personName = props.姓名 || props.name || '未知人物';
        const personRole = props.身份 || props.角色 || props.战役 || '历史人物';
        const firstChar = personName.charAt(0);
        
        const card = document.createElement('div');
        card.className = 'person-card';
        card.innerHTML = `
            <div class="person-avatar">${firstChar}</div>
            <div class="person-info">
                <h3>${personName}</h3>
                <p class="person-role">${personRole}</p>
                <div class="person-tags">
                    <span class="tag">人物</span>
                </div>
            </div>
            <a href="personDetail.html?id=${person.id}" class="person-link">查看详情</a>
        `;
        personCards.appendChild(card);
    });
}

// 重置筛选
function resetFilters() {
    const timeFilter = document.getElementById('time-filter');
    const eventSetFilter = document.getElementById('event-set-filter');
    const typeFilter = document.getElementById('type-filter');
    
    if (timeFilter) timeFilter.value = 'all';
    if (eventSetFilter) eventSetFilter.value = 'all';
    if (typeFilter) typeFilter.value = 'all';
    
    // 重新渲染原始数据
    renderData();
    
    // 显示提示
    if (typeof window.toast !== 'undefined') {
        window.toast.info('筛选已重置', 2000);
    }
    
    const filterStatus = document.querySelector('.filter-status');
    if (filterStatus) {
        filterStatus.textContent = '未应用筛选';
    }
}

// 计算事件的重要性得分（用于排序，不用于过滤）
function getEventImportanceScore(event) {
    const props = event.properties || {};
    const eventName = props.名称 || props.name || props.事件名称 || '';
    const eventDesc = props.描述 || props.description || '';
    
    // 重要性评分
    let score = 0;
    
    // 1. 有详细描述的事件（描述长度 > 30字符）
    if (eventDesc && eventDesc.length > 30) {
        score += 3;
    } else if (eventDesc && eventDesc.length > 20) {
        score += 2;
    } else if (eventDesc) {
        score += 1;
    }
    
    // 2. 事件名称包含重要关键词
    const importantKeywords = [
        '战役', '决战', '会战', '大捷', '歼灭', '合围',
        '起义', '解放', '攻占', '围攻', '收复', '光复',
        '大战', '决战', '围困', '突围', '突围战'
    ];
    for (const keyword of importantKeywords) {
        if (eventName.includes(keyword)) {
            score += 2;
            break;
        }
    }
    
    // 3. 事件名称包含重要历史人物或地点（重要战役通常有明确的地名或人名）
    const importantPatterns = [
        /(淮海|徐州|宿州|亳州|阜阳|颍州|蚌埠).*(战役|会战|战斗)/,
        /(项羽|刘邦|韩信|张乐行|李自成|黄巢|捻军).*/,
        /(解放|光复|收复).*(城|县|州)/
    ];
    for (const pattern of importantPatterns) {
        if (pattern.test(eventName)) {
            score += 1;
            break;
        }
    }
    
    return score;
}

// 从事件名称推断时间段（当没有时间字段时使用）
function inferTimePeriodFromName(eventName) {
    if (!eventName) return '未知';
    
    // 现代/当代（1949年后）
    if (eventName.includes('解放') || eventName.includes('解放军') || 
        eventName.includes('新四军') || eventName.includes('八路军')) {
        return '现代';
    }
    
    // 民国/抗战（1912-1949）
    if (eventName.includes('抗日') || eventName.includes('日军') || 
        eventName.includes('国民党') || eventName.includes('国军')) {
        return '民国';
    }
    
    // 清朝（1644-1912）
    if (eventName.includes('捻军') || eventName.includes('太平军') || 
        eventName.includes('清军')) {
        return '清';
    }
    
    // 明朝（1368-1644）
    if (eventName.includes('明军') || eventName.includes('闯王') || 
        eventName.includes('李自成')) {
        return '明';
    }
    
    // 宋元（960-1368）
    if (eventName.includes('宋') || eventName.includes('元军')) {
        return '宋元';
    }
    
    // 隋唐（581-907）
    if (eventName.includes('唐') || eventName.includes('隋')) {
        return '隋唐';
    }
    
    // 魏晋南北朝（220-581）
    if (eventName.includes('晋') || eventName.includes('魏') || 
        eventName.includes('南北朝') || eventName.includes('北朝') || 
        eventName.includes('南朝')) {
        return '魏晋南北朝';
    }
    
    // 汉（前202-220）
    if (eventName.includes('汉') || eventName.includes('刘邦') || 
        eventName.includes('项羽') || eventName.includes('韩信') ||
        eventName.includes('楚汉') || eventName.includes('西汉') || 
        eventName.includes('东汉')) {
        return '汉';
    }
    
    // 秦汉（前221-前202）
    if (eventName.includes('秦') || eventName.includes('始皇')) {
        return '秦汉';
    }
    
    // 先秦（前221年以前）
    if (eventName.includes('春秋') || eventName.includes('战国') || 
        eventName.includes('周') || eventName.includes('楚') && !eventName.includes('汉')) {
        return '先秦';
    }
    
    return '未知';
}

// 获取时间段标识（用于分组）
function getTimePeriod(year) {
    if (year < -221) return '先秦';
    if (year < 0) return '秦汉';
    if (year < 220) return '汉';
    if (year < 581) return '魏晋南北朝';
    if (year < 907) return '隋唐';
    if (year < 1279) return '宋元';
    if (year < 1644) return '明';
    if (year < 1912) return '清';
    if (year < 1949) return '民国';
    return '现代';
}

// 解析时间字符串，提取年份用于排序
function parseEventTime(timeStr) {
    if (!timeStr) return { year: 0, sortKey: 0 };
    
    // 匹配各种时间格式：公元前495年、公元467年、1938年6月、1949年1月20日等
    const patterns = [
        /公元前\s*(\d+)/,  // 公元前495年
        /公元\s*(\d+)/,    // 公元467年
        /(\d{4})\s*年/,    // 1938年
        /(\d{4})/          // 1938
    ];
    
    for (const pattern of patterns) {
        const match = timeStr.match(pattern);
        if (match) {
            let year = parseInt(match[1]);
            // 如果是公元前，年份取负值
            if (timeStr.includes('公元前') || timeStr.includes('前')) {
                year = -year;
            }
            return { year: year, sortKey: year };
        }
    }
    
    return { year: 0, sortKey: 0 };
}

// 更新全部事件页面（显示所有事件，不过滤重要性）
const updateAllEventsPage = rafThrottle(function() {
    const data = getCurrentData();
    if (!data) {
        console.warn('updateAllEventsPage: 数据未加载');
        return;
    }
    
    // 优先使用标准化数据
    let events = [];
    if (normalizedData && normalizedData.events && normalizedData.events.length > 0) {
        events = normalizedData.events;
    } else if (data.combined && data.combined.events && data.combined.events.length > 0) {
        events = data.combined.events;
    } else if (data.events && data.events.length > 0) {
        events = data.events;
    } else {
        console.warn('updateAllEventsPage: 未找到事件数据');
        return;
    }
    
    const timelineContainer = document.querySelector('.timeline-container') || document.querySelector('.timeline-section');
    if (!timelineContainer) {
        console.warn('updateAllEventsPage: 未找到时间轴容器');
        return;
    }
    
    // 清空现有内容
    timelineContainer.innerHTML = '';
    
    console.log('updateAllEventsPage: 准备渲染全部', events.length, '个事件');
    
    // 为每个事件计算排序键（基于时间段）
    const periodOrder = ['先秦', '秦汉', '汉', '魏晋南北朝', '隋唐', '宋元', '明', '清', '民国', '现代', '未知'];
    const eventsWithSortKey = events.map(event => {
        const props = event.properties || {};
        const eventName = props.名称 || props.name || '';
        const timeStr = props.发生时间 || props.时间 || '';
        const timeInfo = parseEventTime(timeStr);
        
        // 如果时间字段为空，从事件名称推断时间段
        let period;
        if (timeInfo.year !== 0) {
            period = getTimePeriod(timeInfo.year);
        } else {
            period = inferTimePeriodFromName(eventName);
        }
        
        // 使用时间段顺序作为主要排序键，年份作为次要排序键
        const periodIndex = periodOrder.indexOf(period);
        const sortKey = periodIndex * 10000 + (timeInfo.year || 0);
        
        return {
            event: event,
            sortKey: sortKey,
            period: period,
            year: timeInfo.year
        };
    });

    // 按时间段和年份排序
    eventsWithSortKey.sort((a, b) => {
        if (a.sortKey !== b.sortKey) {
            return a.sortKey - b.sortKey;
        }
        // 如果时间段相同，按事件名称排序（作为最后的排序依据）
        const nameA = a.event.properties?.名称 || a.event.properties?.name || '';
        const nameB = b.event.properties?.名称 || b.event.properties?.name || '';
        return nameA.localeCompare(nameB, 'zh-CN');
    });

    console.log('updateAllEventsPage: 已按时间排序，显示所有', eventsWithSortKey.length, '个事件');
    
    // 显示所有事件
    eventsWithSortKey.forEach(item => {
        const timelineItem = createTimelineItem(item.event);
        timelineContainer.appendChild(timelineItem);
    });
});

// 更新事件页面（使用分类数据 + 性能优化 + 重要性筛选）
const updateEventsPage = rafThrottle(function() {
    const data = getCurrentData();
    if (!data) {
        console.warn('updateEventsPage: 数据未加载');
        return;
    }
    
    // 优先使用标准化数据
    let events = [];
    if (normalizedData && normalizedData.events && normalizedData.events.length > 0) {
        events = normalizedData.events;
    } else if (data.combined && data.combined.events && data.combined.events.length > 0) {
        // 如果 normalizedData 还没有，直接使用 combined.events
        events = data.combined.events;
    } else if (data.events && data.events.length > 0) {
        events = data.events;
    } else {
        console.warn('updateEventsPage: 未找到事件数据', { 
            hasNormalizedData: !!normalizedData, 
            normalizedEventsCount: normalizedData?.events?.length || 0,
            hasCombined: !!data.combined,
            combinedEventsCount: data.combined?.events?.length || 0,
            hasEvents: !!data.events,
            eventsCount: data.events?.length || 0
        });
        return;
    }
    
    const timelineContainer = document.querySelector('.timeline-container') || document.querySelector('.timeline-section');
    if (!timelineContainer) {
        console.warn('updateEventsPage: 未找到时间轴容器');
        return;
    }
    
    // 清空现有内容
    timelineContainer.innerHTML = '';
    
    console.log('updateEventsPage: 准备渲染', events.length, '个事件');
    
    // 为每个事件计算时间并分组
    const eventsWithTime = events.map(event => {
        const props = event.properties || {};
        const eventName = props.名称 || props.name || '';
        const timeStr = props.发生时间 || props.时间 || '';
        const timeInfo = parseEventTime(timeStr);
        
        // 如果时间字段为空，从事件名称推断时间段
        let period;
        if (timeInfo.year !== 0) {
            period = getTimePeriod(timeInfo.year);
        } else {
            period = inferTimePeriodFromName(eventName);
        }
        
        const score = getEventImportanceScore(event);
        return {
            event: event,
            year: timeInfo.year,
            sortKey: timeInfo.sortKey,
            period: period,
            score: score
        };
    });
    
    // 按时间段分组
    const periodGroups = {};
    eventsWithTime.forEach(item => {
        if (!periodGroups[item.period]) {
            periodGroups[item.period] = [];
        }
        periodGroups[item.period].push(item);
    });
    
    console.log('updateEventsPage: 各时间段事件数量:', Object.keys(periodGroups).map(p => `${p}:${periodGroups[p].length}`).join(', '));
    
    // 从每个时间段选择事件：优先选择高分事件，但确保每个时间段都有代表
    const selectedEvents = [];
    const periodOrder = ['先秦', '秦汉', '汉', '魏晋南北朝', '隋唐', '宋元', '明', '清', '民国', '现代'];
    const validPeriods = periodOrder.filter(p => periodGroups[p] && periodGroups[p].length > 0);
    
    // 计算每个时间段应该选择的事件数量
    // 目标：总共显示约60-80个事件，平均分配到各个时间段
    const targetTotalEvents = 70;
    const baseEventsPerPeriod = Math.floor(targetTotalEvents / Math.max(1, validPeriods.length));
    const minEventsPerPeriod = 5; // 每个时间段至少选择5个事件
    const maxEventsPerPeriod = 15; // 每个时间段最多选择15个事件
    
    validPeriods.forEach(period => {
        const periodEvents = periodGroups[period];
        // 按重要性得分降序排序
        periodEvents.sort((a, b) => b.score - a.score);
        
        // 计算选择数量：基础数量，但不少于最小值，不超过最大值和该时间段的事件总数
        let selectCount = Math.max(minEventsPerPeriod, baseEventsPerPeriod);
        selectCount = Math.min(selectCount, maxEventsPerPeriod, periodEvents.length);
        
        // 如果该时间段事件较多，可以选择更多（最多15个）
        if (periodEvents.length > 20) {
            selectCount = Math.min(15, periodEvents.length);
        }
        
        const selected = periodEvents.slice(0, selectCount);
        console.log(`updateEventsPage: 时间段 ${period} 选择 ${selected.length}/${periodEvents.length} 个事件 (最高分: ${selected[0]?.score || 0})`);
        selectedEvents.push(...selected);
    });
    
    console.log('updateEventsPage: 从各时间段筛选出', selectedEvents.length, '个事件');
    
    // 按时间排序最终结果
    selectedEvents.sort((a, b) => a.sortKey - b.sortKey);
    
    // 显示事件（限制数量，避免一次性渲染太多）
    const displayCount = Math.min(100, selectedEvents.length);
    selectedEvents.slice(0, displayCount).forEach(item => {
        const timelineItem = createTimelineItem(item.event);
        timelineContainer.appendChild(timelineItem);
    });
});

// 创建时间轴项目
function createTimelineItem(event) {
    const props = event.properties || {};
    const eventName = props.名称 || props.name || props.事件名称 || '未知事件';
    const eventTime = props.发生时间 || props.时间 || props.time || '';
    const eventDesc = props.描述 || props.description || '';
    const lat = props.lat || props.纬度 || props.latitue || '';
    const lng = props.lng || props.经度 || props.longitue || '';
    
    const item = document.createElement('div');
    item.className = 'timeline-item';
    
    // 如果有描述，显示描述；如果没有描述，不显示 timeline-detail 段落
    const detailHTML = eventDesc ? `<p class="timeline-detail">${eventDesc}</p>` : '';
    
    item.innerHTML = `
        <div class="timeline-year">${eventTime || ''}</div>
        <div class="timeline-content">
            <h3>${eventName}</h3>
            ${detailHTML}
            <a href="eventDetail.html?id=${event.id}" class="timeline-link">查看详情</a>
        </div>
    `;
    return item;
}

// 更新人物页面（性能优化）
const updatePersonsPage = rafThrottle(function() {
    const data = getCurrentData();
    if (!data) return;
    
    const persons = normalizedData ? normalizedData.persons : (data.persons || []);
    const personCards = document.querySelector('.person-cards');
    if (!personCards) return;
    
    personCards.innerHTML = '';
    
    // 限制渲染数量，使用虚拟滚动思想
    const renderCount = Math.min(20, persons.length);
    
    persons.slice(0, renderCount).forEach(person => {
        const props = person.properties || {};
        const personName = props.姓名 || props.name || '未知人物';
        const personRole = props.身份 || props.角色 || props.战役 || '历史人物';
        const firstChar = personName.charAt(0);
        const lat = props.lat || props.纬度 || '';
        const lng = props.lng || props.经度 || '';
        
        const card = document.createElement('div');
        card.className = 'person-card';
            card.innerHTML = `
            <div class="person-avatar">${firstChar}</div>
            <div class="person-info">
                <h3>${personName}</h3>
                <p class="person-role">${personRole}</p>
                <div class="person-tags">
                    <span class="tag">人物</span>
                    ${props.data_source ? `<span class="tag">${props.data_source.split('_')[0]}</span>` : ''}
                </div>
            </div>
            <a href="personDetail.html?id=${person.id}" class="person-link">查看详情</a>
        `;
        personCards.appendChild(card);
    });
});

// 更新地图页面数据
function updateMapPage() {
    const data = getCurrentData();
    if (!data) return;
    
    // 这里可以更新地图标记点
    console.log('地图数据:', data.locations);
}

// 更新知识图谱页面数据
// 知识图谱页面更新 - 使用模块化代码
function updateKnowledgeGraphPage() {
    const data = getCurrentData();
    if (!data) {
        console.warn('知识图谱：数据为空');
        return;
    }

    const cyContainer = document.getElementById('cy');
    if (!cyContainer) {
        console.warn('知识图谱：容器不存在');
        return;
    }

    // 检查模块是否加载
    if (!window.KGCache || !window.KGViews || !window.KGRenderer) {
        console.warn('知识图谱：模块未加载，请确保所有模块文件已正确引入');
        return;
    }

    // 清理旧的渲染器实例
    if (window.KGRenderer) {
        window.KGRenderer.destroy();
    }

    // 初始化模块
    window.KGCache.init();
    window.KGViews.init();

    // 获取节点数据（支持多种数据格式）
    let sourceNodes = [];
    // 统一以 id 去重合并，确保事件集（在 events 列表里）也能进入渲染
    const nodeMap = new Map();
    const pushNodes = (arr) => {
        if (!Array.isArray(arr)) return;
        arr.forEach(n => {
            if (n && n.id && !nodeMap.has(n.id)) nodeMap.set(n.id, n);
        });
    };
    // 优先使用 combined 下的 nodes / events / persons / locations
    if (data.combined) {
        pushNodes(data.combined.nodes);
        pushNodes(data.combined.events);
        pushNodes(data.combined.persons);
        pushNodes(data.combined.locations);
        pushNodes(data.combined.times);
    }
    // 兜底：如果当前 data 本身就是 combined（最常见情况），把 events/persons/locations/times 也加入去重集合
    pushNodes(data.nodes);
    pushNodes(data.events);
    pushNodes(data.persons);
    pushNodes(data.locations);
    pushNodes(data.times);
    sourceNodes = Array.from(nodeMap.values());
    
    // 获取关系数据
    let rels = [];
    if (data.relationships && Array.isArray(data.relationships)) {
        rels = data.relationships;
    } else if (data.combined && data.combined.relationships && Array.isArray(data.combined.relationships)) {
        rels = data.combined.relationships;
    }

    console.log('知识图谱数据加载:', {
        nodes: sourceNodes.length,
        relationships: rels.length,
        dataKeys: Object.keys(data)
    });

    // 使用缓存模块构建缓存
    window.KGCache.build(sourceNodes, rels);

    // 初始化初始视图
    if (window.KGCache.getAllNodes().length > 0) {
        window.KGViews.showInitialView();
    } else {
        console.warn('知识图谱：没有找到节点数据');
    }

    // 绑定事件（只绑定一次）
    if (!window.__kgBound) {
        const resetBtn = document.getElementById('kg-reset-btn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                window.KGViews.init();
                window.KGViews.showInitialView();
                window.KGViews.updateFocusHint();
            });
        }

        window.__kgBound = true;
    }

    // 更新视图提示
    window.KGViews.updateFocusHint();
}

// 判断节点是否是事件集（有包含关系指向其他事件）
function isEventSet(nodeId) {
    const kgCache = window.KGCache ? window.KGCache.cache : null;
    if (!kgCache) return false;
    const edges = kgCache.allEdges;
    const eventSetTypes = ['包含', '事件_事件'];
    let childEventCount = 0;
    
    edges.forEach(edge => {
        if (edge.data.source === nodeId) {
            const targetNode = kgCache.nodeMap.get(edge.data.target);
            if (targetNode && targetNode.data.type === 'event') {
                const relType = edge.data.label || '';
                // 检查关系类型是否包含关键词
                if (eventSetTypes.some(type => relType.includes(type)) || 
                    relType.includes('关联') || relType.includes('系列')) {
                    childEventCount++;
                }
            }
        }
    });
    
    // 如果有关系指向至少2个事件，认为是事件集
    return childEventCount >= 2;
}

// 显示初始视图：只显示事件节点（事件集大圆圈，单个事件小圆圈）
function showInitialView() {
    const kgCache = window.KGCache ? window.KGCache.cache : null;
    if (!kgCache || kgCache.allNodes.length === 0) {
        console.warn('知识图谱：缓存为空，无法显示初始视图');
        return;
    }
    
    const eventNodes = kgCache.allNodes.filter(n => n.data.type === 'event');
    console.log('知识图谱初始视图：事件节点数量', eventNodes.length);
    
    if (eventNodes.length === 0) {
        console.warn('知识图谱：没有找到事件节点');
        // 如果没有事件节点，显示所有节点
        const allNodesWithSize = kgCache.allNodes.map(n => ({
            ...n,
            data: {
                ...n.data,
                size: 58,
                isEventSet: false
            }
        }));
        
        const view = {
            type: 'initial',
            centerId: null,
            nodes: allNodesWithSize,
            edges: []
        };
        
        kgViewStack = [view];
        renderKnowledgeGraph(view.nodes, view.edges);
        return;
    }
    
    // 为事件节点添加size属性（参考Neo4j Browser：标准节点直径58px，半径29px）
    const nodesWithSize = eventNodes.map(n => ({
        ...n,
        data: {
            ...n.data,
            size: isEventSet(n.data.id) ? 80 : 58, // 事件集大圆圈80px，单个事件58px（参考Neo4j Browser）
            isEventSet: isEventSet(n.data.id)
        }
    }));
    
    console.log('知识图谱初始视图：节点准备完成', nodesWithSize.length);
    
    // 初始视图不显示关系
    const view = {
        type: 'initial',
        centerId: null,
        nodes: nodesWithSize,
        edges: []
    };
    
    kgViewStack = [view];
    renderKnowledgeGraph(view.nodes, view.edges);
}

// 点击事件集：显示其包含的子事件及子事件之间的关系
function showEventSetView(eventSetId) {
    const eventSetNode = kgCache.nodeMap.get(eventSetId);
    if (!eventSetNode || eventSetNode.data.type !== 'event') return;
    
    // 找到该事件集包含的所有子事件
    const childEventIds = new Set();
    const eventSetTypes = ['包含', '事件_事件'];
    
    kgCache.allEdges.forEach(edge => {
        if (edge.data.source === eventSetId) {
            const targetNode = kgCache.nodeMap.get(edge.data.target);
            if (targetNode && targetNode.data.type === 'event') {
                const relType = edge.data.label || '';
                // 检查关系类型是否包含关键词
                if (eventSetTypes.some(type => relType.includes(type)) || 
                    relType.includes('关联') || relType.includes('系列')) {
                    childEventIds.add(edge.data.target);
                }
            }
        }
    });
    
    // 找到子事件之间的关系
    const childEventSet = new Set(childEventIds);
    const childEdges = [];
    kgCache.allEdges.forEach(edge => {
        if (childEventSet.has(edge.data.source) && childEventSet.has(edge.data.target)) {
            childEdges.push(edge);
        }
    });
    
    // 构建节点列表（包含事件集节点和子事件节点）
    const nodes = [{
        ...eventSetNode,
        data: { ...eventSetNode.data, size: 80, isEventSet: true }
    }];
    
    childEventIds.forEach(id => {
        const node = kgCache.nodeMap.get(id);
        if (node) {
            nodes.push({
                ...node,
                data: { ...node.data, size: 58, isEventSet: false }
            });
        }
    });
    
    const view = {
        type: 'eventSet',
        centerId: eventSetId,
        nodes,
        edges: childEdges
    };
    
    kgViewStack.push(view);
    renderKnowledgeGraph(view.nodes, view.edges);
}

// 点击单个事件：显示该事件关联的人物和地点及关系
function showEventView(eventId) {
    const eventNode = kgCache.nodeMap.get(eventId);
    if (!eventNode || eventNode.data.type !== 'event') return;
    
    const relatedPersonIds = new Set();
    const relatedLocationIds = new Set();
    const relatedEdges = [];
    
    // 找到与该事件相关的人物和地点
    kgCache.allEdges.forEach(edge => {
        if (edge.data.source === eventId) {
            const targetNode = kgCache.nodeMap.get(edge.data.target);
            if (targetNode) {
                if (targetNode.data.type === 'person') {
                    relatedPersonIds.add(edge.data.target);
                    relatedEdges.push(edge);
                } else if (targetNode.data.type === 'location') {
                    relatedLocationIds.add(edge.data.target);
                    relatedEdges.push(edge);
                }
            }
        } else if (edge.data.target === eventId) {
            const sourceNode = kgCache.nodeMap.get(edge.data.source);
            if (sourceNode) {
                if (sourceNode.data.type === 'person') {
                    relatedPersonIds.add(edge.data.source);
                    relatedEdges.push(edge);
                } else if (sourceNode.data.type === 'location') {
                    relatedLocationIds.add(edge.data.source);
                    relatedEdges.push(edge);
                }
            }
        }
    });
    
    // 构建节点列表（参考Neo4j Browser：标准节点58px）
    const nodes = [{
        ...eventNode,
        data: { ...eventNode.data, size: 58, isEventSet: false }
    }];
    
    relatedPersonIds.forEach(id => {
        const node = kgCache.nodeMap.get(id);
        if (node) nodes.push({ ...node, data: { ...node.data, size: 58 } });
    });
    
    relatedLocationIds.forEach(id => {
        const node = kgCache.nodeMap.get(id);
        if (node) nodes.push({ ...node, data: { ...node.data, size: 58 } });
    });
    
    const view = {
        type: 'event',
        centerId: eventId,
        nodes,
        edges: relatedEdges
    };
    
    kgViewStack.push(view);
    renderKnowledgeGraph(view.nodes, view.edges);
}

// 点击人物/地点：显示与它们相关的其他节点（不显示关系）
function showPersonLocationView(nodeId) {
    const centerNode = kgCache.nodeMap.get(nodeId);
    if (!centerNode || (centerNode.data.type !== 'person' && centerNode.data.type !== 'location')) return;
    
    const relatedNodeIds = new Set();
    
    // 找到与该节点相关的所有其他节点
    kgCache.allEdges.forEach(edge => {
        if (edge.data.source === nodeId) {
            relatedNodeIds.add(edge.data.target);
        } else if (edge.data.target === nodeId) {
            relatedNodeIds.add(edge.data.source);
        }
    });
    
    // 构建节点列表（不包含关系，参考Neo4j Browser：标准节点58px）
    const nodes = [{
        ...centerNode,
        data: { ...centerNode.data, size: 58 }
    }];
    
    relatedNodeIds.forEach(id => {
        const node = kgCache.nodeMap.get(id);
        if (node) nodes.push({ ...node, data: { ...node.data, size: 58 } });
    });
    
    const view = {
        type: centerNode.data.type,
        centerId: nodeId,
        nodes,
        edges: [] // 不显示关系
    };
    
    kgViewStack.push(view);
    renderKnowledgeGraph(view.nodes, view.edges);
}

// 处理标签文本，自动换行以适应圆圈（参考Neo4j Browser的比例）
function formatLabel(text, maxWidth) {
    if (!text) return '';
    const textStr = String(text);
    
    // 根据节点大小估算每行字符数（参考Neo4j Browser：标准节点58px）
    // 标准节点(58px)约4-5个字符，大节点(80px)约6-7个字符
    const charsPerLine = maxWidth >= 70 ? 6 : 4;
    const maxLines = maxWidth >= 70 ? 3 : 2; // 大节点最多3行，标准节点最多2行
    
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

// 渲染/更新 vis.js (vis-network) 实例 - 完全匹配 Neo4j Browser
function renderKnowledgeGraph(nodes, edges) {
    const container = document.getElementById('cy');
    if (!container) {
        console.warn('知识图谱：容器不存在');
        return;
    }

    if (!nodes || nodes.length === 0) {
        console.warn('知识图谱：没有节点可渲染');
        return;
    }

    // 检查是否加载了 vis.js
    if (typeof vis === 'undefined') {
        console.warn('知识图谱：vis.js 未加载，回退到 Cytoscape.js');
        renderKnowledgeGraphCytoscape(nodes, edges);
        return;
    }

    console.log('知识图谱渲染（vis.js）：节点数量', nodes.length, '边数量', edges ? edges.length : 0);

    // 转换为 vis.js 格式
    const visNodes = new vis.DataSet(nodes.map(node => {
        const size = node.data.size || 58;
        const label = formatLabel(node.data.label, size);
        return {
            id: node.data.id,
            label: label,
            size: size,
            color: {
                background: '#68bdf6', // Neo4j Browser 默认节点颜色
                border: '#5dade2', // Neo4j Browser 边框颜色
                highlight: {
                    background: '#68bdf6',
                    border: '#68bdf6'
                },
                hover: {
                    background: '#68bdf6',
                    border: '#5dade2'
                }
            },
            borderWidth: Math.round(size * 0.138), // 精确比例：8px/58px
            borderWidthSelected: Math.round(size * 0.172), // 选中时10px/58px
            font: {
                color: '#ffffff',
                size: 11,
                face: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                strokeWidth: 0.5,
                strokeColor: '#000000'
            },
            shape: 'dot',
            type: node.data.type || 'event',
            isEventSet: node.data.isEventSet || false
        };
    }));

    const visEdges = new vis.DataSet((edges || []).map(edge => ({
        id: edge.data.id || `${edge.data.source}-${edge.data.target}`,
        from: edge.data.source,
        to: edge.data.target,
        label: edge.data.label || '',
        color: {
            color: '#a5abb6', // Neo4j Browser 边颜色
            highlight: '#68bdf6',
            hover: '#68bdf6',
            opacity: 0.6
        },
        width: 1,
        arrows: {
            to: {
                enabled: true,
                scaleFactor: 0.7, // 箭头大小
                type: 'arrow'
            }
        },
        smooth: {
            type: 'continuous',
            roundness: 0.5
        },
        font: {
            color: '#666666',
            size: 10,
            face: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
            align: 'middle'
        }
    })));

    // Neo4j Browser 精确配置
    const options = {
        nodes: {
            shape: 'dot',
            font: {
                color: '#ffffff',
                size: 11,
                face: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                strokeWidth: 0.5,
                strokeColor: '#000000'
            },
            borderWidth: 8,
            borderWidthSelected: 10,
            shadow: false,
            chosen: {
                node: function(values, id, selected, hovering) {
                    if (selected || hovering) {
                        values.borderWidth = 10;
                    }
                }
            }
        },
        edges: {
            color: {
                color: '#a5abb6',
                highlight: '#68bdf6',
                hover: '#68bdf6',
                opacity: 0.6
            },
            width: 1,
            arrows: {
                to: {
                    enabled: true,
                    scaleFactor: 0.7,
                    type: 'arrow'
                }
            },
            smooth: {
                type: 'continuous',
                roundness: 0.5
            },
            font: {
                color: '#666666',
                size: 10,
                face: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                align: 'middle',
                background: {
                    enabled: true,
                    color: '#ffffff',
                    opacity: 0.95
                }
            },
            selectionWidth: 2,
            hoverWidth: 1.5
        },
        physics: {
            enabled: true,
            stabilization: {
                enabled: true,
                iterations: 200,
                fit: true
            },
            barnesHut: {
                gravitationalConstant: -2000,
                centralGravity: 0.1,
                springLength: 400,
                springConstant: 0.04,
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
            selectConnectedEdges: false
        },
        layout: {
            improvedLayout: true
        },
        configure: {
            enabled: false
        }
    };

    // 创建或更新网络
    const data = { nodes: visNodes, edges: visEdges };
    
    if (!window.__visNetwork) {
        // 设置容器背景色（Neo4j Browser风格）
        container.style.backgroundColor = '#f5f5f5';
        
        window.__visNetwork = new vis.Network(container, data, options);
        
        // 绑定事件
        window.__visNetwork.on('click', (params) => {
            if (params.nodes.length > 0) {
                const nodeId = params.nodes[0];
                const nodeData = visNodes.get(nodeId);
                if (!nodeData) return;
                
                // Ctrl+点击或双击：只选择，不导航
                if (params.event && (params.event.ctrlKey || params.event.detail === 2)) {
                    return; // vis.js 会自动处理选择
                }
                
                // 普通点击：导航功能
                const currentView = kgViewStack[kgViewStack.length - 1];
                
                if (currentView.type === 'initial') {
                    if (nodeData.type === 'event') {
                        if (nodeData.isEventSet) {
                            showEventSetView(nodeId);
                        } else {
                            showEventView(nodeId);
                        }
                    }
                } else if (currentView.type === 'eventSet') {
                    if (nodeData.type === 'event' && !nodeData.isEventSet) {
                        showEventView(nodeId);
                    }
                } else if (currentView.type === 'event') {
                    if (nodeData.type === 'person' || nodeData.type === 'location') {
                        showPersonLocationView(nodeId);
                    }
                }
                
                updateKgFocusHint();
            } else {
                // 点击空白处取消选择
                window.__visNetwork.unselectAll();
            }
        });
        
        // 返回全图按钮
        const resetBtn = document.getElementById('kg-reset-btn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                kgViewStack = [];
                showInitialView();
            });
        }
    } else {
        // 更新数据
        window.__visNetwork.setData(data);
    }
}

// 保留 Cytoscape.js 版本作为后备
function renderKnowledgeGraphCytoscape(nodes, edges) {
    const cyContainer = document.getElementById('cy');
    if (!cyContainer || typeof cytoscape === 'undefined') {
        console.warn('知识图谱：容器或Cytoscape不存在');
        return;
    }

    if (!nodes || nodes.length === 0) {
        console.warn('知识图谱：没有节点可渲染');
        return;
    }

    console.log('知识图谱渲染（Cytoscape.js）：节点数量', nodes.length, '边数量', edges ? edges.length : 0);

    // 预处理节点，添加格式化标签（默认大小58px，参考Neo4j Browser）
    const processedNodes = nodes.map(node => {
        const size = node.data.size || 58;
        const label = formatLabel(node.data.label, size);
        return {
            ...node,
            data: {
                ...node.data,
                formattedLabel: label
            }
        };
    });

    if (!window.__cyInstance) {
        // 设置容器背景色（Neo4j Browser风格：浅灰色背景）
        cyContainer.style.backgroundColor = '#f5f5f5';
        
        window.__cyInstance = cytoscape({
            container: cyContainer,
            elements: { nodes: processedNodes, edges },
            // Neo4j Browser精确配置
            textureOnViewport: false,
            motionBlur: false,
            pixelRatio: window.devicePixelRatio || 1,
            // 尝试使用SVG渲染以获得更接近Neo4j Browser的效果
            renderer: {
                name: 'canvas' // Cytoscape默认使用canvas，但我们可以通过样式精确匹配
            },
            style: [
                {
                    selector: 'node',
                    style: {
                        // Neo4j Browser精确字体设置
                        'label': 'data(formattedLabel)',
                        'font-family': '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif', // Neo4j Browser实际字体栈
                        'font-size': 11, // Neo4j Browser实际字体大小
                        'font-weight': 400, // normal weight
                        'text-valign': 'center',
                        'text-halign': 'center',
                        'text-wrap': 'wrap',
                        'text-max-width': 'data(size) * 0.7', // Neo4j Browser文本区域更小
                        'color': '#ffffff',
                        // Neo4j Browser节点精确尺寸
                        'width': 'data(size)',
                        'height': 'data(size)',
                        // Neo4j Browser精确颜色值（从源码提取）
                        'background-color': '#68bdf6', // Neo4j Browser默认节点颜色
                        'border-width': 'data(size) * 0.137931034', // 精确比例：8px/58px ≈ 0.138
                        'border-color': '#5dade2', // Neo4j Browser边框颜色
                        'shape': 'ellipse',
                        'opacity': 1,
                        // Neo4j Browser文字描边设置
                        'text-outline-width': 0.5,
                        'text-outline-color': '#000000',
                        'text-outline-opacity': 0.4
                    }
                },
                { 
                    selector: 'node[type = "event"]', 
                    style: { 
                        'background-color': '#68bdf6',
                        'border-color': '#5dade2',
                        'color': '#ffffff'
                    } 
                },
                { 
                    selector: 'node[type = "person"]', 
                    style: { 
                        'background-color': '#68bdf6',
                        'border-color': '#5dade2',
                        'color': '#ffffff'
                    } 
                },
                { 
                    selector: 'node[type = "location"]', 
                    style: { 
                        'background-color': '#68bdf6',
                        'border-color': '#5dade2',
                        'color': '#ffffff'
                    } 
                },
                { 
                    selector: 'node[type = "time"]', 
                    style: { 
                        'background-color': '#68bdf6',
                        'border-color': '#5dade2',
                        'color': '#ffffff'
                    } 
                },
                {
                    selector: 'node:selected',
                    style: {
                        'border-width': 'data(size) * 0.172413793', // 选中时10px/58px
                        'border-color': '#68bdf6', // Neo4j Browser选中时保持相同颜色但更粗
                        'background-color': '#68bdf6',
                        'opacity': 1,
                        'z-index': 1000
                    }
                },
                {
                    selector: 'node:hover',
                    style: {
                        'opacity': 1,
                        'border-width': 'data(size) * 0.155172414', // hover时9px/58px
                        'z-index': 999
                    }
                },
                {
                    selector: 'node:active',
                    style: {
                        'opacity': 1,
                        'cursor': 'grabbing',
                        'z-index': 1001
                    }
                },
                {
                    selector: 'edge',
                    style: {
                        // Neo4j Browser边精确设置
                        'width': 1,
                        'line-color': '#a5abb6', // Neo4j Browser精确边颜色
                        'target-arrow-color': '#a5abb6',
                        'target-arrow-shape': 'triangle',
                        'target-arrow-size': 3.5, // Neo4j Browser箭头精确大小
                        'curve-style': 'bezier',
                        'opacity': 0.6,
                        'line-cap': 'round',
                        'line-style': 'solid',
                        'source-endpoint': 'outside-to-node',
                        'target-endpoint': 'outside-to-node'
                    }
                },
                {
                    selector: 'edge:hover',
                    style: {
                        'opacity': 0.85,
                        'width': 1.5,
                        'line-color': '#68bdf6'
                    }
                },
                {
                    selector: 'edge:selected',
                    style: {
                        'opacity': 1,
                        'width': 2,
                        'line-color': '#68bdf6'
                    }
                },
                {
                    selector: 'edge[label]',
                    style: {
                        'label': 'data(label)',
                        'font-family': '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                        'font-size': 10, // Neo4j Browser边标签字体
                        'font-weight': 400,
                        'color': '#666666',
                        'text-rotation': 'autorotate',
                        'text-margin-x': 4,
                        'text-margin-y': -4,
                        'text-background-color': '#ffffff',
                        'text-background-opacity': 0.95,
                        'text-background-padding': 2,
                        'text-border-width': 0,
                        'text-border-color': 'transparent'
                    }
                }
            ],
            layout: { 
                name: 'cose',
                animate: true,
                animationDuration: 800,
                animationEasing: 'ease-out',
                fit: true,
                padding: 60,
                nodeDimensionsIncludeLabels: true,
                idealEdgeLength: 400, // 增加间距，避免节点重叠
                edgeElasticity: 0.25, // 降低弹性，使连接更稳定
                nestingFactor: 0.1,
                gravity: 0.1, // 进一步降低重力，减少节点聚集
                componentSpacing: 100, // 组件间距，避免重叠
                numIter: 3000, // 增加迭代次数，使布局更稳定
                initialTemp: 200,
                coolingFactor: 0.95,
                minTemp: 1.0,
                randomize: false // 不随机化，保持稳定
            },
            wheelSensitivity: 0.2,
            minZoom: 0.1,
            maxZoom: 3,
            // 启用节点拖拽和选择
            userPanningEnabled: true,
            userZoomingEnabled: true,
            boxSelectionEnabled: true, // 启用框选
            selectionType: 'single' // 单选模式
        });
        
        const cy = window.__cyInstance;
        
        // 性能优化：减少不必要的样式更新
        let zoomTimer = null;
        cy.on('zoom', () => {
            // 防抖处理，减少更新频率
            if (zoomTimer) {
                cancelAnimationFrame(zoomTimer);
            }
            zoomTimer = requestAnimationFrame(() => {
                cy.style().update();
            });
        });
        
        // 节点拖拽优化：参考Neo4j Browser的实现方式
        let layoutRunning = false;
        let draggedNode = null;
        let dragStartTime = 0;
        let isDragging = false;
        
        // 拖拽开始时：锁定节点，禁用动画
        cy.on('dragstart', 'node', (evt) => {
            const node = evt.target;
            draggedNode = node;
            isDragging = true;
            dragStartTime = Date.now();
            
            // 锁定被拖拽的节点
            node.lock();
            
            // 禁用动画以提高性能
            cy.animation({
                fit: { duration: 0 },
                center: { duration: 0 },
                zoom: { duration: 0 }
            });
        });
        
        // 拖拽过程中：只移动被拖拽的节点，不调整其他节点（性能优化）
        cy.on('drag', 'node', (evt) => {
            // 不做任何实时计算，只让节点跟随鼠标移动
            // 这样可以保持流畅的拖拽体验
        });
        
        // 拖拽结束时：解锁节点并重新布局
        cy.on('dragfree', 'node', (evt) => {
            const node = evt.target;
            const dragDuration = Date.now() - dragStartTime;
            
            // 解锁节点
            node.unlock();
            draggedNode = null;
            isDragging = false;
            
            // 如果拖拽时间很短（可能是误触），不重新布局
            if (dragDuration < 100) {
                return;
            }
            
            // 延迟重新布局，避免频繁计算
            setTimeout(() => {
                if (layoutRunning) return;
                layoutRunning = true;
                
                // 使用轻量级布局快速调整
                const finalLayout = cy.layout({
                    name: 'cose',
                    animate: true,
                    animationDuration: 400, // 减少动画时长
                    animationEasing: 'ease-out',
                    fit: false,
                    padding: 60,
                    nodeDimensionsIncludeLabels: true,
                    idealEdgeLength: 400, // 增加间距，避免节点重叠
                    edgeElasticity: 0.25,
                    gravity: 0.1,
                    componentSpacing: 100,
                    numIter: 500, // 减少迭代次数以提高性能
                    initialTemp: 80,
                    coolingFactor: 0.95,
                    minTemp: 1.0
                });
                
                finalLayout.one('layoutstop', () => {
                    layoutRunning = false;
                });
                
                finalLayout.run();
            }, 150);
        });
        
        // 性能优化：减少渲染更新
        cy.on('render', () => {
            // 拖拽时不进行额外的渲染优化
            if (isDragging) {
                return;
            }
        });
        
        // 节点选择功能：Ctrl+点击选择，点击空白取消选择
        cy.on('tap', (evt) => {
            // 点击空白处取消选择
            if (evt.target === cy) {
                cy.elements().unselect();
                return;
            }
        });
        
        // Ctrl+点击选择节点（不触发导航）
        cy.on('tap', 'node', (evt) => {
            const node = evt.target;
            const nodeId = node.id();
            const nodeData = node.data();
            
            // 如果按住Ctrl键，只选择不导航
            if (evt.originalEvent && evt.originalEvent.ctrlKey) {
                if (node.selected()) {
                    node.unselect();
                } else {
                    cy.elements().unselect(); // 取消其他选择
                    node.select();
                }
                return;
            }
            
            // 双击选择节点（不触发导航）
            if (evt.originalEvent && evt.originalEvent.detail === 2) {
                if (node.selected()) {
                    node.unselect();
                } else {
                    cy.elements().unselect();
                    node.select();
                }
                return;
            }
            
            // 普通点击：导航功能
            const currentView = kgViewStack[kgViewStack.length - 1];
            
            if (currentView.type === 'initial') {
                // 初始视图：点击事件节点
                if (nodeData.type === 'event') {
                    if (nodeData.isEventSet) {
                        showEventSetView(nodeId);
                    } else {
                        showEventView(nodeId);
                    }
                }
            } else if (currentView.type === 'eventSet') {
                // 事件集视图：点击子事件
                if (nodeData.type === 'event' && !nodeData.isEventSet) {
                    showEventView(nodeId);
                }
            } else if (currentView.type === 'event') {
                // 事件视图：点击人物或地点
                if (nodeData.type === 'person' || nodeData.type === 'location') {
                    showPersonLocationView(nodeId);
                }
            }
            // person/location视图：点击其他节点可以继续展开（可选）
            
            updateKgFocusHint();
        });
        
        // 解决节点遮挡问题：动态调整z-index
        cy.on('mouseover', 'node', (evt) => {
            const node = evt.target;
            // hover时提升层级
            node.style('z-index', 999);
        });
        
        cy.on('mouseout', 'node', (evt) => {
            const node = evt.target;
            // 如果不是选中状态，恢复默认层级
            if (!node.selected()) {
                node.style('z-index', 'auto');
            }
        });
        
        // 选中时提升层级
        cy.on('select', 'node', (evt) => {
            const node = evt.target;
            node.style('z-index', 1000);
        });
        
        // 取消选中时恢复层级
        cy.on('unselect', 'node', (evt) => {
            const node = evt.target;
            node.style('z-index', 'auto');
        });
    } else {
        const cy = window.__cyInstance;
        cy.elements().remove();
        cy.add(processedNodes);
        cy.add(edges);
        cy.layout({ 
            name: 'cose', 
            animate: true,
            animationDuration: 800,
            animationEasing: 'ease-out',
            fit: true,
            padding: 60,
            nodeDimensionsIncludeLabels: true,
            idealEdgeLength: 400, // 增加间距，避免节点重叠
            edgeElasticity: 0.25, // 降低弹性，使连接更稳定
            nestingFactor: 0.1,
            gravity: 0.1, // 进一步降低重力，减少节点聚集
            componentSpacing: 100, // 组件间距，避免重叠
            numIter: 3000, // 增加迭代次数，使布局更稳定
            initialTemp: 200,
            coolingFactor: 0.95,
            minTemp: 1.0,
            randomize: false // 不随机化，保持稳定
        }).run();
    }
}

function updateKgFocusHint() {
    const hint = document.getElementById('kg-focus-hint');
    if (!hint) return;
    
    if (kgViewStack.length === 0) {
        hint.textContent = '当前视图：事件集与事件';
        return;
    }
    
    const currentView = kgViewStack[kgViewStack.length - 1];
    const centerNode = kgCache.nodeMap.get(currentView.centerId);
    const label = centerNode ? centerNode.data.label : currentView.centerId;
    
    let viewText = '';
    switch (currentView.type) {
        case 'initial':
            viewText = '事件集与事件';
            break;
        case 'eventSet':
            viewText = `事件集：${label}`;
            break;
        case 'event':
            viewText = `事件：${label}`;
            break;
        case 'person':
            viewText = `人物：${label}`;
            break;
        case 'location':
            viewText = `地点：${label}`;
            break;
        default:
            viewText = '知识图谱';
    }
    
    hint.textContent = `当前视图：${viewText}`;
}

// 更新统计数字
function updateStatValue(selector, target) {
    const element = document.querySelector(selector);
    if (!element) return;
    
    const current = parseInt(element.textContent) || 0;
    if (current === target) return;
    
    // 使用requestAnimationFrame优化动画
    const duration = 1000;
    const startTime = performance.now();
    const startValue = current;
    const difference = target - startValue;
    
    function animate(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // 使用easeOut缓动函数
        const easeOut = 1 - Math.pow(1 - progress, 3);
        const value = Math.round(startValue + difference * easeOut);
        
        element.textContent = value;
        
        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            element.textContent = target;
        }
    }
    
    requestAnimationFrame(animate);
}

// 切换数据集
function switchDataset(datasetName) {
    currentDataset = datasetName;
    
    // 更新所有页面
    updateOverviewPage();
    updateEventsPage();
    updatePersonsPage();
    updateMapPage();
    updateKnowledgeGraphPage();
}

// ==================== 阶段5: 数据渲染 ====================
// 统一的数据渲染入口
async function renderData() {
    try {
        const path = window.location.pathname;
        const filename = path.split('/').pop() || 'index.html';
        
        // 更新首页的核心事件集入口（只在首页执行）
        if (filename === 'index.html' || path.includes('index.html')) {
            updateHomePageEventSets();
        }
        
        // 根据页面类型更新内容
        if (path.includes('overview.html')) {
            updateOverviewPage();
        } else if (path.includes('all-events.html')) {
            updateAllEventsPage();
        } else if (path.includes('events.html')) {
            updateEventsPage();
        } else if (path.includes('persons.html')) {
            updatePersonsPage();
        } else if (path.includes('map.html') || path.includes('map-canvas.html')) {
            updateMapPage();
        } else if (path.includes('knowledgeGraph.html')) {
            updateKnowledgeGraphPage();
        } else if (filename === 'index.html' || path.endsWith('/') || path === '/') {
            // 首页：更新统计数据
            updateHomePageStats();
        }
    } catch (error) {
        console.error('渲染数据时出错:', error);
    }
}

// 更新首页统计数据
function updateHomePageStats() {
    if (!normalizedData) return;
    
    const stats = normalizedData.summary || {};
    
    // 更新首页的统计数据
    const setStat = (type, val) => {
        const el = document.querySelector(`.stat-number[data-type="${type}"]`);
        if (el) {
            el.setAttribute('data-target', val);
            updateStatValue(`.stat-number[data-type="${type}"]`, val);
        }
    };
    
    setStat('total_nodes', stats.total_nodes || 0);
    setStat('total_relationships', stats.total_relationships || 0);
    setStat('events', stats.events || 0);
}

// 更新首页的核心事件集入口
function updateHomePageEventSets() {
    const container = document.getElementById('core-event-sets-container');
    if (!container || !categorizedData) return;
    
    container.innerHTML = '';
    
    // 显示3个核心事件集
    const coreEventSets = ['花园口决堤', '双堆集歼灭战', '淝水之战阶段'];
    
    coreEventSets.forEach(eventSetName => {
        const eventSetData = categorizedData.byEventSet[eventSetName];
        if (!eventSetData) return;
        
        const card = document.createElement('div');
        card.className = 'event-set-card-home';
        card.style.cssText = 'background: rgba(255, 255, 255, 0.1); padding: 1.5rem; border-radius: 12px; backdrop-filter: blur(10px); cursor: pointer; transition: all 0.3s ease;';
        card.innerHTML = `
            <h4 style="color: white; margin-bottom: 0.5rem; font-size: 1.2rem;">${eventSetName}</h4>
            <p style="color: rgba(255, 255, 255, 0.8); margin: 0; font-size: 0.9rem;">
                ${eventSetData.events.length} 个事件 · ${eventSetData.persons.length} 个人物 · ${eventSetData.locations.length} 个地点
            </p>
        `;
        
        card.addEventListener('click', () => {
            window.location.href = `events.html?eventSet=${encodeURIComponent(eventSetName)}`;
        });
        
        card.addEventListener('mouseenter', () => {
            card.style.transform = 'translateY(-5px)';
            card.style.background = 'rgba(255, 255, 255, 0.15)';
        });
        
        card.addEventListener('mouseleave', () => {
            card.style.transform = 'translateY(0)';
            card.style.background = 'rgba(255, 255, 255, 0.1)';
        });
        
        container.appendChild(card);
    });
}

// 页面加载时初始化（防止重复执行）
let isInitialized = false;

// 只在DOM完全加载后执行一次
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDataLoader);
} else {
    // DOM已经加载完成
    initDataLoader();
}

async function initDataLoader() {
    // 防止重复初始化
    if (isInitialized) {
        console.warn('数据加载器已初始化，跳过重复初始化');
        return;
    }
    
    try {
        isInitialized = true;
        console.log('开始初始化数据加载器...');
        
        // 检查URL参数，如果包含 clearCache=1，则清除缓存
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('clearCache') === '1') {
            console.log('检测到 clearCache=1 参数，清除缓存...');
            await clearIndexedDBCache();
            // 清除内存缓存
            dataCache.raw = null;
            dataCache.normalized = null;
            dataCache.categorized = null;
            dataCache.lastUpdate = null;
            console.log('缓存已清除，将从文件重新加载数据');
        }
        
        // 检测页面类型
        const path = window.location.pathname;
        let pageType = 'auto';
        if (path.includes('index.html') || path.endsWith('/') || path === '/') {
            pageType = 'index';
        }
        
        // 使用新的数据加载管道（按需加载）
        const pipelineResult = await loadDataPipeline(pageType);
        
        if (pipelineResult) {
            console.log('数据加载管道完成');
            
            // 如果是summary only，先快速渲染，然后后台加载完整数据
            if (pipelineResult.isSummaryOnly) {
                await renderData();
                // 后台加载完整数据
                setTimeout(async () => {
                    console.log('后台加载完整数据...');
                    const fullData = await loadData('full');
                    const normalized = normalizeData(fullData);
                    if (normalized) {
                        normalizedData = normalized;
                        categorizedData = categorizeData(normalized);
                        // 更新页面（如果需要）
                        if (path.includes('index.html')) {
                            updateHomePageEventSets();
                            updateHomePageStats();
                        }
                    }
                }, 1000);
            } else {
                // 渲染数据
                await renderData();
            }
        } else {
            console.error('数据加载管道失败，使用旧方式');
            // 降级到旧方式
            await loadData('full');
            await renderData();
        }
    } catch (error) {
        console.error('初始化错误:', error);
        hideLoadingIndicator();
        // 即使出错也尝试渲染，避免页面空白
        try {
            await loadData('full');
            await renderData();
        } catch (fallbackError) {
            console.error('降级加载也失败:', fallbackError);
        }
    }
}

// 导出函数供其他脚本使用
window.dataLoader = {
    loadData,
    loadDataPipeline,
    normalizeData,
    categorizeData,
    validateData,
    getCurrentData,
    getNormalizedData: () => normalizedData,
    getCategorizedData: () => categorizedData,
    switchDataset,
    updateOverviewPage,
    updateEventsPage,
    updatePersonsPage,
    updateMapPage,
    updateKnowledgeGraphPage,
    renderData
};