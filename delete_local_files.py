"""
本地文件删除同步脚本
读取前端记录的已删除照片列表，删除本地对应的文件
"""
import os
import json
import shutil
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

DELETED_PHOTOS_FILE = 'Momentography/data/deleted_photos.json'
WATCH_DIR = os.getenv('WATCH_DIR', '')


def delete_local_files():
    """删除本地已在云端删除的文件"""
    if not os.path.exists(DELETED_PHOTOS_FILE):
        print("没有待删除的文件记录")
        return

    # 读取已删除照片列表
    with open(DELETED_PHOTOS_FILE, 'r', encoding='utf-8') as f:
        deleted_photos = json.load(f)

    if not deleted_photos:
        print("没有待删除的文件")
        return

    deleted_count = 0
    failed_count = 0

    for photo in deleted_photos:
        photo_id = photo.get('id', '')
        photo_url = photo.get('url', '')

        # 从 URL 提取文件路径
        # URL 格式: https://domain.com/gallery/album/filename.webp
        # 需要提取: album/filename
        if '/gallery/' in photo_url:
            relative_path = photo_url.split('/gallery/')[-1]
            # 去掉 .webp 扩展名，因为本地可能是 .arw 等格式
            path_without_ext = os.path.splitext(relative_path)[0]
            album_name = os.path.dirname(relative_path)
            filename_base = os.path.basename(path_without_ext)

            # 在本地目录中查找匹配的文件
            if WATCH_DIR and os.path.exists(WATCH_DIR):
                # 遍历查找匹配的文件
                for root, dirs, files in os.walk(WATCH_DIR):
                    for file in files:
                        file_base = os.path.splitext(file)[0]
                        if file_base == filename_base:
                            file_path = os.path.join(root, file)
                            try:
                                os.remove(file_path)
                                print(f"已删除本地文件: {file_path}")
                                deleted_count += 1
                            except Exception as e:
                                print(f"删除失败 {file_path}: {e}")
                                failed_count += 1
                            break
            else:
                print(f"本地目录不存在或未配置: {WATCH_DIR}")
                failed_count += 1

    # 清空已删除照片列表
    with open(DELETED_PHOTOS_FILE, 'w', encoding='utf-8') as f:
        json.dump([], f)

    print(f"\n本地文件删除完成：成功 {deleted_count} 个，失败 {failed_count} 个")


if __name__ == '__main__':
    delete_local_files()
