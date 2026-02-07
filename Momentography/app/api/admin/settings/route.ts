import { NextRequest, NextResponse } from 'next/server';
import { getSettings, setSetting } from '@/app/utils/dbUtils';

export async function GET() {
  try {
    const settings = getSettings();
    return NextResponse.json({ settings });
  } catch (error) {
    return NextResponse.json(
      { error: '获取设置失败', message: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const entries = Object.entries(body || {});
    if (entries.length === 0) {
      return NextResponse.json({ error: '无有效设置' }, { status: 400 });
    }
    entries.forEach(([key, value]) => {
      setSetting(key, value == null ? '' : String(value));
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: '保存设置失败', message: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}
