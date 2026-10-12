param([switch]$VerifyOnly)
$ErrorActionPreference = 'Stop'
$transcriptionRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$transcriptionDirectory = Join-Path $transcriptionRoot 'artifacts/fixtures/transcription-models'
$transcriptionManifest = Get-Content -Encoding UTF8 -Raw -LiteralPath (Join-Path $transcriptionRoot 'src/transcription/model-artifacts.json') | ConvertFrom-Json
New-Item -ItemType Directory -Force -Path $transcriptionDirectory | Out-Null
foreach ($transcriptionModel in $transcriptionManifest.models) {
    if ($transcriptionModel.revision -notmatch '^[a-f0-9]{40}$' -or $transcriptionModel.sha256 -notmatch '^[a-f0-9]{64}$' -or $transcriptionModel.file -notmatch '^[a-zA-Z0-9_.-]+\.onnx$') { throw 'Invalid immutable model identity.' }
    $transcriptionExpectedUrl = if ($transcriptionModel.id -eq 'basic-pitch') { "https://raw.githubusercontent.com/spotify/basic-pitch/$($transcriptionModel.revision)/basic_pitch/saved_models/icassp_2022/nmp.onnx" } else { "https://huggingface.co/$($transcriptionModel.repository)/resolve/$($transcriptionModel.revision)/$($transcriptionModel.file)" }
    if ($transcriptionModel.url -ne $transcriptionExpectedUrl) { throw 'Model URL identity mismatch.' }
    $transcriptionTarget = Join-Path $transcriptionDirectory $transcriptionModel.file
    $transcriptionCached = (Test-Path -LiteralPath $transcriptionTarget) -and ((Get-Item -LiteralPath $transcriptionTarget).Length -eq $transcriptionModel.bytes) -and ((Get-FileHash -LiteralPath $transcriptionTarget -Algorithm SHA256).Hash.ToLowerInvariant() -eq $transcriptionModel.sha256)
    if (-not $transcriptionCached) {
        if ($VerifyOnly) { throw "$($transcriptionModel.id): asset missing or corrupt." }
        $transcriptionPartial = $transcriptionTarget + '.partial'
        Invoke-WebRequest -UseBasicParsing -Uri $transcriptionModel.url -OutFile $transcriptionPartial -TimeoutSec 600
        if ((Get-Item -LiteralPath $transcriptionPartial).Length -ne $transcriptionModel.bytes -or (Get-FileHash -LiteralPath $transcriptionPartial -Algorithm SHA256).Hash.ToLowerInvariant() -ne $transcriptionModel.sha256) { throw "$($transcriptionModel.id): checksum mismatch." }
        Move-Item -LiteralPath $transcriptionPartial -Destination $transcriptionTarget -Force
    }
    Write-Output "$($transcriptionModel.id): verified"
}
