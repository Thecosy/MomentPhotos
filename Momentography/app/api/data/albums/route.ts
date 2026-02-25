import { NextResponse } from 'next/server';
import { buildAlbumsPayload } from '@/app/api/data/_shared';

export async function GET() {
  try {
    const albums = buildAlbumsPayload();
    return NextResponse.json(albums);
  } catch (error) {
    return NextResponse.json(
      {
        error: '获取相册数据失败',
        message: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}
