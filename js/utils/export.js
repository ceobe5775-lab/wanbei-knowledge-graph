/**
 * 数据导出工具
 */

/**
 * 导出数据为CSV格式
 * @param {Array} data - 数据数组
 * @param {string} filename - 文件名
 */
function exportToCSV(data, filename = 'export.csv') {
    if (!data || data.length === 0) {
        if (typeof window.toast !== 'undefined') {
            window.toast.warning('没有数据可导出', 3000);
        }
        return;
    }

    // 获取所有唯一的键
    const keys = new Set();
    data.forEach(item => {
        Object.keys(item.properties || item).forEach(key => keys.add(key));
    });

    const headers = Array.from(keys);
    
    // 创建CSV内容，添加BOM以支持中文
    let csv = '\uFEFF' + headers.join(',') + '\n';
    
    data.forEach(item => {
        const props = item.properties || item;
        const row = headers.map(key => {
            const value = props[key] || '';
            // 处理包含逗号、引号或换行符的值
            if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
                return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
        });
        csv += row.join(',') + '\n';
    });

    // 下载文件
    downloadFile(csv, filename, 'text/csv');
    
    if (typeof window.toast !== 'undefined') {
        window.toast.success('CSV文件导出成功', 2000);
    }
}

/**
 * 导出数据为JSON格式
 * @param {Object|Array} data - 数据
 * @param {string} filename - 文件名
 */
function exportToJSON(data, filename = 'export.json') {
    if (!data) {
        if (typeof window.toast !== 'undefined') {
            window.toast.warning('没有数据可导出', 3000);
        }
        return;
    }

    const json = JSON.stringify(data, null, 2);
    downloadFile(json, filename, 'application/json');
    
    if (typeof window.toast !== 'undefined') {
        window.toast.success('JSON文件导出成功', 2000);
    }
}

/**
 * 导出知识图谱为图片
 * @param {string} containerId - 容器ID
 * @param {string} filename - 文件名
 */
function exportGraphAsImage(containerId = 'cy', filename = 'knowledge-graph.png') {
    const container = document.getElementById(containerId);
    if (!container) {
        if (typeof window.toast !== 'undefined') {
            window.toast.error('找不到图谱容器', 3000);
        }
        return;
    }

    // 使用html2canvas库（如果可用）
    if (typeof html2canvas !== 'undefined') {
        html2canvas(container, {
            backgroundColor: '#ffffff',
            scale: 2
        }).then(canvas => {
            canvas.toBlob(blob => {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                a.click();
                URL.revokeObjectURL(url);
                
                if (typeof window.toast !== 'undefined') {
                    window.toast.success('图片导出成功', 2000);
                }
            }, 'image/png');
        }).catch(error => {
            console.error('导出图片失败:', error);
            if (typeof window.toast !== 'undefined') {
                window.toast.error('导出图片失败', 3000);
            }
        });
    } else {
        // 降级方案：提示用户使用浏览器截图
        if (typeof window.toast !== 'undefined') {
            window.toast.info('请使用浏览器截图功能（F12 -> 截图工具）', 5000);
        }
    }
}

/**
 * 下载文件
 * @param {string} content - 文件内容
 * @param {string} filename - 文件名
 * @param {string} mimeType - MIME类型
 */
function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { exportToCSV, exportToJSON, exportGraphAsImage };
} else {
    window.exportToCSV = exportToCSV;
    window.exportToJSON = exportToJSON;
    window.exportGraphAsImage = exportGraphAsImage;
}

