# check_health.ps1
# Force UTF-8 encoding to prevent garbled text
$OutputEncoding = [console]::OutputEncoding = [Text.UTF8Encoding]::UTF8
chcp 65001 | Out-Null

while ($true) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:8000/health" -UseBasicParsing -TimeoutSec 5
        $json = $response.Content | ConvertFrom-Json
        Write-Host "$(Get-Date -Format 'HH:mm:ss') [OK] Server alive! Sessions: $($json.active_sessions)" -ForegroundColor Green
    }
    catch {
        Write-Host "$(Get-Date -Format 'HH:mm:ss') [DEAD] Server down!" -ForegroundColor Red
    }
    Start-Sleep -Seconds 3
}