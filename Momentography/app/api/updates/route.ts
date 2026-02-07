import { NextRequest, NextResponse } from 'next/server';
import { getRecentUpdates } from '@/app/utils/dbUtils';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : 50;
    const updates = getRecentUpdates(limit);
    return NextResponse.json({ updates });
  } catch (error) {
    return NextResponse.json(
      { error: '获取更新记录失败', message: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}
