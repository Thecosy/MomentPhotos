import { NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.join(process.cwd(), 'data', 'gallery.db');
const MOVED_PHOTOS_FILE = path.join(process.cwd(), 'data', 'moved_photos.json');

export async function POST(request: Request) {
  try {
    const { photoId, targetAlbumId } = await request.json();

    if (!photoId || !targetAlbumId) {
      return NextResponse.json({ error: '缺少照片 ID 或目标相册 ID' }, { status: 400 });
    }

    const db = new Database(DB_PATH);

    // 获取照片信息
    const photo = db.prepare('SELECT * FROM images WHERE id = ?').get(photoId);

    if (!photo) {
      db.close();
      return NextResponse.json({ error: '照片不存在' }, { status: 404 });
    }

    // 检查目标相册是否存在
    const targetAlbum = db.prepare('SELECT * FROM albums WHERE id = ?').get(targetAlbumId);

    if (!targetAlbum) {
      db.close();
      return NextResponse.json({ error: '目标相册不存在' }, { status: 404 });
    }

    const oldAlbumId = photo.album_id;

    // 更新照片的相册ID
    db.prepare('UPDATE images SET album_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(targetAlbumId, photoId);

    // 更新照片URL（如果需要）
    // URL格式: https://domain.com/gallery/album/filename.webp
    const oldUrl = photo.url;
    const filename = oldUrl.split('/').pop();
    const newUrl = oldUrl.replace(`/${oldAlbumId}/`, `/${targetAlbumId}/`);

    db.prepare('UPDATE images SET url = ? WHERE id = ?').run(newUrl, photoId);

    db.close();

    // 记录移动操作，供后续本地文件同步使用
    let movedPhotos = [];
    if (fs.existsSync(MOVED_PHOTOS_FILE)) {
      const content = fs.readFileSync(MOVED_PHOTOS_FILE, 'utf-8');
      movedPhotos = JSON.parse(content);
    }

    movedPhotos.push({
      photoId,
      filename,
      oldAlbumId,
      newAlbumId: targetAlbumId,
      oldUrl,
      newUrl,
      movedAt: new Date().toISOString()
    });

    fs.writeFileSync(MOVED_PHOTOS_FILE, JSON.stringify(movedPhotos, null, 2));

    return NextResponse.json({
      success: true,
      message: '照片已移动',
      photoId,
      oldAlbumId,
      newAlbumId: targetAlbumId
    });
  } catch (error) {
    console.error('移动照片失败:', error);
    return NextResponse.json({
      error: '移动照片失败',
      details: error.message
    }, { status: 500 });
  }
}
