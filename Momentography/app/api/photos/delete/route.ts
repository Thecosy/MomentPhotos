import { NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.join(process.cwd(), 'data', 'gallery.db');
const DELETED_PHOTOS_FILE = path.join(process.cwd(), 'data', 'deleted_photos.json');

export async function POST(request: Request) {
  try {
    const { photoId } = await request.json();

    if (!photoId) {
      return NextResponse.json({ error: '缺少照片 ID' }, { status: 400 });
    }

    // 从数据库删除照片
    const db = new Database(DB_PATH);

    // 获取照片信息（用于记录删除）
    const photo = db.prepare('SELECT * FROM images WHERE id = ?').get(photoId);

    if (!photo) {
      db.close();
      return NextResponse.json({ error: '照片不存在' }, { status: 404 });
    }

    // 删除照片记录
    db.prepare('DELETE FROM images WHERE id = ?').run(photoId);

    // 删除相关的 EXIF 数据
    db.prepare('DELETE FROM exif_data WHERE image_id = ?').run(photoId);

    // 删除点赞记录
    db.prepare('DELETE FROM likes WHERE image_id = ?').run(photoId);

    db.close();

    // 记录已删除的照片，供后续同步使用
    let deletedPhotos = [];
    if (fs.existsSync(DELETED_PHOTOS_FILE)) {
      const content = fs.readFileSync(DELETED_PHOTOS_FILE, 'utf-8');
      deletedPhotos = JSON.parse(content);
    }

    deletedPhotos.push({
      id: photoId,
      url: photo.url,
      deletedAt: new Date().toISOString()
    });

    fs.writeFileSync(DELETED_PHOTOS_FILE, JSON.stringify(deletedPhotos, null, 2));

    return NextResponse.json({
      success: true,
      message: '照片已删除',
      photoId
    });
  } catch (error) {
    console.error('删除照片失败:', error);
    return NextResponse.json({
      error: '删除照片失败',
      details: error.message
    }, { status: 500 });
  }
}
