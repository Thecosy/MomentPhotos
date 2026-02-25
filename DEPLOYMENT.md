# MomentPhotos 部署指南

## 服务器信息
- **IP**: 106.55.163.101
- **系统**: Ubuntu Server 24.04 LTS 64bit
- **用户**: ubuntu
- **密码**: |8#n4$bH^vt.cKR

## 部署步骤

### 1. 连接到服务器

```bash
ssh ubuntu@106.55.163.101
# 输入密码: |8#n4$bH^vt.cKR
```

### 2. 安装必要的软件

```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装 Node.js 20.x (LTS)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 安装 Python 3 和 pip
sudo apt install -y python3 python3-pip python3-venv

# 安装 Git
sudo apt install -y git

# 安装 PM2 (进程管理器)
sudo npm install -g pm2

# 验证安装
node --version
npm --version
python3 --version
```

### 3. 克隆项目

```bash
# 创建项目目录
mkdir -p ~/projects
cd ~/projects

# 克隆项目
git clone https://github.com/Thecosy/MomentPhotos.git
cd MomentPhotos
```

### 4. 配置环境变量

```bash
# 创建 .env 文件
cat > .env << 'EOF'
# 本地图库路径（服务器上需要调整）
WATCH_DIR=/home/ubuntu/photo_library

# 七牛云配置
QINIU_ACCESS_KEY=your_access_key
QINIU_SECRET_KEY=your_secret_key
QINIU_BUCKET=your_bucket_name
QINIU_DOMAIN=your_domain.com
QINIU_REGION=huanan

# 高德地图API（可选）
GAODE_KEY=your_gaode_key

# 管理员账号
USERNAME=admin
PASSWORD=admin123

# Webhook配置
WEBHOOK_URL=http://localhost:3001/api/webhook
WEBHOOK_SECRET=update_momentography

# 端口配置
PORT=8089
EOF

# 编辑 .env 文件，填入真实的配置
nano .env
```

### 5. 安装 Python 依赖

```bash
# 创建虚拟环境
python3 -m venv venv
source venv/bin/activate

# 安装依赖
pip install -r requirements.txt

# 如果没有 requirements.txt，手动安装
pip install flask qiniu python-dotenv pillow exifread rawpy loguru requests better-sqlite3
```

### 6. 安装前端依赖并构建

```bash
cd Momentography

# 安装依赖
npm install

# 构建生产版本
npm run build

cd ..
```

### 7. 配置 Nginx 反向代理

```bash
# 安装 Nginx
sudo apt install -y nginx

# 创建 Nginx 配置
sudo nano /etc/nginx/sites-available/momentphotos
```

添加以下配置：

```nginx
server {
    listen 80;
    server_name 106.55.163.101;  # 或者你的域名

    # 前端
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # 后端 API
    location /webhook {
        proxy_pass http://localhost:8089;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # 静态文件缓存
    location /_next/static {
        proxy_pass http://localhost:3001;
        proxy_cache_valid 200 60m;
        add_header Cache-Control "public, immutable";
    }
}
```

启用配置：

```bash
# 创建软链接
sudo ln -s /etc/nginx/sites-available/momentphotos /etc/nginx/sites-enabled/

# 删除默认配置
sudo rm /etc/nginx/sites-enabled/default

# 测试配置
sudo nginx -t

# 重启 Nginx
sudo systemctl restart nginx
sudo systemctl enable nginx
```

### 8. 使用 PM2 启动服务

```bash
cd ~/projects/MomentPhotos

# 启动后端服务器
pm2 start server.py --name momentphotos-backend --interpreter python3

# 启动前端服务器
cd Momentography
pm2 start npm --name momentphotos-frontend -- start

# 保存 PM2 配置
pm2 save

# 设置 PM2 开机自启
pm2 startup
# 执行输出的命令（通常是 sudo 开头的命令）
```

### 9. 配置防火墙

```bash
# 允许 HTTP 和 HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 22/tcp  # SSH

# 启用防火墙
sudo ufw enable
```

### 10. 验证部署

```bash
# 查看服务状态
pm2 status

# 查看日志
pm2 logs momentphotos-frontend
pm2 logs momentphotos-backend

# 测试访问
curl http://localhost:3001
curl http://localhost:8089
```

访问 http://106.55.163.101 查看网站

## 常用命令

### PM2 管理

```bash
# 查看状态
pm2 status

# 重启服务
pm2 restart momentphotos-frontend
pm2 restart momentphotos-backend

# 停止服务
pm2 stop momentphotos-frontend
pm2 stop momentphotos-backend

# 查看日志
pm2 logs momentphotos-frontend
pm2 logs momentphotos-backend

# 清空日志
pm2 flush
```

### 更新代码

```bash
cd ~/projects/MomentPhotos

# 拉取最新代码
git pull

# 重新构建前端
cd Momentography
npm install
npm run build

# 重启服务
pm2 restart momentphotos-frontend
pm2 restart momentphotos-backend
```

### 数据库备份

```bash
# 备份数据库
cp ~/projects/MomentPhotos/Momentography/data/gallery.db ~/backups/gallery-$(date +%Y%m%d).db

# 备份 JSON 数据
cp ~/projects/MomentPhotos/Momentography/public/data/*.json ~/backups/
```

## 可选：配置 HTTPS (使用 Let's Encrypt)

```bash
# 安装 Certbot
sudo apt install -y certbot python3-certbot-nginx

# 获取证书（需要域名）
sudo certbot --nginx -d your-domain.com

# 自动续期
sudo certbot renew --dry-run
```

## 故障排查

### 前端无法访问

```bash
# 检查前端服务
pm2 logs momentphotos-frontend

# 检查端口占用
sudo netstat -tlnp | grep 3001

# 重启前端
pm2 restart momentphotos-frontend
```

### 后端无法访问

```bash
# 检查后端服务
pm2 logs momentphotos-backend

# 检查端口占用
sudo netstat -tlnp | grep 8089

# 重启后端
pm2 restart momentphotos-backend
```

### Nginx 问题

```bash
# 检查 Nginx 状态
sudo systemctl status nginx

# 查看 Nginx 错误日志
sudo tail -f /var/log/nginx/error.log

# 重启 Nginx
sudo systemctl restart nginx
```

## 性能优化建议

1. **启用 Gzip 压缩**（Nginx 配置）
2. **配置 CDN**（七牛云）
3. **数据库定期备份**
4. **日志轮转**（PM2 自动处理）
5. **监控服务状态**（PM2 + Monit）

## 安全建议

1. **修改默认密码**
2. **配置 SSH 密钥登录**
3. **禁用 root 登录**
4. **定期更新系统**
5. **配置 fail2ban 防止暴力破解**
