#!/usr/bin/env pwsh
# Frontend Deployment Script

$BUCKET_NAME = "noteri-dev-static-files"
$DISTRIBUTION_ID = "E2DQ34EL6QF68"  # ✅ CloudFront Distribution ID
$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "🚀 NoteRi Frontend Deployment" -ForegroundColor Magenta
Write-Host "================================" -ForegroundColor Magenta
Write-Host ""

Write-Host "🏗️  Building..." -ForegroundColor Cyan
npm run build

Write-Host ""
Write-Host "📦 Uploading to S3..." -ForegroundColor Cyan
aws s3 sync dist/ s3://$BUCKET_NAME --delete

Write-Host ""
Write-Host "🔄 Invalidating CloudFront cache..." -ForegroundColor Cyan
aws cloudfront create-invalidation `
  --distribution-id $DISTRIBUTION_ID `
  --paths "/*" | Out-Null

Write-Host ""
Write-Host "✅ 배포 완료!" -ForegroundColor Green
Write-Host ""
Write-Host "🌐 접속 URL:" -ForegroundColor Yellow
Write-Host "   https://djwcvo3wrx68t.cloudfront.net" -ForegroundColor White
Write-Host ""
Write-Host "💡 Tip: 캐시 무효화는 1-2분 소요됩니다" -ForegroundColor Gray
Write-Host ""