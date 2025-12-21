// 数据加载器 - 从JSON文件加载数据并更新页面

let allData = null;
let currentDataset = '全部';

// 加载数据
async function loadData() {
    try {
        const response = await fetch('data.json');
        allData = await response.json();
        console.log('数据加载成功:', allData);
        return allData;
    } catch (error) {
        console.error('数据加载失败:', error);
        // 使用示例数据
        return getSampleData();
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

// 获取当前数据集的数据
function getCurrentData() {
    if (!allData) return null;
    
    if (currentDataset === '全部') {
        return allData.combined;
    }
    
    const dataset = allData.datasets.find(d => d.dataset === currentDataset);
    return dataset || allData.combined;
}

// 更新数据概览页面
function updateOverviewPage() {
    const data = getCurrentData();
    if (!data) return;
    
    // 更新统计数据
    const stats = data.summary;
    updateStatValue('.stat-value[data-target="100"]', stats.events || 0);
    updateStatValue('.stat-value[data-target="500"]', stats.persons || 0);
    updateStatValue('.stat-value[data-target="800"]', stats.locations || 0);
    updateStatValue('.stat-value[data-target="200"]', stats.times || 0);
    updateStatValue('.stat-value[data-target="5000"]', stats.total_relationships || 0);
    updateStatValue('.stat-value[data-target="2065"]', stats.total_nodes || 0);
    
    // 更新实际数据（如果有）
    if (stats.total_nodes > 0) {
        const totalNodeElement = document.querySelector('.stat-value[data-target="2065"]');
        if (totalNodeElement) {
            totalNodeElement.setAttribute('data-target', stats.total_nodes);
            updateStatValue(`.stat-value[data-target="${stats.total_nodes}"]`, stats.total_nodes);
        }
    }
}

// 更新事件页面
function updateEventsPage() {
    const data = getCurrentData();
    if (!data || !data.events) return;
    
    const events = data.events;
    const timelineContainer = document.querySelector('.timeline-container');
    if (!timelineContainer) return;
    
    // 清空现有内容（保留第一个示例）
    const existingItems = timelineContainer.querySelectorAll('.timeline-item');
    existingItems.forEach((item, index) => {
        if (index > 0) item.remove();
    });
    
    // 添加事件（限制显示前10个）
    events.slice(0, 10).forEach(event => {
        const eventName = event.properties.name || event.properties.名称 || '未知事件';
        const eventTime = event.properties.时间 || event.properties.time || '';
        const eventDesc = event.properties.描述 || event.properties.description || '';
        const lat = event.properties.lat || event.properties.纬度 || 0;
        const lng = event.properties.lng || event.properties.经度 || 0;
        
        const item = document.createElement('div');
        item.className = 'timeline-item';
        item.innerHTML = `
            <div class="timeline-year">${eventTime || '历史事件'}</div>
            <div class="timeline-content">
                <h3>${eventName}</h3>
                <p>${eventDesc || `坐标: ${lat}, ${lng}`}</p>
                <div class="timeline-tags">
                    <span class="tag">事件</span>
                    ${event.properties.data_source ? `<span class="tag">${event.properties.data_source.split('_')[0]}</span>` : ''}
                </div>
                <a href="eventDetail.html?id=${event.id}" class="timeline-link">查看详情 →</a>
            </div>
        `;
        timelineContainer.appendChild(item);
    });
}

// 更新人物页面
function updatePersonsPage() {
    const data = getCurrentData();
    if (!data || !data.persons) return;
    
    const persons = data.persons;
    const personCards = document.querySelector('.person-cards');
    if (!personCards) return;
    
    // 清空现有内容
    personCards.innerHTML = '';
    
    // 添加人物卡片（限制显示前12个）
    persons.slice(0, 12).forEach(person => {
        const personName = person.properties.name || person.properties.姓名 || '未知人物';
        const personRole = person.properties.角色 || person.properties.战役 || '历史人物';
        const firstChar = personName.charAt(0);
        const lat = person.properties.lat || person.properties.纬度 || 0;
        const lng = person.properties.lng || person.properties.经度 || 0;
        
        const card = document.createElement('div');
        card.className = 'person-card';
        card.innerHTML = `
            <div class="person-avatar">${firstChar}</div>
            <div class="person-info">
                <h3>${personName}</h3>
                <p class="person-role">${personRole}</p>
                ${lat && lng ? `<p class="person-desc">坐标: ${lat}, ${lng}</p>` : ''}
                <div class="person-tags">
                    <span class="tag">人物</span>
                    ${person.properties.data_source ? `<span class="tag">${person.properties.data_source.split('_')[0]}</span>` : ''}
                </div>
            </div>
            <a href="personDetail.html?id=${person.id}" class="person-link">查看详情 →</a>
        `;
        personCards.appendChild(card);
    });
}

// 更新地图页面数据
function updateMapPage() {
    const data = getCurrentData();
    if (!data) return;
    
    // 这里可以更新地图标记点
    console.log('地图数据:', data.locations);
}

// 更新知识图谱页面数据
function updateKnowledgeGraphPage() {
    const data = getCurrentData();
    if (!data) return;
    
    // 这里可以更新知识图谱
    console.log('图谱数据:', data.nodes, data.relationships);
}

// 更新统计数字
function updateStatValue(selector, target) {
    const element = document.querySelector(selector);
    if (!element) return;
    
    const current = parseInt(element.textContent) || 0;
    if (current === target) return;
    
    // 动画更新数字
    const duration = 1000;
    const steps = 30;
    const increment = (target - current) / steps;
    let step = 0;
    
    const timer = setInterval(() => {
        step++;
        const value = Math.round(current + increment * step);
        element.textContent = value;
        
        if (step >= steps) {
            element.textContent = target;
            clearInterval(timer);
        }
    }, duration / steps);
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

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', async () => {
    await loadData();
    
    // 根据当前页面更新数据
    const path = window.location.pathname;
    if (path.includes('overview.html')) {
        updateOverviewPage();
    } else if (path.includes('events.html')) {
        updateEventsPage();
    } else if (path.includes('persons.html')) {
        updatePersonsPage();
    } else if (path.includes('map.html')) {
        updateMapPage();
    } else if (path.includes('knowledgeGraph.html')) {
        updateKnowledgeGraphPage();
    }
});

// 导出函数供其他脚本使用
window.dataLoader = {
    loadData,
    getCurrentData,
    switchDataset,
    updateOverviewPage,
    updateEventsPage,
    updatePersonsPage,
    updateMapPage,
    updateKnowledgeGraphPage
};
