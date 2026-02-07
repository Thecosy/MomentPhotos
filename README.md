# 📷 Photo Gallery Backend


**前端已迁移到 Momentography，本仓库仅保留后端与本地处理逻辑**  
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 🌟 功能特性
- **自动监控**：定时监控文件目录，自动处理新增或修改的图片。
   - 处理图片，避免重复处理。
   - 将压缩后的 WebP 文件上传至 OSS，并生成相应的 YAML 文件以描述相册信息（包括日期和经纬度）。
- **智能元数据** - 自动解析 EXIF 信息（GPS、拍摄时间、设备型号）
- **自动同步** - Webhook触发OSS元数据同步机制


![demo](https://angyi.oss-cn-beijing.aliyuncs.com/uPic/2024/gallery.png)


## 设计方案

### 背景与目标
- 面向摄影爱好者的个人网页端照片展览。
- 用户拥有本地文件形态的相册库（大容量硬盘/NAS），希望从本地文件库无感生成网页展示。
- 目标：最小化人工维护、自动化处理、可移植、可高度自定义。

### 核心宗旨
- 关注摄影本身（拍照、修图、存档），其余流程自动化完成。
- 以“文件为真相源”，避免复杂后台和手工录入。

### 用户故事
1. 我将照片按既有习惯存到本地相册目录中。
2. 系统自动识别新增/更新照片，完成压缩、格式转换与元数据提取。
3. 系统自动生成网页端相册与展示页面。
4. 评分、点赞等互动自动同步至元数据文件。

### 技术路线（高层架构）
- 本地文件库：存放原图与目录结构。
- 处理流水线：监听目录变化，执行压缩、转换、EXIF解析。
- 元数据层：生成相册与照片的描述文件（如 `YAML/JSON`）。
- 展示层：由 Momentography 负责展示与交互。
- 远端存储（可选）：上传压缩图到 OSS，支持 Webhook 同步。

### 数据流与自动化
1. 文件监听：发现新照片/修改文件。
2. 图像处理：生成 WebP、缩略图。
3. 元信息提取：EXIF（时间、GPS、设备）。
4. 元数据生成：相册索引、照片索引。
5. 页面渲染：由 Momentography 按相册与时间线展示。
6. 同步与回写：评分/点赞写回元数据。

### 关键模块
- `local_image_process/` 本地图片处理与元数据生成
- `server.py` Web 服务入口
- `read_oss.py` OSS 元数据同步

### 可移植性与配置
- 以 `.env` 管理运行时参数（路径、认证、OSS/Webhook）。
- 对目录结构与主题样式可配置。
- 可独立运行本地版本，也支持对接云存储。

### 安全与隐私
- 本地图库作为主库；只上传压缩后的展示图。

### 未来可扩展方向
- 多端上传与自动同步（手机/相机直传）。
- 主题市场与自定义模板。
- 生成静态站点模式（便于部署）。

![技术路线](https://angyi.oss-cn-beijing.aliyuncs.com/elog-docs-images/0fc0fae11d1cc14bf89493b37e19258a.png)

## 🚀 快速部署
### Docker 部署（推荐）
有环境的可以从当前仓库的packages中下载镜像，当然也可以自己编译。
```bash
docker run -d \
  -p 8089:8089 \
  -v /your/local/data:/app/data \
  -v /your/local/.env:/app/.env \
  angyi123/photo_gallery:v1.0  #arm版本的
```

- Webhook 服务地址：
   `http://127.0.0.1:8089/webhook`

### 源码部署
```bash

```bash
# 1. 克隆仓库
git clone https://github.com/yourusername/dash-photo-gallery.git
cd dash-photo-gallery

# 2. 安装依赖
pip install -r requirements.txt

# 3. 配置环境
cp env_example .env
vim .env  # 填写实际配置

# 4. 启动服务
python server.py  # 开发模式
gunicorn server:app -w 4 -b 0.0.0.0:8089  # 生产模式
```

- Webhook 服务地址：
   `http://127.0.0.1:8089/webhook`

## 📂 目录结构
```
├── data/               # 动态数据存储
├── local_image_process # 本地图片处理脚本
│
├── Dockerfile          # 容器构建配置
├── server.py           # Flask服务端
└── requirements.txt    # Python依赖
```

##  📝 使用指南
### OSS同步机制
通过配置WEBHOOK_URL，当OSS存储更新时：

1. 自动触发元数据同步
2. 更新本地albums.json和exif_data.json
3. Momentography 前端可按需刷新

## 📄 许可证
本项目采用 MIT 许可证，详情请查看 [LICENSE](LICENSE) 文件。


## 📬 联系方式
如有任何问题或建议，请联系：
- 邮箱：angyi_jq@163.com
- GitHub：[Flionay](https://github.com/flionay)
