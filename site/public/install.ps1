# VibeDoc installer for Windows (PowerShell 5.1+). No Node needed: it brings its own.
#
#   irm https://quanghoangf.github.io/vibedoc/install.ps1 | iex
#   & ([scriptblock]::Create((irm https://quanghoangf.github.io/vibedoc/install.ps1))) -Update
#   & ([scriptblock]::Create((irm https://quanghoangf.github.io/vibedoc/install.ps1))) -Uninstall
#
# What it does: downloads the official Node.js LTS build into %USERPROFILE%\.vibedoc\node (checksum-verified),
# installs the vibedoc npm package into %USERPROFILE%\.vibedoc\lib with that Node, and writes the launcher
# %USERPROFILE%\.vibedoc\bin\vibedoc.cmd. It asks before adding that folder to your user PATH; no admin rights.
#
# Environment: VIBEDOC_HOME, VIBEDOC_VERSION (default latest), VIBEDOC_NO_MODIFY_PATH=1.
param([switch]$Update, [switch]$Uninstall)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue' # Invoke-WebRequest is much faster without the progress bar

$NodeLine = 'latest-v22.x' # Node 22 LTS; VibeDoc needs 20.9 or newer
$HomeDir = if ($env:VIBEDOC_HOME) { $env:VIBEDOC_HOME } else { Join-Path $env:USERPROFILE '.vibedoc' }
$Version = if ($env:VIBEDOC_VERSION) { $env:VIBEDOC_VERSION } else { 'latest' }
$BinDir = Join-Path $HomeDir 'bin'

function Fail($msg) { Write-Host "vibedoc install: $msg" -ForegroundColor Red; exit 1 }

function Get-UserPath { [Environment]::GetEnvironmentVariable('Path', 'User') }
function Test-OnPath($dir) { (Get-UserPath) -split ';' | Where-Object { $_.TrimEnd('\') -ieq $dir.TrimEnd('\') } }

if ($Uninstall) {
  foreach ($d in 'node', 'lib', 'bin') { Remove-Item -Recurse -Force -ErrorAction SilentlyContinue (Join-Path $HomeDir $d) }
  Write-Host "Removed VibeDoc from $HomeDir (your projects and saved test runs are untouched)."
  if (Test-OnPath $BinDir) {
    $answer = Read-Host "Remove $BinDir from your user PATH too? [y/N]"
    if ($answer -match '^(y|yes)$') {
      $kept = ((Get-UserPath) -split ';' | Where-Object { $_ -and $_.TrimEnd('\') -ine $BinDir.TrimEnd('\') }) -join ';'
      [Environment]::SetEnvironmentVariable('Path', $kept, 'User')
      Write-Host 'Removed from PATH.'
    }
  }
  exit 0
}

$arch = switch ($env:PROCESSOR_ARCHITECTURE) { 'AMD64' { 'x64' } 'ARM64' { 'arm64' } default { Fail "unsupported CPU $($env:PROCESSOR_ARCHITECTURE); install Node.js 20.9+ and run: npm install -g vibedoc" } }

$tmp = Join-Path ([IO.Path]::GetTempPath()) ("vibedoc-" + [guid]::NewGuid())
New-Item -ItemType Directory -Path $tmp | Out-Null
try {
  # Node: the newest build of the LTS line, verified against nodejs.org's SHASUMS256.txt
  $base = "https://nodejs.org/dist/$NodeLine"
  Write-Host "Downloading Node.js ($NodeLine, win-$arch)..."
  $sums = (Invoke-WebRequest -UseBasicParsing "$base/SHASUMS256.txt").Content -split "`n"
  $line = $sums | Where-Object { $_ -match " (node-v[\d.]+-win-$arch\.zip)$" } | Select-Object -First 1
  if (-not $line) { Fail "no Node.js build for win-$arch in $base" }
  $want, $file = ($line.Trim() -split '\s+')
  $zip = Join-Path $tmp $file
  Invoke-WebRequest -UseBasicParsing "$base/$file" -OutFile $zip
  $got = (Get-FileHash -Algorithm SHA256 $zip).Hash.ToLower()
  if ($got -ne $want) { Fail "checksum mismatch for $file (expected $want, got $got); nothing was installed" }
  Expand-Archive -Path $zip -DestinationPath $tmp
  $node = Join-Path $tmp ($file -replace '\.zip$', '')

  # VibeDoc, installed with that Node into a staging folder, then swapped in
  Write-Host "Installing vibedoc@$Version..."
  $env:Path = "$node;$env:Path"
  & (Join-Path $node 'npm.cmd') install --global --prefix (Join-Path $tmp 'lib') --no-fund --no-audit --no-update-notifier --loglevel=error "vibedoc@$Version"
  if ($LASTEXITCODE -ne 0) { Fail "npm install vibedoc@$Version failed" }

  New-Item -ItemType Directory -Force -Path $HomeDir | Out-Null
  foreach ($d in 'node', 'lib') { Remove-Item -Recurse -Force -ErrorAction SilentlyContinue (Join-Path $HomeDir $d) }
  Move-Item $node (Join-Path $HomeDir 'node')
  Move-Item (Join-Path $tmp 'lib') (Join-Path $HomeDir 'lib')
} finally {
  Remove-Item -Recurse -Force -ErrorAction SilentlyContinue $tmp
}

New-Item -ItemType Directory -Force -Path $BinDir | Out-Null
$launcher = @"
@echo off
rem VibeDoc launcher written by install.ps1: its own Node first on PATH (the CLI starts the server with npx).
set "PATH=$HomeDir\node;%PATH%"
"$HomeDir\node\node.exe" "$HomeDir\lib\node_modules\vibedoc\bin\vibedoc.mjs" %*
"@
Set-Content -Path (Join-Path $BinDir 'vibedoc.cmd') -Value $launcher -Encoding ASCII

$installed = & (Join-Path $BinDir 'vibedoc.cmd') --version
if ($LASTEXITCODE -ne 0) { Fail "installed, but 'vibedoc --version' failed" }
if ($Update) { Write-Host "Updated VibeDoc to $installed." } else { Write-Host "Installed VibeDoc $installed in $HomeDir." }

# PATH: only with a yes from the person at the keyboard
if (Test-OnPath $BinDir) { Write-Host 'Open a new terminal, then run: vibedoc'; exit 0 }
$answer = 'n'
if (-not $env:VIBEDOC_NO_MODIFY_PATH -and [Environment]::UserInteractive -and -not [Console]::IsInputRedirected) {
  $answer = Read-Host "Add $BinDir to your user PATH? [y/N]"
}
if ($answer -match '^(y|yes)$') {
  $current = Get-UserPath
  [Environment]::SetEnvironmentVariable('Path', ($(if ($current) { "$current;" } else { '' }) + $BinDir), 'User')
  Write-Host 'Added to your user PATH. Open a new terminal, then run: vibedoc'
} else {
  Write-Host "Not changing your PATH. Run it directly: $BinDir\vibedoc.cmd"
  Write-Host "Or add $BinDir to your user PATH (Settings > Environment variables)."
}
