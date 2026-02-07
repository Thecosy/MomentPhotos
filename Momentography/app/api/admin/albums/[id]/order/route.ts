import { NextRequest, NextResponse } from 'next/server';
import { updateAlbumImageOrder } from '@/app/utils/dbUtils';

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json();
    const orderedIds = Array.isArray(body.orderedIds) ? body.orderedIds : [];
    if (!params.id || orderedIds.length === 0) {
      return NextResponse.json({ error: '参数不完整' }, { status: 400 });
    }
    const result = updateAlbumImageOrder(params.id, orderedIds);
    if (!result.success) {
      return NextResponse.json({ error: result.message || '更新排序失败' }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: '更新排序失败', message: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}
