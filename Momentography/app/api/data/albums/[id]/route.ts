import { NextResponse } from 'next/server';
import { buildAlbumsPayload } from '@/app/api/data/_shared';

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id: rawParam } = await context.params;
    const rawId = rawParam || '';
    let albumId = rawId;

    try {
      albumId = decodeURIComponent(rawId);
    } catch {
      albumId = rawId;
    }

    const albums = buildAlbumsPayload();
    const album = albums[albumId];

    if (!album) {
      return NextResponse.json(
        { error: '相册不存在', albumId },
        { status: 404 }
      );
    }

    return NextResponse.json(album);
  } catch (error) {
    return NextResponse.json(
      {
        error: '获取相册详情失败',
        message: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}
