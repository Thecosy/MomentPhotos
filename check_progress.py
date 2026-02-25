"""
检查上传进度和数据库状态
"""
import sqlite3
import os

DB_PATH = 'Momentography/data/gallery.db'

def check_progress():
    if not os.path.exists(DB_PATH):
        print("数据库文件不存在")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # 统计相册数
    cursor.execute('SELECT COUNT(*) FROM albums')
    album_count = cursor.fetchone()[0]

    # 统计图片数
    cursor.execute('SELECT COUNT(*) FROM images')
    image_count = cursor.fetchone()[0]

    # 获取最新的相册（带标题的）
    cursor.execute('''
        SELECT id, title,
               (SELECT COUNT(*) FROM images WHERE album_id = albums.id) as photo_count
        FROM albums
        WHERE title IS NOT NULL
        ORDER BY id DESC
        LIMIT 10
    ''')
    albums = cursor.fetchall()

    conn.close()

    print(f"\n{'='*60}")
    print(f"数据库状态")
    print(f"{'='*60}")
    print(f"相册总数: {album_count}")
    print(f"图片总数: {image_count}")

    if albums:
        print(f"\n最新相册（显示嵌套结构）:")
        print(f"{'-'*60}")
        for album in albums:
            album_id, title, photo_count = album
            print(f"  {title or album_id} ({photo_count} 张)")
    else:
        print("\n还没有相册数据，脚本可能还在处理 EXIF 信息...")

    print(f"{'='*60}\n")

if __name__ == '__main__':
    check_progress()
