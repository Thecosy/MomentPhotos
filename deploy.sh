#!/bin/bash

# MomentPhotos 自动部署脚本
# 服务器: 106.55.163.101

SERVER_IP="106.55.163.101"
SERVER_USER="ubuntu"
SERVER_PASSWORD="|8#n4\$bH^vt.cKR"

echo "=========================================="
echo "MomentPhotos 自动部署脚本"
echo "=========================================="

# 检查是否安装了 sshpass
if ! command -v sshpass &> /dev/null; then
    echo "正在安装 sshpass..."
    # Windows 用户需要手动安装或使用 WSL
    echo "Windows 用户请使用 WSL 或手动部署"
    echo "请参考 DEPLOYMENT.md 文件"
    exit 1
fi

echo "1. 连接到服务器并检查环境..."
sshpass -p "$SERVER_PASSWORD" ssh -o StrictHostKeyChecking=no $SERVER_USER@$SERVER_IP << 'ENDSSH'
    echo "已连接到服务器"
    uname -a

    # 检查并安装 Node.js
    if ! command -v node &> /dev/null; then
        echo "安装 Node.js..."
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt install -y nodejs
    fi

    # 检查并安装 Python
    if ! command -v python3 &> /dev/null; then
        echo "安装 Python..."
        sudo apt install -y python3 python3-pip python3-venv
    fi

    # 检查并安装 Git
    if ! command -v git &> /dev/null; then
        echo "安装 Git..."
        sudo apt install -y git
    fi

    # 检查并安装 PM2
    if ! command -v pm2 &> /dev/null; then
        echo "安装 PM2..."
        sudo npm install -g pm2
    fi

    echo "环境检查完成"
    node --version
    npm --version
    python3 --version
    pm2 --version
ENDSSH

echo ""
echo "2. 克隆或更新项目..."
sshpass -p "$SERVER_PASSWORD" ssh -o StrictHostKeyChecking=no $SERVER_USER@$SERVER_IP << 'ENDSSH'
    mkdir -p ~/projects
    cd ~/projects

    if [ -d "MomentPhotos" ]; then
        echo "项目已存在，拉取最新代码..."
        cd MomentPhotos
        git pull
    else
        echo "克隆项目..."
        git clone https://github.com/Thecosy/MomentPhotos.git
        cd MomentPhotos
    fi
ENDSSH

echo ""
echo "3. 上传配置文件..."
# 这里需要手动配置 .env 文件
echo "请手动配置服务器上的 .env 文件"
echo "ssh ubuntu@106.55.163.101"
echo "cd ~/projects/MomentPhotos"
echo "nano .env"

echo ""
echo "=========================================="
echo "部署脚本执行完成"
echo "请按照 DEPLOYMENT.md 继续手动配置"
echo "=========================================="
