import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';

function resolveWatchDir(inputPath: string | null) {
  if (inputPath && inputPath.trim()) return inputPath.trim();
  return process.env.WATCH_DIR || process.env.watch_dir || '';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const watchDir = resolveWatchDir(body?.path ?? null);
    if (!watchDir) {
      return NextResponse.json({ error: '缺少目录路径' }, { status: 400 });
    }
    if (!fs.existsSync(watchDir) || !fs.statSync(watchDir).isDirectory()) {
      return NextResponse.json({ error: '目录不存在或不可访问' }, { status: 400 });
    }
    return NextResponse.json({ success: true, watchDir });
  } catch (error) {
    return NextResponse.json(
      { error: '路径验证失败', message: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}
