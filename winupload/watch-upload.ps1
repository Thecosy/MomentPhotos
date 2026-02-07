param(
  [Parameter(Mandatory = $true)]
  [string]$WatchDir,
  [ValidateSet("incremental", "full")]
  [string]$Mode = "incremental"
)

$ErrorActionPreference = "Stop"

function Resolve-Python {
  $projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
  $venvPython = Join-Path $projectRoot ".venv\Scripts\python.exe"
  if (Test-Path $venvPython) { return $venvPython }
  return "python"
}

function Invoke-Upload {
  $projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
  $scriptPath = Join-Path $projectRoot "local_image_process\upload_oss.py"
  $python = Resolve-Python
  if (!(Test-Path $scriptPath)) {
    Write-Host "未找到上传脚本: $scriptPath" -ForegroundColor Red
    return
  }
  $env:WATCH_DIR = $WatchDir
  $env:RUN_ONCE = "1"
  $env:FULL_UPLOAD = ($Mode -eq "full") ? "1" : "0"
  Write-Host "开始上传（$Mode）..." -ForegroundColor Cyan
  & $python $scriptPath $WatchDir
}

if (!(Test-Path $WatchDir)) {
  Write-Host "目录不存在: $WatchDir" -ForegroundColor Red
  exit 1
}

$extensions = @(".jpg",".jpeg",".png",".tif",".tiff",".heic",".heif")

$watcher = New-Object System.IO.FileSystemWatcher
$watcher.Path = $WatchDir
$watcher.IncludeSubdirectories = $true
$watcher.EnableRaisingEvents = $true
$watcher.Filter = "*.*"

$script:pending = $false
$script:timer = New-Object Timers.Timer
$script:timer.Interval = 3000
$script:timer.AutoReset = $false
$script:timer.add_Elapsed({
  $script:pending = $false
  Invoke-Upload
})

Register-ObjectEvent $watcher Created -Action {
  $path = $Event.SourceEventArgs.FullPath
  $ext = [System.IO.Path]::GetExtension($path).ToLower()
  if ($extensions -contains $ext) {
    if (-not $script:pending) {
      $script:pending = $true
      $script:timer.Stop()
      $script:timer.Start()
    } else {
      $script:timer.Stop()
      $script:timer.Start()
    }
  }
} | Out-Null

Write-Host "正在监控: $WatchDir" -ForegroundColor Green
Write-Host "按 Ctrl+C 停止"

while ($true) { Start-Sleep -Seconds 1 }
