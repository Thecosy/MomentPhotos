import time
import os
import mimetypes
import sqlite3
from PIL import Image, ExifTags, ImageOps
import shutil
from dotenv import load_dotenv
import exifread
import json
from fractions import Fraction
from loguru import logger
from qiniu import Auth, put_file, Region
import qiniu.config as qiniu_config
import rawpy
import imageio
# 加载 .env 文件中的环境变量
load_dotenv()

def log_update_sqlite(update_type: str, status: str, message: str, progress: float | None = None):
    db_path = os.getenv('DB_PATH')
    if not db_path:
        repo_root = os.path.dirname(os.path.dirname(__file__))
        db_path = os.path.join(repo_root, 'Momentography', 'data', 'gallery.db')

    if not os.path.exists(db_path):
        return

    try:
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()
        cur.execute("""
            CREATE TABLE IF NOT EXISTS updates (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                type TEXT NOT NULL,
                status TEXT NOT NULL,
                message TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                status_code TEXT,
                progress REAL
            )
        """)
        cur.execute("PRAGMA table_info(updates)")
        columns = [row[1] for row in cur.fetchall()]
        if 'progress' not in columns:
            cur.execute("ALTER TABLE updates ADD COLUMN progress REAL")
        if 'status_code' not in columns:
            cur.execute("ALTER TABLE updates ADD COLUMN status_code TEXT")

        status_code = status
        if status not in ['success', 'warning', 'error', 'partial_success', 'info']:
            status_code = 'info'

        if 'progress' in columns:
            cur.execute(
                "INSERT INTO updates (type, status, message, status_code, progress) VALUES (?, ?, ?, ?, ?)",
                (update_type, status, message, status_code, progress)
            )
        else:
            cur.execute(
                "INSERT INTO updates (type, status, message, status_code) VALUES (?, ?, ?, ?)",
                (update_type, status, message, status_code)
            )
        conn.commit()
    except Exception:
        pass
    finally:
        try:
            conn.close()
        except Exception:
            pass

class ImageProcessor:
    def __init__(self, directory_path):
        self.directory_path = directory_path
        self.output_dir = os.path.join(os.path.dirname(__file__), "output")
        self.scan_roots = self._resolve_scan_roots(directory_path)
        self.folder_name_map = self._load_root_folder_map()
        self._dir_metadata_cache: dict[str, dict] = {}
        # 清空 output 文件夹（更安全的方式）
        if os.path.exists(self.output_dir):
            try:
                # 只删除图片和 JSON 文件，保留日志文件
                for item in os.listdir(self.output_dir):
                    item_path = os.path.join(self.output_dir, item)
                    if os.path.isfile(item_path) and not item.endswith('.txt'):
                        try:
                            os.remove(item_path)
                        except:
                            pass
                    elif os.path.isdir(item_path):
                        try:
                            shutil.rmtree(item_path)
                        except:
                            pass
            except Exception as e:
                logger.warning(f"清理 output 目录时出错: {e}")

        if not os.path.exists(self.output_dir):
            os.makedirs(self.output_dir)

    @staticmethod
    def _resolve_scan_roots(directory_path: str):
        # 优先扫描图片目录（含 metadata.json），便于对应相册文件夹名称
        if os.path.isdir(directory_path) and directory_path.endswith('.library'):
            images_dir = os.path.join(directory_path, 'images')
            if os.path.isdir(images_dir):
                return [images_dir]
            candidates = [
                os.path.join(directory_path, 'Originals'),
                os.path.join(directory_path, 'Masters'),
                os.path.join(directory_path, 'originals'),
                os.path.join(directory_path, 'masters'),
            ]
            scan_roots = [p for p in candidates if os.path.isdir(p)]
            if scan_roots:
                return scan_roots
        return [directory_path]

    def _load_root_folder_map(self) -> dict:
        # 从图库根目录 metadata.json 读取文件夹 id -> name 映射
        metadata_path = os.path.join(self.directory_path, 'metadata.json')
        if not os.path.exists(metadata_path):
            return {}
        try:
            with open(metadata_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            folders = data.get('folders') or []
            return {f.get('id'): f.get('name') for f in folders if f.get('id') and f.get('name')}
        except Exception:
            return {}

    def _load_dir_metadata(self, dir_path: str) -> dict | None:
        if dir_path in self._dir_metadata_cache:
            return self._dir_metadata_cache[dir_path]
        meta_path = os.path.join(dir_path, 'metadata.json')
        if not os.path.exists(meta_path):
            self._dir_metadata_cache[dir_path] = None
            return None
        try:
            with open(meta_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            self._dir_metadata_cache[dir_path] = data
            return data
        except Exception:
            self._dir_metadata_cache[dir_path] = None
            return None

    def process_images(self):
        logger.info("开始parse exif信息")
        self.save_exif_to_json()
        logger.info("保存EXIF信息到JSON文件")
        processed = 0
        for scan_root in self.scan_roots:
            for root, dirnames, files in os.walk(scan_root):
                # 跳过系统/隐藏目录，避免扫描照片库内部数据库和缓存
                dirnames[:] = [d for d in dirnames if not d.startswith('.') and d.lower() not in {
                    'resources', 'private', 'database', 'caches', 'cache', 'thumbs', 'thumbnails', 'previews'
                }]
                for file in files:
                    file_path = os.path.join(root, file)
                    if '_thumbnail' in file_path.lower():
                        continue
                    if self._is_image_file(file):
                        try:
                            logger.info(f"开始处理图片: {file}")
                            rel_path = os.path.relpath(file_path, self.directory_path)
                            album_id = self._infer_album_id(rel_path, file_path)
                            filename = os.path.basename(file_path).rsplit('.', 1)[0] + '.webp'
                            output_file = os.path.join(self.output_dir, album_id, filename)
                            output_file_dir = os.path.dirname(output_file)

                            if not os.path.exists(output_file_dir):
                                os.makedirs(output_file_dir)

                            self.process_image(file_path, output_file)
                            processed += 1
                            if processed % 20 == 0:
                                total = getattr(self, 'total_images', 0) or 0
                                if total:
                                    progress = min(90, round(processed * 80 / total, 2))
                                    self._log_progress(f"已处理 {processed}/{total}", progress)
                        except Exception as e:
                            logger.error(f"处理图片失败 {file_path}: {e}")
                            # 跳过有问题的文件，继续处理下一张
                            continue
                    elif file.endswith('.yaml'):
                        self.copy_yaml_file(root, file, self.output_dir)
        total = getattr(self, 'total_images', 0) or 0
        if total:
            self._log_progress(f"处理完成 {processed}/{total}", 90)
                    
    def copy_yaml_file(self, root, file, output_dir):
        file_path = os.path.join(root, file)
        output_file = os.path.join(output_dir, os.path.relpath(file_path, self.directory_path))
        output_file_dir = os.path.dirname(output_file)

        if not os.path.exists(output_file_dir):
            os.makedirs(output_file_dir)
        shutil.copy2(file_path, output_file)
        

    def process_image(self, file_path, output_file):
        # 检查是否是 RAW 格式
        if file_path.lower().endswith(('.arw', '.cr2', '.nef', '.dng', '.raf', '.orf', '.rw2')):
            # 处理 RAW 文件
            self._process_raw_image(file_path, output_file)
        else:
            # 处理普通图片文件
            with Image.open(file_path) as img:
                # 应用 EXIF 方向，确保竖图不被横向显示
                try:
                    img = ImageOps.exif_transpose(img)
                except Exception:
                    pass
                # ImageOps.exif_transpose 已处理方向，这里不再重复旋转

                exif_bytes = img.info.get('exif')
                if exif_bytes:
                    img.save(output_file, 'webp', quality=60, exif=exif_bytes)
                else:
                    img.save(output_file, 'webp', quality=60)
                add_watermark(output_file, output_file)

    def _process_raw_image(self, file_path, output_file):
        """处理 RAW 格式图片，转换为 WebP 并保留 EXIF"""
        try:
            logger.info(f"处理 RAW 文件: {file_path}")

            # 使用 rawpy 读取 RAW 文件
            with rawpy.imread(file_path) as raw:
                # 转换为 RGB 图像，使用高质量参数
                rgb = raw.postprocess(
                    use_camera_wb=True,  # 使用相机白平衡
                    half_size=False,     # 不降低分辨率
                    no_auto_bright=False, # 自动亮度
                    output_bps=8         # 8位输出（PIL 兼容）
                )

            # 转换为 PIL Image
            img = Image.fromarray(rgb)

            # 读取原始 RAW 文件的 EXIF 信息
            with open(file_path, 'rb') as f:
                tags = exifread.process_file(f, details=False)

            # 应用方向信息
            try:
                img = ImageOps.exif_transpose(img)
            except Exception:
                pass

            # 先保存为临时 JPEG 以便提取 EXIF
            temp_jpg = output_file.replace('.webp', '_temp.jpg')
            img.save(temp_jpg, 'JPEG', quality=90)

            # 从临时文件读取并转换为 WebP，保留 EXIF，使用中等质量
            with Image.open(temp_jpg) as temp_img:
                exif_bytes = temp_img.info.get('exif')
                if exif_bytes:
                    temp_img.save(output_file, 'webp', quality=60, method=4, exif=exif_bytes)
                else:
                    temp_img.save(output_file, 'webp', quality=60, method=4)

            # 删除临时文件
            if os.path.exists(temp_jpg):
                os.remove(temp_jpg)

            # 添加水印
            add_watermark(output_file, output_file)

            logger.info(f"RAW 文件处理完成: {file_path} -> {output_file}")

        except Exception as e:
            logger.error(f"处理 RAW 文件失败 {file_path}: {e}")
            # 如果 RAW 处理失败，尝试用 PIL 直接处理（某些格式可能支持）
            try:
                with Image.open(file_path) as img:
                    img = ImageOps.exif_transpose(img)
                    img.save(output_file, 'webp', quality=60)
                    add_watermark(output_file, output_file)
                    logger.info(f"使用备用方法处理成功: {file_path}")
            except Exception as e2:
                logger.error(f"备用处理也失败，跳过此文件: {e2}")
                # 不再抛出异常，而是跳过这个文件
                pass

    def save_exif_to_json(self):
        exif_data_dict = {}
        seen_keys = set()
        for scan_root in self.scan_roots:
            for root, dirnames, files in os.walk(scan_root):
                # 跳过系统/隐藏目录，避免扫描照片库内部数据库和缓存
                dirnames[:] = [d for d in dirnames if not d.startswith('.') and d.lower() not in {
                    'resources', 'private', 'database', 'caches', 'cache', 'thumbs', 'thumbnails', 'previews'
                }]
                for file in files:
                    file_path = os.path.join(root, file)
                    if '_thumbnail' in file_path.lower():
                        continue
                    if self._is_image_file(file):
                        try:
                            with open(file_path, 'rb') as img:
                                tags = exifread.process_file(img)
                                readable_exif = convert_exif_to_dict(tags)
                                relative_path = os.path.relpath(file_path, self.directory_path)
                                album_id = self._infer_album_id(relative_path, file_path)
                                # 使用 .webp 扩展名作为键，因为上传的文件是 webp 格式
                                base_name = os.path.basename(file_path)
                                name_without_ext = os.path.splitext(base_name)[0]
                                image_key = f"{album_id}/{name_without_ext}.webp"
                                exif_data_dict[image_key] = readable_exif
                                seen_keys.add(image_key)
                                logger.info(f"处理 {file_path} EXIF信息成功")
                        except Exception as e:
                            print(f"无法处理文件 {file_path}: {e}")

        # 保险起见再过滤一次缩略图
        exif_data_dict = {k: v for k, v in exif_data_dict.items() if '_thumbnail' not in k.lower()}

        json_file_path = os.path.join(self.output_dir, 'exif_data.json')
        with open(json_file_path, 'w', encoding='utf-8') as json_file:
            json.dump(exif_data_dict, json_file, ensure_ascii=False, indent=4)
            print("JSON 文件已保存。")
        total_images = len(seen_keys)
        self.total_images = total_images
        self._log_progress(f"发现图片数量 {total_images}", 10)

    @staticmethod
    def _is_image_file(filename: str) -> bool:
        if filename.startswith('.'):
            return False
        lower = filename.lower()
        if '_thumbnail' in lower or lower.endswith('_thumbnail.png') or lower.endswith('_thumbnail.jpg') or lower.endswith('_thumbnail.jpeg'):
            return False
        # 支持常见图片格式和 RAW 格式
        return lower.endswith(('.png', '.jpg', '.jpeg', '.heic', '.heif', '.tif', '.tiff', '.arw', '.cr2', '.nef', '.dng', '.raf', '.orf', '.rw2'))

    def _infer_album_id(self, relative_path: str, file_path: str | None = None) -> str:
        # 优先使用图库的 metadata.json 中的文件夹映射
        dir_path = os.path.dirname(file_path) if file_path else ''
        dir_meta = self._load_dir_metadata(dir_path) if dir_path else None
        if dir_meta:
            folder_ids = dir_meta.get('folders') or []
            if isinstance(folder_ids, list) and folder_ids:
                for folder_id in folder_ids:
                    name = self.folder_name_map.get(folder_id)
                    if name:
                        return name
        parts = relative_path.replace('\\', '/').split('/')
        if len(parts) >= 2 and parts[0] == 'images':
            return parts[1]
        return parts[0] if parts[0] else 'default'

    def _log_progress(self, message: str, progress: float | None = None):
        log_update_sqlite('upload', 'info', message, progress)




def convert_exif_to_dict(exif_data):   

    # 将分数列表转换为度数
    def parse_gps_coordinate(values, ref):
        degrees = values[0].num / values[0].den
        minutes = values[1].num / values[1].den
        seconds = values[2].num / values[2].den
        coordinate = degrees + (minutes / 60.0) + (seconds / 3600.0)
        if ref in ['S', 'W']:
            coordinate = -coordinate
        return coordinate
    
    # 提取需要的 EXIF 信息
    exif_dict = {
        "CameraModel": str(exif_data.get("Image Model", "Unknown")),
        "LensModel": str(exif_data.get("EXIF LensModel", "Unknown")),
        "ExposureTime": str(exif_data.get("EXIF ExposureTime", "Unknown")),
        "FNumber": str(exif_data.get("EXIF FNumber", "Unknown")),
        "ISO": str(exif_data.get("EXIF ISOSpeedRatings", "Unknown")),
        "FocalLength": str(exif_data.get("EXIF FocalLength", "Unknown")),
        "Orientation": str(exif_data.get("Image Orientation", exif_data.get("EXIF Orientation", "Unknown"))),
        "Latitude": None,
        "Longitude": None,
        "DateTime": "未知",
        "Location": "未知"
    }
    # 解析曝光三要素
    if "EXIF ExposureTime" in exif_data:
        exif_dict["ExposureTime"] = str(exif_data["EXIF ExposureTime"])

    if "EXIF FNumber" in exif_data:
        fnumber = exif_data["EXIF FNumber"].values
        exif_dict["FNumber"] = str(fnumber[0].num / fnumber[0].den)

    if "EXIF ISOSpeedRatings" in exif_data:
        exif_dict["ISO"] = str(exif_data["EXIF ISOSpeedRatings"])

    if "EXIF FocalLength" in exif_data:
        focal_length = exif_data["EXIF FocalLength"].values
        exif_dict["FocalLength"] = str(focal_length[0].num / focal_length[0].den)

    # 解析 GPS 信息
    if "GPS GPSLatitude" in exif_data and "GPS GPSLatitudeRef" in exif_data:
        lat_values = exif_data["GPS GPSLatitude"].values
        lat_ref = exif_data["GPS GPSLatitudeRef"].printable
        exif_dict["Latitude"] = parse_gps_coordinate(lat_values, lat_ref)

    if "GPS GPSLongitude" in exif_data and "GPS GPSLongitudeRef" in exif_data:
        lon_values = exif_data["GPS GPSLongitude"].values
        lon_ref = exif_data["GPS GPSLongitudeRef"].printable
        exif_dict["Longitude"] = parse_gps_coordinate(lon_values, lon_ref)

    # 解析时间信息（优先 DateTimeOriginal，其次 Image DateTime）
    if "EXIF DateTimeOriginal" in exif_data:
        exif_dict["DateTime"] = str(exif_data["EXIF DateTimeOriginal"])
    elif "Image DateTime" in exif_data:
        exif_dict["DateTime"] = str(exif_data["Image DateTime"])
    else:
        exif_dict["DateTime"] = "未知"  # 添加默认值
    
    # print(exif_dict)
    address = parse_location_rg(exif_data=exif_dict)
    if address == "未知":
        address = parse_location_gaode(exif_data=exif_dict)
      
    exif_dict["Location"] = address
    return exif_dict
           

def parse_location_gaode(exif_data):
    
    import requests
    # 初始化 Nominatim
    api_key = os.getenv('gaode_key')
    try:
        if "Latitude" in exif_data and "Longitude" in exif_data:
            latitude = exif_data["Latitude"]
            longitude = exif_data["Longitude"]
            api_url = f"https://restapi.amap.com/v3/geocode/regeo?output=json&location={longitude},{latitude}&key={api_key}&radius=500&extensions=all "
            # print(api_url)
            response = requests.get(api_url)
            location = response.json()
            # time.sleep(10)
            # print(location)
            if location:
                return location['regeocode']['addressComponent']['province'][:-1] + " · " + \
                    location['regeocode']['addressComponent']['district'] + "· " + \
                    location['regeocode']['addressComponent']['township']
            else:
                return "未知"
        else:
            return "未知"
    except Exception as e:
        # print(e)
        return "未知"

def parse_location_rg(exif_data):
    from geopy.geocoders import Nominatim

    # 初始化 Nominatim
    geolocator = Nominatim(user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/75.0.3770.90 Safari/537.36")

    if "Latitude" in exif_data and "Longitude" in exif_data:
        try:
            latitude = exif_data["Latitude"]
            longitude = exif_data["Longitude"]
            location = geolocator.reverse(f"{latitude}, {longitude}")
            
            if location:
                return location.raw['address']['state'][:-1] + " · " + \
                    location.raw['address']['city'] + " · " + \
                    location.raw['address']['suburb']
            else:
                return "未知位置"
        except Exception as e:
            # print(e)
            return "未知"
            
    else:
        return "未知"
    

def add_watermark(input_image_path, output_image_path, watermark_path='sy.png', opacity=0.8):
    # 打开输入图片和水印图片
    with Image.open(input_image_path) as base_image:
        # 读取EXIF信息
        exif_data = base_image.info.get('exif')
        if not os.path.isabs(watermark_path):
            watermark_path = os.path.join(os.path.dirname(__file__), watermark_path)
        with Image.open(watermark_path) as watermark:
            watermark = watermark.convert("RGBA")
            alpha = watermark.split()[3]
            alpha = alpha.point(lambda p: p * opacity)  # 设置不透明度
            watermark.putalpha(alpha)
            # 获取水印的尺寸
            watermark_width, watermark_height = watermark.size
            # watermark = watermark.resize((int(watermark_width*1.3), int(watermark_height*1.3)), Image.ANTIALIAS)
            
            # 计算水印的位置（左下角）
            position = (15, base_image.height - watermark_height-20)
            
            # 创建一个可以在上面绘制的图像
            base_image.paste(watermark, position, watermark)
            
            # 保存叠加后的图片
            if exif_data:
                base_image.save(output_image_path, exif=exif_data)
            else:
                base_image.save(output_image_path)
            
            

def upload_folder_to_qiniu(src_folder, bucket_name, access_key, secret_key, domain, prefix="gallery/", full_upload: bool = False, sync_delete: bool = True):
    log_update_sqlite('upload', 'info', '开始上传到七牛', 90)
    configure_qiniu_region()
    q = Auth(access_key, secret_key)
    uploaded = 0
    failed = 0
    skipped = 0
    deleted = 0
    existing_keys = set()
    local_files = set()

    # 收集本地所有文件
    for root, dirs, files in os.walk(src_folder):
        for file in files:
            if file.endswith('.webp') or file.endswith('.json'):
                rel_path = os.path.relpath(os.path.join(root, file), src_folder)
                # 转换为云端路径格式
                cloud_key = prefix + rel_path.replace('\\', '/')
                local_files.add(cloud_key)

    # 清理七牛上历史缩略图，并收集现有文件
    try:
        from qiniu import BucketManager
        bm = BucketManager(q)
        marker = None
        eof = False
        while not eof:
            ret, eof, _ = bm.list(bucket_name, prefix=prefix, marker=marker, limit=1000)
            items = ret.get('items') or []
            for item in items:
                key = item.get('key') or ''
                if '_thumbnail' in key:
                    try:
                        bm.delete(bucket_name, key)
                        deleted += 1
                    except Exception:
                        pass
                elif key:
                    existing_keys.add(key)
                    # 如果启用删除同步，且云端文件不在本地文件列表中，则删除
                    if sync_delete and key not in local_files and not key.endswith('exif_data.json'):
                        try:
                            bm.delete(bucket_name, key)
                            deleted += 1
                            print(f"删除云端文件: {key}")
                        except Exception as e:
                            print(f"删除失败 {key}: {e}")
            marker = ret.get('marker')
    except Exception as e:
        print(f"列举文件失败: {e}")

    for root, _, files in os.walk(src_folder):
        for filename in files:
            local_path = os.path.join(root, filename)
            rel_path = os.path.relpath(local_path, src_folder).replace(os.sep, "/")
            if '_thumbnail' in rel_path:
                skipped += 1
                continue
            key = f"{prefix}{rel_path}"
            if not full_upload and key in existing_keys:
                skipped += 1
                continue
            token = q.upload_token(bucket_name, key)

            mime_type, _ = mimetypes.guess_type(local_path)
            ret, info = put_file(token, key, local_path, mime_type=mime_type)
            if info.status_code == 200:
                uploaded += 1
            else:
                failed += 1
                print(f"上传失败: {local_path} -> {key} ({info})")

    mode_label = '全量' if full_upload else '增量'
    print(f"上传完成（{mode_label}）：成功 {uploaded} 个，失败 {failed} 个，跳过 {skipped} 个，删除 {deleted} 个")
    if failed == 0 and domain:
        log_update_sqlite('upload', 'success', f"上传完成（{mode_label}）：成功 {uploaded} 个，跳过 {skipped} 个，删除 {deleted} 个", 100)
        print(f"示例访问地址: https://{domain}/{prefix}")
    elif failed > 0:
        log_update_sqlite('upload', 'error', f"上传完成（{mode_label}）：成功 {uploaded} 个，失败 {failed} 个，跳过 {skipped} 个，删除 {deleted} 个", 100)
              
            
def send_webhook():
    import requests
    webhook_url = os.getenv('WEBHOOK_URL')  # 替换为您的前端应用地址
    try:
        response = requests.post(webhook_url)
        if response.status_code == 200:
            print("Webhook 请求成功，前端应用已更新。")
        else:
            print(f"Webhook 请求失败，状态码: {response.status_code}")
    except Exception as e:
        print(f"发送 webhook 请求时出错: {e}")


def configure_qiniu_region():
    # 支持通过环境变量配置七牛上传区域/域名，默认华南(广东)
    region = (os.getenv('QINIU_REGION') or '').lower()
    up_host = os.getenv('QINIU_UP_HOST') or ''
    up_host_backup = os.getenv('QINIU_UP_HOST_BACKUP') or ''
    if not up_host and region in {'z2', 'south', 'huanan', 'gd', 'guangdong', '华南', '广东'}:
        up_host = 'https://up-z2.qbox.me'
        up_host_backup = 'https://upload-z2.qbox.me'
    if up_host:
        qiniu_config.set_default(default_zone=Region(up_host, up_host_backup or None))


if __name__ == '__main__':
    directory_to_process = os.getenv('watch_dir') or ''
    run_once = os.getenv('RUN_ONCE') == '1'
    if len(os.sys.argv) > 1 and os.sys.argv[1].strip():
        directory_to_process = os.sys.argv[1].strip()
        run_once = True

    if not directory_to_process:
        print("缺少目录路径：请设置 watch_dir 或传入目录参数")
        os.sys.exit(1)

    def run_job():
        print(f"开始处理目录: {directory_to_process}")

        # 在处理前先删除本地已在云端删除的文件
        try:
            import sys
            sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
            from delete_local_files import delete_local_files
            print("开始同步删除本地文件...")
            delete_local_files()
        except Exception as e:
            print(f"本地文件删除同步失败: {e}")

        full_upload = os.getenv('FULL_UPLOAD') == '1'
        # loguru 日志文件（写入项目内 output，避免库目录权限问题）
        safe_log_dir = os.path.join(os.path.dirname(__file__), 'output')
        os.makedirs(safe_log_dir, exist_ok=True)
        running_log_path = os.path.join(safe_log_dir, 'running_log.txt')
        logger.add(running_log_path, level='INFO')

        processor = ImageProcessor(directory_to_process)
        processor.process_images()

        # 删除 running_log 日志 表示图片处理完（若已不存在或无权限则忽略）
        try:
            os.remove(running_log_path)
        except Exception:
            pass
        upload_folder_to_qiniu(
            src_folder=processor.output_dir,
            bucket_name=os.getenv('QINIU_BUCKET'),
            access_key=os.getenv('QINIU_ACCESS_KEY'),
            secret_key=os.getenv('QINIU_SECRET_KEY'),
            domain=os.getenv('QINIU_DOMAIN'),
            prefix='gallery/',
            full_upload=full_upload,
        )
        send_webhook()

    if run_once:
        run_job()
    else:
        while True:
            try:
                if 'run.txt' in os.listdir(directory_to_process):
                    run_job()
                    # 删除 run.txt 表示上传完（若已不存在或无权限则忽略）
                    try:
                        os.remove(os.path.join(directory_to_process, 'run.txt'))
                    except Exception:
                        pass
                    break
            except Exception:
                pass
            time.sleep(1)
            print('.', end='', flush=True)
        
