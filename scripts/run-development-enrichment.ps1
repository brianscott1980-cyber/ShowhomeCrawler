$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Split-Path -Parent $PSScriptRoot)
$nodeExecutable = (Get-Command node.exe).Source
& $nodeExecutable --import tsx src/cli/enrich-developments.ts --skip-builders
while ($true) {
    $progressPath = Join-Path (Get-Location) '.showhome/enrichment/progress.json'
    $progress = Get-Content -LiteralPath $progressPath -Raw | ConvertFrom-Json
    if ($progress.status -eq 'completed' -and $progress.failed -eq 0) { break }
    if ($progress.status -eq 'completed_with_failures') {
        Write-Output 'Retrying failed enrichment requests in 15 minutes.'
        Start-Sleep -Seconds 900
        & $nodeExecutable --import tsx src/cli/enrich-developments.ts --skip-builders --retry
    } else {
        Write-Output 'Restarting interrupted enrichment scan in 15 minutes; published summaries are retained.'
        Start-Sleep -Seconds 900
        & $nodeExecutable --import tsx src/cli/enrich-developments.ts --skip-builders
    }
}
