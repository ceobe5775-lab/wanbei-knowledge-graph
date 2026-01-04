// 导航栏滚动效果
window.addEventListener('scroll', () => {
    const navbar = document.querySelector('.navbar');
    if (window.scrollY > 50) {
        navbar.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
    } else {
        navbar.style.boxShadow = '0 1px 2px 0 rgba(0, 0, 0, 0.05)';
    }
});

// 平滑滚动
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            const offsetTop = target.offsetTop - 70;
            window.scrollTo({
                top: offsetTop,
                behavior: 'smooth'
            });
            
            // 更新活动链接
            document.querySelectorAll('.nav-link').forEach(link => {
                link.classList.remove('active');
            });
            this.classList.add('active');
        }
    });
});

// 移动端菜单切换
const navToggle = document.querySelector('.nav-toggle');
const navMenu = document.querySelector('.nav-menu');

// 使用 ResizeObserver 实时监听容器大小变化
let resizeObserver = null;

// 检测导航菜单是否换行（两行）
function checkNavMenuWrap() {
    if (!navMenu || !navToggle) return;
    
    const navContainer = navMenu.closest('.container');
    if (!navContainer) return;
    
    const navBrand = navContainer.querySelector('.nav-brand');
    if (!navBrand) return;
    
    // 判断是否为移动端
    const isMobile = window.innerWidth < 768;
    
    // 如果是移动端，使用移动端逻辑
    if (isMobile) {
        navToggle.style.display = 'flex';
        if (!navMenu.classList.contains('active')) {
            navMenu.style.left = '-100%';
        }
        return;
    }
    
    // 桌面端：先快速隐藏菜单并显示切换按钮，避免闪烁
    const wasActive = navMenu.classList.contains('active');
    
    // 先快速隐藏菜单，避免看到换行（使用 opacity 和 visibility 实现平滑过渡）
    const originalOpacity = navMenu.style.opacity;
    const originalVisibility = navMenu.style.visibility;
    navMenu.style.opacity = '0';
    navMenu.style.visibility = 'hidden';
    navMenu.style.transition = 'opacity 0.1s ease, visibility 0.1s ease';
    navMenu.style.position = '';
    navMenu.style.left = '';
    
    // 显示切换按钮（使用 requestAnimationFrame 确保同步）
    requestAnimationFrame(() => {
        navToggle.style.display = 'flex';
        navToggle.style.opacity = '1';
        navToggle.style.transition = 'opacity 0.2s ease';
        // 强制浏览器渲染切换按钮
        void navToggle.offsetWidth;
        
        // 立即在下一帧进行测量
        requestAnimationFrame(() => {
            // 恢复菜单显示进行测量（但保持隐藏）
            navMenu.style.display = 'flex';
            navMenu.style.opacity = '0';
            navMenu.style.visibility = 'hidden';
            
            // 强制重新计算布局
            void navMenu.offsetWidth;
            
            // 获取导航栏容器的可用宽度（现在切换按钮已经显示）
            const containerWidth = navContainer.offsetWidth;
            const brandWidth = navBrand.offsetWidth;
            const brandMargin = parseInt(window.getComputedStyle(navBrand).marginRight) || 0;
            const toggleWidth = navToggle.offsetWidth || 25;
            const availableWidth = containerWidth - brandWidth - brandMargin - toggleWidth - 30; // 30px 额外边距
            
            // 检查菜单是否超出可用宽度
            const menuWidth = navMenu.scrollWidth;
            const menuHeight = navMenu.offsetHeight;
            const firstLink = navMenu.querySelector('.nav-link');
            const firstLinkHeight = firstLink ? parseInt(window.getComputedStyle(firstLink).lineHeight) || firstLink.offsetHeight : 0;
            
            // 判断是否换行：菜单高度超过单行高度，或菜单宽度超出可用空间
            const hasWrapped = menuWidth > availableWidth || (firstLinkHeight > 0 && menuHeight > firstLinkHeight * 1.5);
            
            // 根据检测结果设置菜单状态
            if (hasWrapped) {
                // 换行：隐藏菜单，显示切换按钮
                navToggle.style.display = 'flex';
                navToggle.style.opacity = '1';
                navMenu.style.display = 'none';
                navMenu.style.opacity = '';
                navMenu.style.visibility = '';
                navMenu.style.transition = '';
                if (!wasActive) {
                    navMenu.classList.remove('active');
                }
            } else {
                // 不换行：显示菜单，隐藏切换按钮
                navToggle.style.display = 'none';
                navToggle.style.opacity = '0';
                navMenu.style.display = 'flex';
                navMenu.style.opacity = '1';
                navMenu.style.visibility = 'visible';
                navMenu.style.transition = 'opacity 0.2s ease, visibility 0.2s ease';
                navMenu.style.position = '';
                navMenu.style.left = '';
                navMenu.classList.remove('active');
            }
        });
    });
}

// 初始化时检查
function initNavToggle() {
    if (navToggle && navMenu) {
        const navContainer = navMenu.closest('.container');
        
        // 页面加载完成后立即检查（多次检查确保准确）
        function doCheck() {
            checkNavMenuWrap();
        }
        
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                // 立即检查一次
                doCheck();
                // 延迟再检查一次，确保布局已稳定
                setTimeout(doCheck, 50);
                setTimeout(doCheck, 200);
            });
        } else {
            doCheck();
            setTimeout(doCheck, 50);
            setTimeout(doCheck, 200);
        }
        
        // 使用 ResizeObserver 实时监听容器大小变化
        if (navContainer && window.ResizeObserver) {
            resizeObserver = new ResizeObserver(() => {
                // 使用 requestAnimationFrame 确保在下一帧检查
                requestAnimationFrame(() => {
                    checkNavMenuWrap();
                });
            });
            resizeObserver.observe(navContainer);
        }
        
        // 窗口大小改变时重新检查（作为 ResizeObserver 的备用方案）
        let resizeTimer;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                requestAnimationFrame(checkNavMenuWrap);
            }, 50);
        });
        
        navToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            const isActive = navMenu.classList.toggle('active');
            navToggle.classList.toggle('active');
            
            // 判断是否为移动端
            const isMobile = window.innerWidth < 768;
            
            // 切换菜单显示/隐藏
            if (isMobile) {
                // 移动端使用 left 定位
                navMenu.style.display = '';
                if (isActive) {
                    navMenu.style.left = '0';
                } else {
                    navMenu.style.left = '-100%';
                }
            } else {
                // 桌面端使用 display 和 position 切换
                if (isActive) {
                    navMenu.style.display = 'flex';
                    navMenu.style.position = 'absolute';
                } else {
                    navMenu.style.display = 'none';
                    navMenu.style.position = '';
                }
            }
            
            // 更新ARIA属性
            navToggle.setAttribute('aria-expanded', isActive ? 'true' : 'false');
        });
        
        // 点击页面其他地方时关闭桌面端菜单
        document.addEventListener('click', (e) => {
            if (window.innerWidth >= 768 && navMenu && navToggle) {
                if (!navMenu.contains(e.target) && !navToggle.contains(e.target)) {
                    navMenu.classList.remove('active');
                    navToggle.classList.remove('active');
                    navMenu.style.display = 'none';
                    navMenu.style.position = '';
                    navToggle.setAttribute('aria-expanded', 'false');
                }
            }
        });
    }
}

// 执行初始化
initNavToggle();

// 点击菜单项后关闭移动端菜单
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
        navMenu.classList.remove('active');
        navToggle.classList.remove('active');
    });
});

// 滚动时更新活动导航链接
const sections = document.querySelectorAll('section[id]');
const navLinks = document.querySelectorAll('.nav-link');

window.addEventListener('scroll', () => {
    let current = '';
    const scrollY = window.pageYOffset;

    sections.forEach(section => {
        const sectionTop = section.offsetTop - 100;
        const sectionHeight = section.clientHeight;
        if (scrollY >= sectionTop && scrollY < sectionTop + sectionHeight) {
            current = section.getAttribute('id');
        }
    });

    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === `#${current}`) {
            link.classList.add('active');
        }
    });
});

// 卡片动画（Intersection Observer）
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

// 观察所有卡片元素
document.querySelectorAll('.intro-card, .feature-card, .step-card, .demo-module, .timeline-item').forEach(card => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(30px)';
    card.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    observer.observe(card);
});

// 数字动画函数
const animateNumber = (element, target, suffix = '') => {
    const duration = 2000;
    const increment = target / (duration / 16);
    let current = 0;
    
    const updateNumber = () => {
        current += increment;
        if (current < target) {
            element.textContent = Math.floor(current) + suffix;
            requestAnimationFrame(updateNumber);
        } else {
            element.textContent = target + suffix;
        }
    };
    
    updateNumber();
};

// Hero 区域数字动画
const animateHeroNumbers = () => {
    const stats = document.querySelectorAll('.hero .stat-number');
    stats.forEach(stat => {
        const target = parseInt(stat.textContent.replace(/\D/g, ''));
        animateNumber(stat, target, '+');
    });
};

// 演示区域数字动画
const animateDemoNumbers = () => {
    const stats = document.querySelectorAll('.stat-big-number');
    stats.forEach(stat => {
        const target = parseInt(stat.getAttribute('data-target'));
        if (target) {
            stat.textContent = '0';
            animateNumber(stat, target);
        }
    });
};

// 当 Hero 区域进入视口时启动数字动画
const heroObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            animateHeroNumbers();
            heroObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.5 });

const heroSection = document.querySelector('.hero');
if (heroSection) {
    heroObserver.observe(heroSection);
}

// 当演示概览区域进入视口时启动数字动画
const demoOverviewObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            animateDemoNumbers();
            demoOverviewObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.3 });

const demoOverviewSection = document.querySelector('.demo-overview');
if (demoOverviewSection) {
    demoOverviewObserver.observe(demoOverviewSection);
}

// 代码块复制功能（可选）
document.querySelectorAll('pre code').forEach(codeBlock => {
    const pre = codeBlock.parentElement;
    if (pre && !pre.querySelector('.copy-btn')) {
        const copyBtn = document.createElement('button');
        copyBtn.className = 'copy-btn';
        copyBtn.textContent = '复制';
        copyBtn.style.cssText = `
            position: absolute;
            top: 10px;
            right: 10px;
            padding: 5px 10px;
            background: var(--primary-color);
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 0.8rem;
        `;
        
        pre.style.position = 'relative';
        copyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(codeBlock.textContent).then(() => {
                copyBtn.textContent = '已复制!';
                setTimeout(() => {
                    copyBtn.textContent = '复制';
                }, 2000);
            });
        });
        
        pre.appendChild(copyBtn);
    }
});

// 时间轴动画
const timelineObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry, index) => {
        if (entry.isIntersecting) {
            setTimeout(() => {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateX(0)';
            }, index * 200);
            timelineObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.2 });

document.querySelectorAll('.timeline-item').forEach((item, index) => {
    item.style.opacity = '0';
    item.style.transform = 'translateX(-30px)';
    item.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    timelineObserver.observe(item);
});

// 预览区域动画
const previewObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'scale(1)';
            previewObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.3 });

document.querySelectorAll('.preview-placeholder').forEach(preview => {
    preview.style.opacity = '0';
    preview.style.transform = 'scale(0.95)';
    preview.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    previewObserver.observe(preview);
});

// 脉冲动画
const pulseAnimation = () => {
    const connectionLines = document.querySelectorAll('.connection-line');
    connectionLines.forEach((line, index) => {
        line.style.animationDelay = `${index * 0.5}s`;
    });
};

pulseAnimation();

console.log('展示网站已加载完成！');