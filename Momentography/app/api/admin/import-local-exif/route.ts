import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { saveExifData } from '@/app/utils/dbUtils';

function resolveLocalExifPath(inputPath: string | null) {
  if (inputPath && inputPath.trim()) return inputPath.trim();
  return path.join(process.cwd(), '..', 'local_image_process', 'output', 'exif_data.json');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const exifPath = resolveLocalExifPath(body?.path ?? null);
    if (!fs.existsSync(exifPath)) {
      return NextResponse.json({ error: 'EXIF 文件不存在', path: exifPath }, { status: 400 });
    }
    const content = fs.readFileSync(exifPath, 'utf-8');
    const exifData = JSON.parse(content);
    const result = saveExifData(exifData);
    if (!result.success) {
      return NextResponse.json({ error: result.message || '导入失败' }, { status: 500 });
    }
    return NextResponse.json({ success: true, message: result.message || '导入成功' });
  } catch (error) {
    return NextResponse.json(
      { error: '导入 EXIF 失败', message: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}
