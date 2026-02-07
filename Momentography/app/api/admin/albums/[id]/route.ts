import { NextRequest, NextResponse } from 'next/server';
import { deleteAlbumById } from '@/app/utils/dbUtils';
import { deleteAlbumFromQiniu } from '@/app/utils/qiniuUtils';

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!params.id) {
      return NextResponse.json({ error: '缺少相册ID' }, { status: 400 });
    }

    const qiniuResult = await deleteAlbumFromQiniu(params.id);
    if (!qiniuResult.success) {
      return NextResponse.json({ error: qiniuResult.message || '删除七牛文件失败' }, { status: 500 });
    }

    const dbResult = deleteAlbumById(params.id);
    if (!dbResult.success) {
      return NextResponse.json({ error: dbResult.message || '删除数据库记录失败' }, { status: 500 });
    }

    return NextResponse.json({ success: true, deleted: qiniuResult.deleted || 0 });
  } catch (error) {
    return NextResponse.json(
      { error: '删除相册失败', message: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}
