param([switch]$VerifyOnly)
$ErrorActionPreference = 'Stop'
$p1Root = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$p1Models = Join-Path $p1Root 'artifacts/fixtures/p1-models'
New-Item -ItemType Directory -Force -Path $p1Models | Out-Null
$p1Rows = Get-Content -Encoding UTF8 (Join-Path $p1Root 'docs/architecture/processing/model-artifacts.md') | Where-Object { $_ -match '^\| (drums|bass|other|vocals) / ' }
$p1Results = @()
foreach ($p1Row in $p1Rows) {
    $p1Cells = $p1Row.Split('|') | ForEach-Object { $_.Trim().Replace('`','') }
    $p1Role=$p1Cells[1].Split('/')[0].Trim(); $p1Repository=$p1Cells[2]; $p1Revision=$p1Cells[3]; $p1File=$p1Cells[4]; $p1Bytes=[long]$p1Cells[5]; $p1Sha=$p1Cells[6]
    if ($p1File -ne "htdemucs_ft_${p1Role}_fp16weights.onnx" -or $p1Repository -ne "StemSplitio/htdemucs-ft-${p1Role}-onnx" -or $p1Revision -notmatch '^[a-f0-9]{40}$' -or $p1Sha -notmatch '^[a-f0-9]{64}$' -or $p1Bytes -ne 165612636) { throw 'Invalid approved model identity.' }
    $p1Target=Join-Path $p1Models $p1File
    $p1Cached=(Test-Path -LiteralPath $p1Target) -and ((Get-Item -LiteralPath $p1Target).Length -eq $p1Bytes) -and ((Get-FileHash -LiteralPath $p1Target -Algorithm SHA256).Hash.ToLowerInvariant() -eq $p1Sha)
    if (-not $p1Cached) {
        if ($VerifyOnly) { throw "$p1Role fixture missing or corrupt; run processing:models before eval." }
        $p1Url="https://huggingface.co/$p1Repository/resolve/$p1Revision/$p1File"
        Invoke-WebRequest -UseBasicParsing -Uri $p1Url -OutFile "$p1Target.partial" -TimeoutSec 600
        if ((Get-Item -LiteralPath "$p1Target.partial").Length -ne $p1Bytes -or (Get-FileHash -LiteralPath "$p1Target.partial" -Algorithm SHA256).Hash.ToLowerInvariant() -ne $p1Sha) { throw "$p1Role checksum mismatch" }
        Move-Item -LiteralPath "$p1Target.partial" -Destination $p1Target -Force
    }
    $p1Results += @{role=$p1Role;revision=$p1Revision;file=$p1File;bytes=$p1Bytes;sha256=$p1Sha;cached=$p1Cached}
    Write-Output "$p1Role verified $p1Bytes bytes"
}
if ($p1Results.Count -ne 4) { throw 'Expected four approved models.' }
$p1Results | ConvertTo-Json | Set-Content -Encoding UTF8 (Join-Path $p1Models 'verified.json')
