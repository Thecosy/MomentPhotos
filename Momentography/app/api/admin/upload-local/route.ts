import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { logUpdate } from '@/app/utils/dbUtils';

function resolveWatchDir(inputPath: string | null) {
  if (inputPath && inputPath.trim()) return inputPath.trim();
  return process.env.WATCH_DIR || process.env.watch_dir || '';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const watchDir = resolveWatchDir(body?.path ?? null);
    const mode = body?.mode === 'full' ? 'full' : 'incremental';
    if (!watchDir) {
      return NextResponse.json({ error: '缺少目录路径' }, { status: 400 });
    }

    if (!fs.existsSync(watchDir) || !fs.statSync(watchDir).isDirectory()) {
      return NextResponse.json({ error: '目录不存在或不可访问' }, { status: 400 });
    }

    const repoRoot = process.cwd();
    const scriptPath = path.join(repoRoot, 'local_image_process', 'upload_oss.py');
    const venvPython = path.join(repoRoot, '.venv', 'bin', 'python');
    const pythonPath = process.env.PYTHON_PATH || (fs.existsSync(venvPython) ? venvPython : 'python3');

    // 尝试使用 run.txt 触发（保留兼容）
    try {
      const runFile = path.join(watchDir, 'run.txt');
      fs.writeFileSync(runFile, 'run');
    } catch {
      // ignore
    }

    // 同时后台直接运行一次，避免 run.txt 权限受限
    try {
      logUpdate('upload', 'info', `已触发后台上传（${mode === 'full' ? '全量' : '增量'}），正在启动脚本…`, 'info', 1);
      const child = spawn(pythonPath, [scriptPath, watchDir], {
        detached: true,
        stdio: 'ignore',
        env: {
          ...process.env,
          RUN_ONCE: '1',
          FULL_UPLOAD: mode === 'full' ? '1' : '0',
          watch_dir: watchDir,
          PYTHONUNBUFFERED: '1',
        },
      });
      child.unref();
    } catch {
      logUpdate('upload', 'error', '启动上传脚本失败（请检查 Python 路径或权限）', 'error', 100);
      // ignore
    }

    return NextResponse.json({ success: true, watchDir, mode });
  } catch (error) {
    return NextResponse.json(
      { error: '触发上传失败', message: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}
