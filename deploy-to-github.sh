#!/bin/bash
# GitHub Pages 快速部署脚本

echo "=== GitHub Pages 部署脚本 ==="
echo ""

# 检查是否已初始化 Git
if [ ! -d ".git" ]; then
    echo "初始化 Git 仓库..."
    git init
fi

# 添加所有文件
echo "添加文件到 Git..."
git add .

# 检查是否有未提交的更改
if git diff --staged --quiet; then
    echo "没有需要提交的更改"
else
    # 提交更改
    read -p "请输入提交信息（默认: Update）: " commit_msg
    commit_msg=${commit_msg:-Update}
    git commit -m "$commit_msg"
    echo "✓ 已提交更改"
fi

# 检查远程仓库
if git remote | grep -q "^origin$"; then
    echo "检测到远程仓库 origin"
    remote_url=$(git remote get-url origin)
    echo "远程仓库地址: $remote_url"
else
    echo "未检测到远程仓库"
    read -p "请输入 GitHub 仓库地址 (例如: https://github.com/username/repo.git): " repo_url
    if [ -n "$repo_url" ]; then
        git remote add origin "$repo_url"
        echo "✓ 已添加远程仓库"
    else
        echo "未提供仓库地址，跳过推送"
        exit 0
    fi
fi

# 检查当前分支
current_branch=$(git branch --show-current)
if [ -z "$current_branch" ]; then
    git branch -M main
    current_branch="main"
fi

# 推送代码
echo ""
echo "推送到 GitHub..."
git push -u origin "$current_branch"

echo ""
echo "=== 部署完成 ==="
echo ""
echo "下一步："
echo "1. 访问 GitHub 仓库页面"
echo "2. 进入 Settings > Pages"
echo "3. 选择 Source: Deploy from a branch"
echo "4. 选择 Branch: $current_branch, Folder: / (root)"
echo "5. 点击 Save"
echo ""
echo "部署完成后，访问: https://YOUR_USERNAME.github.io/YOUR_REPO_NAME/"

