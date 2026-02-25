import { NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.join(process.cwd(), 'data', 'gallery.db');
const DELETED_PHOTOS_FILE = path.join(process.cwd(), 'data', 'deleted_photos.json');

export async function POST(request: Request) {
  try {
    const { photoId, deleteCloud = false, deleteLocal = false } = await request.json();

    if (!photoId) {
      return NextResponse.json({ error: '缺少照片 ID' }, { status: 400 });
    }

    // 从数据库删除照片
    const db = new Database(DB_PATH);

    // 获取照片信息（用于记录删除）
    const photo: any = db.prepare('SELECT * FROM images WHERE id = ?').get(photoId);

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
      deletedAt: new Date().toISOString(),
      deleteCloud,
      deleteLocal
    });

    fs.writeFileSync(DELETED_PHOTOS_FILE, JSON.stringify(deletedPhotos, null, 2));

    // 如果需要删除七牛云文件
    if (deleteCloud) {
      try {
        const qiniu = require('qiniu');
        const accessKey = process.env.QINIU_ACCESS_KEY;
        const secretKey = process.env.QINIU_SECRET_KEY;
        const bucket = process.env.QINIU_BUCKET;

        if (!accessKey || !secretKey || !bucket) {
          console.error('七牛云配置不完整');
        } else {
          const mac = new qiniu.auth.digest.Mac(accessKey, secretKey);
          const config = new qiniu.conf.Config();
          const bucketManager = new qiniu.rs.BucketManager(mac, config);

          // 从URL提取文件key
          const urlObj = new URL(photo.url);
          const key = urlObj.pathname.substring(1); // 去掉开头的 /

          await new Promise((resolve, reject) => {
            bucketManager.delete(bucket, key, (err: any, respBody: any, respInfo: any) => {
              if (err) {
                console.error('删除七牛云文件失败:', err);
                reject(err);
              } else {
                console.log('七牛云文件已删除:', key);
                resolve(respInfo);
              }
            });
          });
        }
      } catch (error) {
        console.error('删除七牛云文件时出错:', error);
      }
    }

    return NextResponse.json({
      success: true,
      message: '照片已删除',
      photoId,
      deletedCloud: deleteCloud,
      deletedLocal: deleteLocal
    });
  } catch (error: any) {
    console.error('删除照片失败:', error);
    return NextResponse.json({
      error: '删除照片失败',
      details: error.message
    }, { status: 500 });
  }
}
