$ErrorActionPreference = 'Stop'
$repository = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $repository
$migrationDirectory = Join-Path $repository '.showhome/storage-migration'
$finishPath = Join-Path $migrationDirectory 'finish.json'
function Save-Finish($value) {
    $value.updatedAt = [DateTime]::UtcNow.ToString('o')
    [IO.File]::WriteAllText($finishPath, ($value | ConvertTo-Json -Depth 10))
}
Save-Finish @{status='waiting_for_verified_import'}
while ($true) {
    $progressPath = Join-Path $migrationDirectory 'progress.json'
    if (Test-Path -LiteralPath $progressPath) {
        $progress = Get-Content -LiteralPath $progressPath -Raw -Encoding UTF8 | ConvertFrom-Json
        if ($progress.status -eq 'completed') { break }
        if ($progress.status -eq 'completed_with_errors' -or $progress.status -eq 'failed') {
            Save-Finish @{status='needs_review';reason='Import verification reported errors. Existing workers and NAS originals are retained.'}
            exit 1
        }
    }
    Start-Sleep -Seconds 30
}
try {
    # Reload only the local classification supervisors and their classifier children.
    # Do not stop development enrichment, the website, Ollama itself or other Node tasks.
    $supervisors = @(Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object {$_.CommandLine -match 'src[/\\]cli[/\\](process-local|classify-gemini-local)\.ts'})
    $supervisorRunning = @($supervisors | Where-Object {$_.CommandLine -match 'process-local\.ts'}).Count -gt 0
    $geminiRunning = @($supervisors | Where-Object {$_.CommandLine -match 'classify-gemini-local\.ts'}).Count -gt 0
    foreach ($worker in $supervisors) { Stop-Process -Id $worker.ProcessId -ErrorAction SilentlyContinue }
    $classifiers = @(Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object {$_.CommandLine -match 'src[/\\]cli[/\\]classify-local\.ts'})
    foreach ($worker in $classifiers) { Stop-Process -Id $worker.ProcessId -ErrorAction SilentlyContinue }
    # This classifier creates empty locks; after all its processes are stopped,
    # remove those locks so the new supervisor can resume its saved snapshots.
    $classificationRoot = Join-Path $repository '.showhome/processing/classification-work'
    foreach ($folder in @(Get-ChildItem -LiteralPath $classificationRoot -Directory -ErrorAction SilentlyContinue)) {
        $lockPath = Join-Path $folder.FullName '.lock'
        $lockFile = Get-Item -LiteralPath $lockPath -ErrorAction SilentlyContinue
        if ($lockFile -and $lockFile.Length -eq 0) { Remove-Item -LiteralPath $lockPath }
    }
    $nodeExecutable = (Get-Command node.exe).Source
    $newPid = $null
    if ($supervisorRunning) {
        $newSupervisor = Start-Process -FilePath $nodeExecutable -ArgumentList '--import','tsx','src/cli/process-local.ts' -WorkingDirectory $repository -WindowStyle Hidden -RedirectStandardOutput (Join-Path $repository '.showhome/processing/supervisor-local-storage.log') -RedirectStandardError (Join-Path $repository '.showhome/processing/supervisor-local-storage-error.log') -PassThru
        $newPid = $newSupervisor.Id
    } elseif ($geminiRunning) {
        Start-Process -FilePath $nodeExecutable -ArgumentList '--import','tsx','src/cli/classify-gemini-local.ts' -WorkingDirectory $repository -WindowStyle Hidden -RedirectStandardOutput (Join-Path $repository '.showhome/processing/gemini-local-storage.log') -RedirectStandardError (Join-Path $repository '.showhome/processing/gemini-local-storage-error.log') | Out-Null
    }
    Save-Finish @{status='completed';supervisorPid=$newPid;import=$progress;nasRequired=$false}
    & $nodeExecutable scripts/release-local-content-migration.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Import completed, but its Git completion report could not be released. See finish-error.log.' }
} catch {
    Save-Finish @{status='needs_review';reason=$_.Exception.Message}
    throw
}
