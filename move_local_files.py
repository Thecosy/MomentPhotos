"""
本地文件移动同步脚本
读取前端记录的照片移动操作，移动本地对应的文件到新的相册目录
"""
import os
import json
import shutil
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

MOVED_PHOTOS_FILE = 'Momentography/data/moved_photos.json'
WATCH_DIR = os.getenv('WATCH_DIR', '')


def move_local_files():
    """移动本地文件到新的相册目录"""
    if not os.path.exists(MOVED_PHOTOS_FILE):
        print("没有待移动的文件记录")
        return

    # 读取移动记录
    with open(MOVED_PHOTOS_FILE, 'r', encoding='utf-8') as f:
        moved_photos = json.load(f)

    if not moved_photos:
        print("没有待移动的文件")
        return

    moved_count = 0
    failed_count = 0

    for record in moved_photos:
        filename = record.get('filename', '')
        old_album = record.get('oldAlbumId', '')
        new_album = record.get('newAlbumId', '')

        if not filename or not old_album or not new_album:
            continue

        # 去掉 .webp 扩展名，因为本地可能是 .arw 等格式
        filename_base = os.path.splitext(filename)[0]

        # 在本地目录中查找匹配的文件
        if WATCH_DIR and os.path.exists(WATCH_DIR):
            found = False
            # 遍历查找匹配的文件
            for root, dirs, files in os.walk(WATCH_DIR):
                for file in files:
                    file_base = os.path.splitext(file)[0]
                    if file_base == filename_base:
                        old_file_path = os.path.join(root, file)

                        # 构建新的目标路径
                        # 尝试在同级目录或父目录中找到新相册目录
                        parent_dir = os.path.dirname(root)

                        # 查找新相册目录
                        new_album_dir = None

                        # 方案1: 在父目录下查找新相册名
                        potential_new_dir = os.path.join(parent_dir, new_album)
                        if os.path.exists(potential_new_dir):
                            new_album_dir = potential_new_dir
                        else:
                            # 方案2: 在 WATCH_DIR 下查找
                            for search_root, search_dirs, _ in os.walk(WATCH_DIR):
                                if new_album in search_dirs:
                                    new_album_dir = os.path.join(search_root, new_album)
                                    break

                        # 如果找不到目标目录，在父目录下创建
                        if not new_album_dir:
                            new_album_dir = os.path.join(parent_dir, new_album)
                            os.makedirs(new_album_dir, exist_ok=True)
                            print(f"创建新相册目录: {new_album_dir}")

                        new_file_path = os.path.join(new_album_dir, file)

                        try:
                            # 移动文件
                            shutil.move(old_file_path, new_file_path)
                            print(f"已移动: {old_file_path} -> {new_file_path}")
                            moved_count += 1
                            found = True
                        except Exception as e:
                            print(f"移动失败 {old_file_path}: {e}")
                            failed_count += 1

                        break

                if found:
                    break

            if not found:
                print(f"未找到本地文件: {filename_base}")
                failed_count += 1
        else:
            print(f"本地目录不存在或未配置: {WATCH_DIR}")
            failed_count += 1

    # 清空移动记录
    with open(MOVED_PHOTOS_FILE, 'w', encoding='utf-8') as f:
        json.dump([], f)

    print(f"\n本地文件移动完成：成功 {moved_count} 个，失败 {failed_count} 个")


if __name__ == '__main__':
    move_local_files()
