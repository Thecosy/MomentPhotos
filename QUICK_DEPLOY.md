# 快速部署命令（复制粘贴执行）

## 第一步：连接服务器
```bash
ssh ubuntu@106.55.163.101
# 密码: |8#n4$bH^vt.cKR
```

## 第二步：一键安装环境（复制整段执行）
```bash
# 更新系统并安装基础软件
sudo apt update && sudo apt upgrade -y && \
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && \
sudo apt install -y nodejs python3 python3-pip python3-venv git nginx && \
sudo npm install -g pm2 && \
echo "环境安装完成" && \
node --version && npm --version && python3 --version
```

## 第三步：克隆项目
```bash
mkdir -p ~/projects && cd ~/projects && \
git clone https://github.com/Thecosy/MomentPhotos.git && \
cd MomentPhotos && \
echo "项目克隆完成"
```

## 第四步：配置环境变量
```bash
cat > .env << 'EOF'
# 本地图库路径
WATCH_DIR=/home/ubuntu/photo_library

# 七牛云配置（请修改为你的真实配置）
QINIU_ACCESS_KEY=your_access_key_here
QINIU_SECRET_KEY=your_secret_key_here
QINIU_BUCKET=your_bucket_name
QINIU_DOMAIN=img3.icecmspro.com
QINIU_REGION=huanan

# 管理员账号
USERNAME=admin
PASSWORD=admin123

# Webhook配置
WEBHOOK_URL=http://localhost:3001/api/webhook
WEBHOOK_SECRET=update_momentography

# 端口配置
PORT=8089
EOF

# 编辑配置文件，填入真实的七牛云配置
nano .env
# 按 Ctrl+X, 然后 Y, 然后 Enter 保存
```

## 第五步：安装Python依赖
```bash
cd ~/projects/MomentPhotos && \
python3 -m venv venv && \
source venv/bin/activate && \
pip install flask qiniu python-dotenv pillow exifread rawpy loguru requests better-sqlite3 && \
echo "Python依赖安装完成"
```

## 第六步：安装前端依赖并构建
```bash
cd ~/projects/MomentPhotos/Momentography && \
npm install && \
npm run build && \
echo "前端构建完成"
```

## 第七步：配置Nginx
```bash
sudo tee /etc/nginx/sites-available/momentphotos > /dev/null << 'EOF'
server {
    listen 80;
    server_name 106.55.163.101;

    client_max_body_size 100M;

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

    # 后端webhook
    location /webhook {
        proxy_pass http://localhost:8089;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # 静态文件缓存
    location /_next/static {
        proxy_pass http://localhost:3001;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF

# 启用配置
sudo ln -sf /etc/nginx/sites-available/momentphotos /etc/nginx/sites-enabled/ && \
sudo rm -f /etc/nginx/sites-enabled/default && \
sudo nginx -t && \
sudo systemctl restart nginx && \
sudo systemctl enable nginx && \
echo "Nginx配置完成"
```

## 第八步：启动服务
```bash
cd ~/projects/MomentPhotos && \

# 启动后端
pm2 start server.py --name momentphotos-backend --interpreter python3 && \

# 启动前端
cd Momentography && \
pm2 start npm --name momentphotos-frontend -- start && \

# 保存配置
pm2 save && \
pm2 startup && \
echo "服务启动完成"
```

**注意：执行 pm2 startup 后，会输出一条 sudo 命令，复制并执行它**

## 第九步：配置防火墙
```bash
sudo ufw allow 80/tcp && \
sudo ufw allow 443/tcp && \
sudo ufw allow 22/tcp && \
sudo ufw --force enable && \
echo "防火墙配置完成"
```

## 第十步：验证部署
```bash
pm2 status && \
curl -I http://localhost:3001 && \
echo "部署完成！访问 http://106.55.163.101"
```

---

## 常用管理命令

### 查看服务状态
```bash
pm2 status
```

### 查看日志
```bash
pm2 logs momentphotos-frontend
pm2 logs momentphotos-backend
```

### 重启服务
```bash
pm2 restart momentphotos-frontend
pm2 restart momentphotos-backend
```

### 更新代码
```bash
cd ~/projects/MomentPhotos && \
git pull && \
cd Momentography && \
npm install && \
npm run build && \
pm2 restart all
```

### 备份数据库
```bash
mkdir -p ~/backups && \
cp ~/projects/MomentPhotos/Momentography/data/gallery.db ~/backups/gallery-$(date +%Y%m%d-%H%M%S).db
```

---

## 故障排查

### 如果前端无法访问
```bash
# 查看日志
pm2 logs momentphotos-frontend

# 检查端口
sudo netstat -tlnp | grep 3001

# 重启服务
pm2 restart momentphotos-frontend
```

### 如果Nginx报错
```bash
# 查看错误日志
sudo tail -f /var/log/nginx/error.log

# 测试配置
sudo nginx -t

# 重启Nginx
sudo systemctl restart nginx
```

### 如果需要重新部署
```bash
# 停止所有服务
pm2 stop all
pm2 delete all

# 删除项目
rm -rf ~/projects/MomentPhotos

# 重新开始从第三步执行
```
