# GitHub Pages 部署指南

## 部署步骤

### 1. 创建 GitHub 仓库

1. 登录 GitHub，点击右上角的 "+" → "New repository"
2. 仓库名称建议：`wanbei-knowledge-graph` 或 `wanbei-map`
3. 设置为 Public（GitHub Pages 免费版需要公开仓库）
4. 不要初始化 README、.gitignore 或 license
5. 点击 "Create repository"

### 2. 初始化 Git 仓库并推送代码

在项目根目录（`展示网站`文件夹）打开终端，执行：

```bash
# 初始化 Git 仓库
git init

# 添加所有文件
git add .

# 提交
git commit -m "Initial commit: 皖北军事环境成因知识图谱平台"

# 添加远程仓库（替换 YOUR_USERNAME 和 YOUR_REPO_NAME）
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git

# 推送到 GitHub
git branch -M main
git push -u origin main
```

### 3. 启用 GitHub Pages

1. 在 GitHub 仓库页面，点击 "Settings"（设置）
2. 在左侧菜单找到 "Pages"
3. 在 "Source" 部分：
   - 选择 "Deploy from a branch"
   - Branch 选择 "main"
   - Folder 选择 "/ (root)"
4. 点击 "Save"
5. 等待几分钟，GitHub Pages 会自动部署
6. 访问地址：`https://YOUR_USERNAME.github.io/YOUR_REPO_NAME/`

### 4. 访问网站

部署完成后，可以通过以下地址访问：
- `https://YOUR_USERNAME.github.io/YOUR_REPO_NAME/index.html`
- `https://YOUR_USERNAME.github.io/YOUR_REPO_NAME/map-canvas.html`

## 注意事项

### 文件路径
- 所有文件路径都使用相对路径（如 `./boundaries/亳州市.json`），GitHub Pages 会自动处理
- 确保所有资源文件（JSON、图片等）都在仓库中

### 自定义域名（可选）
如果需要使用自定义域名：
1. 在仓库根目录创建 `CNAME` 文件
2. 文件内容为你的域名，例如：`example.com`
3. 在域名 DNS 设置中添加 CNAME 记录指向 `YOUR_USERNAME.github.io`

### 更新网站
每次更新后，只需：
```bash
git add .
git commit -m "更新内容描述"
git push
```
GitHub Pages 会自动重新部署（通常需要几分钟）

## 文件说明

### 需要部署的文件
- 所有 `.html` 文件
- 所有 `.js` 文件
- 所有 `.css` 文件
- `boundaries/` 文件夹中的所有 JSON 文件
- `six_cities_from_anhui.geojson` 等 GeoJSON 文件
- `data.json` 等数据文件

### 不需要部署的文件（已在 .gitignore 中排除）
- `.bat` 批处理文件
- `.py` Python 脚本（除非需要）
- `README.md` 等文档（可选保留）

## 常见问题

### 1. 页面显示 404
- 检查文件路径是否正确
- 确保 `index.html` 在根目录
- 检查 GitHub Pages 设置中的 Source 是否正确

### 2. 资源文件加载失败
- 检查文件路径是否使用相对路径
- 确保所有资源文件都已提交到仓库
- 检查浏览器控制台的错误信息

### 3. 地图不显示
- 检查 `boundaries/` 文件夹中的 JSON 文件是否都存在
- 检查 `six_cities_from_anhui.geojson` 文件是否存在
- 查看浏览器控制台的网络请求，确认文件是否成功加载

### 4. 更新后没有变化
- GitHub Pages 部署需要几分钟时间
- 清除浏览器缓存（Ctrl+F5）
- 检查 GitHub Actions 中的部署状态

## 高级配置

### 使用 GitHub Actions 自动部署（可选）
如果需要在每次推送时自动构建和部署，可以创建 `.github/workflows/deploy.yml` 文件（已创建）

### 使用 Jekyll（不推荐）
GitHub Pages 默认使用 Jekyll，但我们的项目是纯静态文件，不需要 Jekyll。
如果遇到 Jekyll 相关错误，可以在根目录创建 `.nojekyll` 文件（已创建）

