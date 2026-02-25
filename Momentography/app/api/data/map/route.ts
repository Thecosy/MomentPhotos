import { NextResponse } from 'next/server';
import { getPhotosWithLocation } from '@/app/utils/dbUtils';

export async function GET() {
  try {
    const photos = getPhotosWithLocation();
    return NextResponse.json(photos);
  } catch (error) {
    return NextResponse.json(
      {
        error: '获取地图数据失败',
        message: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}
