// 页面通用脚本

// 数字动画
const animatePageNumbers = () => {
    const statValues = document.querySelectorAll('.stat-value[data-target]');
    statValues.forEach(stat => {
        const target = parseInt(stat.getAttribute('data-target'));
        if (target && stat.textContent === '0') {
            let current = 0;
            const increment = target / 50;
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

// 当页面加载时启动数字动画
document.addEventListener('DOMContentLoaded', () => {
    // 延迟启动动画，等待页面渲染完成
    setTimeout(() => {
        animatePageNumbers();
    }, 500);
});

// 地图控制按钮切换
const mapControlButtons = document.querySelectorAll('.control-btn');
mapControlButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        mapControlButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // 切换地图和列表显示
        const mapContainer = document.querySelector('.map-container');
        const mapList = document.querySelector('.map-list');
        
        if (btn.textContent.includes('列表')) {
            if (mapContainer) mapContainer.style.display = 'none';
            if (mapList) mapList.style.display = 'grid';
        } else {
            if (mapContainer) mapContainer.style.display = 'block';
            if (mapList) mapList.style.display = 'none';
        }
    });
});

// 筛选标签切换
const filterTags = document.querySelectorAll('.filter-tag');
filterTags.forEach(tag => {
    tag.addEventListener('click', () => {
        // 如果是"全部"标签，移除其他标签的active状态
        if (tag.textContent.includes('全部')) {
            filterTags.forEach(t => {
                if (!t.textContent.includes('全部')) {
                    t.classList.remove('active');
                }
            });
        } else {
            // 移除"全部"标签的active状态
            filterTags.forEach(t => {
                if (t.textContent.includes('全部')) {
                    t.classList.remove('active');
                }
            });
        }
        
        tag.classList.toggle('active');
    });
});

// 搜索功能（示例）
const searchInputs = document.querySelectorAll('.search-input, .graph-search');
searchInputs.forEach(input => {
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const searchBtn = input.nextElementSibling || input.parentElement.querySelector('.search-btn');
            if (searchBtn) {
                searchBtn.click();
            }
        }
    });
});

// 加载更多按钮
const loadMoreButtons = document.querySelectorAll('.btn-more');
loadMoreButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        // 这里可以添加加载更多数据的逻辑
        btn.textContent = '加载中...';
        setTimeout(() => {
            btn.textContent = '加载更多';
            alert('更多内容加载功能需要连接后端API');
        }, 1000);
    });
});

// 时间轴动画（仅在page-scripts中使用，避免与script.js冲突）
(function() {
    'use strict';
    let pageTimelineObserver;
    
    if (typeof window.timelineObserver === 'undefined') {
        pageTimelineObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry, index) => {
                if (entry.isIntersecting) {
                    setTimeout(() => {
                        entry.target.style.opacity = '1';
                        entry.target.style.transform = 'translateX(0)';
                    }, index * 200);
                    pageTimelineObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.2 });
        
        window.pageTimelineObserver = pageTimelineObserver;
    } else {
        pageTimelineObserver = window.timelineObserver;
    }

    document.querySelectorAll('.timeline-item').forEach((item, index) => {
        item.style.opacity = '0';
        item.style.transform = 'translateX(-30px)';
        item.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        if (pageTimelineObserver) {
            pageTimelineObserver.observe(item);
        }
    });
})();

// 卡片动画
const cardObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
            cardObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.1 });

document.querySelectorAll('.person-card, .category-card, .detail-link-card').forEach(card => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(30px)';
    card.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    cardObserver.observe(card);
});

console.log('页面脚本已加载完成！');












