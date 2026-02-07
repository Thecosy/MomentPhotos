import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
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

    const scriptPath = path.join(process.cwd(), '..', 'local_image_process', 'upload_oss.py');
    const pythonPath = path.join(process.cwd(), '..', '.venv', 'bin', 'python');

    const child = spawn(pythonPath, [scriptPath], {
      env: { ...process.env, watch_dir: watchDir },
      detached: true,
      stdio: 'ignore',
    });
    child.unref();

    // 触发执行
    fs.writeFileSync(path.join(watchDir, 'run.txt'), 'run');

    return NextResponse.json({ success: true, message: '已触发 EXIF 重新生成' });
  } catch (error) {
    return NextResponse.json(
      { error: '重新生成 EXIF 失败', message: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}
