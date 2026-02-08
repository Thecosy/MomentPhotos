import { NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'data', 'gallery.db');

export async function GET() {
  try {
    const db = new Database(DB_PATH);

    // 获取所有相册，按标题排序
    const albums = db.prepare(`
      SELECT
        id,
        title,
        description,
        location,
        date,
        cover_image,
        (SELECT COUNT(*) FROM images WHERE album_id = albums.id) as photo_count
      FROM albums
      ORDER BY title ASC
    `).all();

    db.close();

    return NextResponse.json({
      success: true,
      albums
    });
  } catch (error) {
    console.error('获取相册列表失败:', error);
    return NextResponse.json({
      error: '获取相册列表失败',
      details: error.message
    }, { status: 500 });
  }
}
