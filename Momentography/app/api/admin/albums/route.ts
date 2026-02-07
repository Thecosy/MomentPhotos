import { NextRequest, NextResponse } from 'next/server';
import { getAlbums, getAlbumWithImages } from '@/app/utils/dbUtils';

export async function GET(_request: NextRequest) {
  try {
    const albums = getAlbums() as any[];
    const detailed = albums.map((album) => {
      const withImages = getAlbumWithImages(album.id);
      return {
        ...album,
        images: (withImages?.images || []).map((img: any) => ({
          id: img.id,
          url: img.url,
          position: img.position ?? null,
        })),
      };
    });
    return NextResponse.json({ albums: detailed });
  } catch (error) {
    return NextResponse.json(
      { error: '获取相册数据失败', message: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}
