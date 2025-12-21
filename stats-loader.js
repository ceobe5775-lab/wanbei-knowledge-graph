// 统一的数据统计加载脚本

async function loadStatsData() {
    try {
        const response = await fetch('data.json');
        const data = await response.json();
        
        if (!data || !data.combined) {
            console.error('数据格式错误');
            return null;
        }
        
        const stats = {
            events: data.combined.events?.length || 0,
            persons: data.combined.persons?.length || 0,
            locations: data.combined.locations?.length || 0,
            times: data.combined.times?.length || 0,
            total_nodes: data.combined.nodes?.length || 0,
            total_relationships: data.combined.relationships?.length || 0
        };
        
        // 如果没有events数组，尝试从nodes中筛选
        if (stats.events === 0 && data.combined.nodes) {
            stats.events = data.combined.nodes.filter(n => 
                n.labels && n.labels.some(l => l.includes('事件'))
            ).length;
        }
        
        // 如果没有persons数组，尝试从nodes中筛选
        if (stats.persons === 0 && data.combined.nodes) {
            stats.persons = data.combined.nodes.filter(n => 
                n.labels && n.labels.some(l => l.includes('人物'))
            ).length;
        }
        
        // 如果没有locations数组，尝试从nodes中筛选
        if (stats.locations === 0 && data.combined.nodes) {
            stats.locations = data.combined.nodes.filter(n => 
                n.labels && n.labels.some(l => l.includes('地点'))
            ).length;
        }
        
        console.log('统计数据:', stats);
        return stats;
    } catch (error) {
        console.error('加载统计数据失败:', error);
        return null;
    }
}

// 更新首页统计数据
function updateHomeStats(stats) {
    if (!stats) return;
    
    // 更新首页Hero区域的统计数据（使用data-type）
    const heroStats = document.querySelectorAll('.hero-stats .stat-number[data-type]');
    heroStats.forEach(stat => {
        const type = stat.getAttribute('data-type');
        if (type === 'total_nodes') {
            stat.textContent = formatNumber(stats.total_nodes) + '+';
        } else if (type === 'total_relationships') {
            stat.textContent = formatNumber(stats.total_relationships) + '+';
        } else if (type === 'events') {
            stat.textContent = formatNumber(stats.events) + '+';
        }
    });
    
    // 兼容旧版本（没有data-type的情况）
    const oldHeroStats = document.querySelectorAll('.hero-stats .stat-number:not([data-type])');
    if (oldHeroStats.length >= 3) {
        oldHeroStats[0].textContent = formatNumber(stats.total_nodes) + '+';
        oldHeroStats[1].textContent = formatNumber(stats.total_relationships) + '+';
        oldHeroStats[2].textContent = formatNumber(stats.events) + '+';
    }
    
    // 更新首页其他统计数据
    const homeStats = document.querySelectorAll('.stat-big-number[data-target]');
    homeStats.forEach(stat => {
        const target = stat.getAttribute('data-target');
        if (target === '5000') {
            stat.setAttribute('data-target', stats.total_relationships);
            stat.textContent = formatNumber(stats.total_relationships);
        } else if (target === '100') {
            stat.setAttribute('data-target', stats.events);
            stat.textContent = formatNumber(stats.events);
        }
    });
}

// 更新数据概览页面统计数据
function updateOverviewStats(stats) {
    if (!stats) return;
    
    // 使用data-type属性更新
    const eventStat = document.querySelector('.stat-value[data-type="events"]');
    if (eventStat) {
        eventStat.setAttribute('data-target', stats.events);
        eventStat.textContent = '0';
    }
    
    const personStat = document.querySelector('.stat-value[data-type="persons"]');
    if (personStat) {
        personStat.setAttribute('data-target', stats.persons);
        personStat.textContent = '0';
    }
    
    const locationStat = document.querySelector('.stat-value[data-type="locations"]');
    if (locationStat) {
        locationStat.setAttribute('data-target', stats.locations);
        locationStat.textContent = '0';
    }
    
    const timeStat = document.querySelector('.stat-value[data-type="times"]');
    if (timeStat) {
        timeStat.setAttribute('data-target', stats.times);
        timeStat.textContent = '0';
    }
    
    const relationStat = document.querySelector('.stat-value[data-type="relationships"]');
    if (relationStat) {
        relationStat.setAttribute('data-target', stats.total_relationships);
        relationStat.textContent = '0';
    }
    
    const totalNodeStat = document.querySelector('.stat-value[data-type="total_nodes"]');
    if (totalNodeStat) {
        totalNodeStat.setAttribute('data-target', stats.total_nodes);
        totalNodeStat.textContent = '0';
    }
    
    // 触发数字动画
    setTimeout(() => {
        if (typeof window.animatePageNumbers === 'function') {
            window.animatePageNumbers();
        } else if (typeof animatePageNumbers === 'function') {
            animatePageNumbers();
        }
    }, 100);
}

// 格式化数字
function formatNumber(num) {
    if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'k';
    }
    return num.toString();
}

// 数字动画函数（使用page-scripts.js中的函数，避免重复声明）
// 如果page-scripts.js中的函数已加载，直接使用；否则定义本地版本
if (typeof window.animatePageNumbers === 'undefined') {
    window.animatePageNumbers = function() {
        const statValues = document.querySelectorAll('.stat-value[data-target]');
        statValues.forEach(stat => {
            const target = parseInt(stat.getAttribute('data-target'));
            if (target && stat.textContent === '0') {
                let current = 0;
                const increment = Math.max(1, target / 50);
                const timer = setInterval(() => {
                    current += increment;
                    if (current >= target) {
                        stat.textContent = target;
                        clearInterval(timer);
                    } else {
                        stat.textContent = Math.floor(current);
                    }
                }, 30);
            }
        });
    };
}

// 页面加载时执行
document.addEventListener('DOMContentLoaded', async () => {
    const stats = await loadStatsData();
    
    if (stats) {
        // 检查当前页面
        if (document.querySelector('.hero-stats')) {
            // 首页
            updateHomeStats(stats);
        } else if (document.querySelector('.stats-section')) {
            // 数据概览页面
            updateOverviewStats(stats);
        }
    }
});

// 导出供其他脚本使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { loadStatsData, updateHomeStats, updateOverviewStats };
}

