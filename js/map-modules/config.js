// 配置常量模块

// 皖北六市配置
const WANBEI_CITIES = [
    { key: '阜阳', name: '阜阳市', fullName: '阜阳市' },
    { key: '亳州', name: '亳州市', fullName: '亳州市' },
    { key: '淮北', name: '淮北市', fullName: '淮北市' },
    { key: '宿州', name: '宿州市', fullName: '宿州市' },
    { key: '蚌埠', name: '蚌埠市', fullName: '蚌埠市' },
    { key: '淮南', name: '淮南市', fullName: '淮南市' }
];

// 颜色配置（根据事件数量范围）- 5个层级
const COLOR_RANGES = [
    { min: 100, color: '#FFD700', label: '100件以上' },      // 黄色
    { min: 75, max: 100, color: '#FFA500', label: '75-100件' }, // 橙色
    { min: 50, max: 75, color: '#FF6347', label: '50-75件' },   // 红橙色
    { min: 25, max: 50, color: '#9370DB', label: '25-50件' },   // 紫色
    { min: 0, max: 25, color: '#87CEEB', label: '25件以下' }    // 天蓝色
];
































