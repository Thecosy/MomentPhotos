# 📸 MomentPhotos · 片刻相册

一个优雅的摄影作品展示网站，基于 Next.js 构建，采用现代化的设计理念。

![预览图](public/preview.png)

## ✨ 特性

- 🎨 现代简约的设计风格
- 🌓 自适应深色模式
- 📱 完全响应式布局
- 🗺️ 基于地图的照片浏览
- 📅 时间线式作品展示
- 🏷️ 智能的照片分类
- 📊 EXIF 信息展示
- ⚡️ 快速的图片加载
- 🔍 照片评分系统

## 🛠️ 技术栈

- **框架**: [Next.js](https://nextjs.org/)
- **样式**: [Tailwind CSS](https://tailwindcss.com/)
- **动画**: [Framer Motion](https://www.framer.com/motion/)
- **图标**: [Phosphor Icons](https://phosphoricons.com/)
- **地图**: [React Leaflet](https://react-leaflet.js.org/)
- **UI组件**: [@headlessui/react](https://headlessui.com/)

## 🚀 快速开始（本地）

1. 克隆项目

```bash
git clone https://github.com/yourusername/photo-gallery.git
cd photo-gallery/Momentography
```

2. 安装依赖

```bash
npm install
# 或
yarn install
```

3. 配置环境变量

```bash
cp .env.example .env.local
```

4. 启动开发服务器

```bash
HOSTNAME=127.0.0.1 npm run dev -- --port 3001
```

5. 访问 [http://localhost:3001](http://localhost:3001)

## 🔧 本地后端（可选）

本项目包含本地处理与同步脚本（如上传/EXIF/同步）。

```bash
cd /Users/apple/Documents/GitHub/DashPhotoGallery
/Users/apple/Documents/GitHub/DashPhotoGallery/.venv/bin/python /Users/apple/Documents/GitHub/DashPhotoGallery/server.py
```
## 🔧 配置说明

### 环境变量

```env
# 高德地图 Web 服务 Key（用于逆地理解析）
GAODE_KEY=your_gaode_web_key

# 管理后台账号
USERNAME=admin
PASSWORD=admin123

# 七牛配置
QINIU_ACCESS_KEY=your_qiniu_access_key
QINIU_SECRET_KEY=your_qiniu_secret_key
QINIU_BUCKET=your_bucket
QINIU_DOMAIN=your_domain
QINIU_REGION=huanan

# 本地监控目录（上传脚本使用）
WATCH_DIR=/Users/apple/Pictures/摄影照片.library/
```

### 照片数据结构

```json
{
  "albumName": {
    "title": "相册标题",
    "description": "相册描述",
    "images": [
      "图片URL数组"
    ]
  }
}
```

## 🧭 管理后台

- 后台入口：`/admin`
- 七牛管理：`/admin/oss`

> 后台功能仅建议在本地使用（包含上传、同步、EXIF 编辑等）。

## 🚀 部署到 Vercel（GitHub 集成）

一键部署：

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Thecosy/MomentPhotos&root-directory=Momentography)

1. 打开 Vercel 控制台 → `Add New` → `Project`
2. 选择仓库：`DashPhotoGallery`
3. **Root Directory 选择 `Momentography`**
4. Build Command 保持默认（`next build`）
5. Output Directory 为空（自动识别）
6. 点击 `Deploy`

> 这是完整功能版本部署；如只需静态展示，可以单独制作静态导出版本。

## 📝 待办事项

- [ ] 添加照片上传功能
- [ ] 优化图片加载性能
- [ ] 添加更多交互动画
- [ ] 实现照片分享功能
- [ ] 添加评论系统

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

1. Fork 本项目
2. 创建您的特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交您的更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开一个 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详细信息

## 👤 作者

作者名字
- Website: [www.angyi.online]
- GitHub: [@flionay]
- Email: [23339097@qq.com]
## 🙏 致谢

- 感谢所有贡献者
- 特别感谢 [列出使用的开源项目]
