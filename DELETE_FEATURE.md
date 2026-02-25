# 照片删除功能说明

## 功能概述

在管理后台 (http://localhost:3001/admin) 点击照片后，可以使用删除功能。删除时可以选择：

1. **删除七牛云文件** - 从云端存储中删除照片
2. **删除本地文件** - 从本地图库中删除原始文件
3. **两者都删除** - 同时删除云端和本地文件

## 使用步骤

### 1. 在管理后台删除照片

1. 访问 http://localhost:3001/admin
2. 点击任意照片打开详情弹窗
3. 点击右上角的红色垃圾桶图标
4. 在弹出的确认对话框中选择删除选项：
   - ☑️ 删除七牛云文件
   - ☑️ 删除本地文件
5. 点击"确认删除"按钮

### 2. 同步删除本地文件

如果选择了"删除本地文件"，需要运行同步脚本来实际删除本地文件：

```bash
python delete_local_files.py
```

该脚本会：
- 读取 `Momentography/data/deleted_photos.json` 中的删除记录
- 只删除标记为 `deleteLocal: true` 的文件
- 在本地图库目录 (WATCH_DIR) 中查找并删除对应的原始文件
- 删除完成后更新删除记录

## 技术实现

### 前端 (PhotoDetail.tsx)

- 添加了删除按钮（红色垃圾桶图标）
- 删除确认对话框，包含两个复选框
- 调用 `/api/photos/delete` API

### 后端 (route.ts)

- 接收 `photoId`, `deleteCloud`, `deleteLocal` 参数
- 从数据库中删除照片记录
- 如果 `deleteCloud=true`，使用七牛云SDK删除云端文件
- 将删除记录保存到 `deleted_photos.json`

### 同步脚本 (delete_local_files.py)

- 读取删除记录
- 只处理 `deleteLocal: true` 的记录
- 在本地图库中查找匹配的文件（支持不同扩展名，如 .arw, .jpg, .png）
- 删除找到的文件
- 更新删除记录，保留失败的记录以便重试

## 安全特性

1. **双重确认** - 需要用户明确选择删除选项
2. **分离删除** - 云端和本地删除是独立的，可以只删除其中一个
3. **记录保留** - 删除失败的记录会保留，可以重试
4. **数据库优先** - 即使云端或本地删除失败，数据库记录也会被删除

## 注意事项

⚠️ **重要提示**：
- 删除操作不可逆，请谨慎操作
- 删除本地文件前，请确保已备份重要照片
- 如果只想从网站上移除照片但保留本地文件，只勾选"删除七牛云文件"
- 运行 `delete_local_files.py` 前，请确认 `.env` 中的 `WATCH_DIR` 配置正确

## 环境变量

确保 `.env` 文件中配置了以下变量：

```env
# 本地图库目录
WATCH_DIR=E:\w.library

# 七牛云配置（用于删除云端文件）
QINIU_ACCESS_KEY=your_access_key
QINIU_SECRET_KEY=your_secret_key
QINIU_BUCKET=your_bucket_name
```
