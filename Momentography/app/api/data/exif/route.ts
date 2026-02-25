import { NextResponse } from 'next/server';
import { buildExifPayload } from '@/app/api/data/_shared';

export async function GET() {
  try {
    const exifData = buildExifPayload();
    return NextResponse.json(exifData);
  } catch (error) {
    return NextResponse.json(
      {
        error: '获取 EXIF 数据失败',
        message: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}
