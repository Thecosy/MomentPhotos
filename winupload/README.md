# Windows 目录监控上传（MomentPhotos）

本目录提供 Windows 下的目录监控与上传脚本，监控到新增图片后自动触发上传。

## 使用方式

1. 打开 PowerShell（建议管理员权限）
2. 进入项目目录：

```powershell
cd C:\Users\<你的用户名>\Documents\GitHub\MomentPhotos\winupload
```

3. 启动监控（增量上传）：

```powershell
.\watch-upload.ps1 -WatchDir "C:\Users\<你的用户名>\Pictures\摄影照片.library"
```

4. 如果要全量上传：

```powershell
.\watch-upload.ps1 -WatchDir "C:\Users\<你的用户名>\Pictures\摄影照片.library" -Mode full
```

## 双击启动（.bat）

编辑 `start-watch.bat` 里的 `WATCH_DIR`，然后双击运行即可：

```
start-watch.bat
```

## 后台运行（启动时自动）

使用任务计划在登录时自动启动：

```
install-service.bat
```

## 说明

- 脚本会在检测到新增图片后触发一次上传
- 支持的图片：`jpg/jpeg/png/tif/tiff/heic/heif`
- 触发上传会调用项目的 `local_image_process/upload_oss.py`

## 依赖

- 已安装 Python（优先使用项目内 `.venv\Scripts\python.exe`）
- 已配置 `.env.local`（七牛/地图/账号等）
