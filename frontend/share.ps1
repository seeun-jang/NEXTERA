# NEXTERA 데모 서버 외부 공개 (Cloudflare 터널)
# 실행: powershell -ExecutionPolicy Bypass -File C:\NEXTERA\frontend\share.ps1
# 처음 한 번: winget install Cloudflare.cloudflared
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
Get-Process cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 1

Start-Process powershell -ArgumentList '-NoExit','-Command',"cd `"$PSScriptRoot`"; npm run dev"

$ok = $false
for ($i = 0; $i -lt 20; $i++) {
  try { if ((Invoke-WebRequest http://127.0.0.1:5173 -UseBasicParsing -TimeoutSec 2).StatusCode -eq 200) { $ok = $true; break } } catch {}
  Start-Sleep -Seconds 1
}
if (-not $ok) { Write-Host "개발 서버가 응답하지 않아요. 새로 뜬 창을 확인하세요." -ForegroundColor Yellow; return }

$cf = (Get-Command cloudflared -ErrorAction SilentlyContinue).Source
if (-not $cf) { $cf = Get-ChildItem "C:\Program Files (x86)\cloudflared","C:\Program Files\cloudflared","$env:LOCALAPPDATA\Microsoft\WinGet" -Recurse -Filter cloudflared.exe -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName }
if (-not $cf) { Write-Host "cloudflared가 없어요: winget install Cloudflare.cloudflared" -ForegroundColor Yellow; return }

Write-Host "개발 서버 정상. 아래 https://....trycloudflare.com 주소를 30초 뒤에 공유하세요. 끄려면 Ctrl+C" -ForegroundColor Cyan
& $cf tunnel --protocol http2 --url http://127.0.0.1:5173
