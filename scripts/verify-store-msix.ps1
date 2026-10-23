$ErrorActionPreference = "Stop"
function Get-FileSha256Hex {
  param([Parameter(Mandatory=$true)][string]$Path)
  $algorithm = [System.Security.Cryptography.SHA256]::Create()
  $stream = [System.IO.File]::OpenRead($Path)
  try { return ([System.BitConverter]::ToString($algorithm.ComputeHash($stream))).Replace("-", "") }
  finally { $stream.Dispose(); $algorithm.Dispose() }
}

$root = Split-Path -Parent $PSScriptRoot
$record = Get-Content -LiteralPath (Join-Path $root "store/partner-center-identity.json") -Raw -Encoding UTF8 | ConvertFrom-Json
$dir = Join-Path $root "dist-msix-store-candidate"
if (-not (Test-Path -LiteralPath $dir)) { throw "MSIX output directory missing" }
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$packages = @(Get-ChildItem -LiteralPath $dir -File -Filter "*.msix")
$uploads = @(Get-ChildItem -LiteralPath $dir -File -Filter "*.msixupload")
if ($packages.Count -ne 1 -or $uploads.Count -ne 1) { throw "Expected exactly one MSIX and one MSIXUPLOAD" }
$zip = [System.IO.Compression.ZipFile]::OpenRead($packages[0].FullName)
try {
  $entry = $zip.GetEntry("AppxManifest.xml")
  if (-not $entry) { throw "AppxManifest.xml missing" }
  $reader = New-Object System.IO.StreamReader($entry.Open())
  try { [xml]$manifest = $reader.ReadToEnd() } finally { $reader.Dispose() }
  $identity = $manifest.SelectSingleNode("/*[local-name()='Package']/*[local-name()='Identity']")
  if (-not $identity) { throw "Identity node missing" }
  if ([string]$identity.Name -cne [string]$record.identityName) { throw "Identity.Name mismatch" }
  if ([string]$identity.Publisher -cne [string]$record.publisher) { throw "Identity.Publisher mismatch" }
  if ([string]$identity.Version -cne [string]$env:STORE_PACKAGE_VERSION) { throw "Identity.Version mismatch" }
  if ([string]$identity.ProcessorArchitecture -cne "x64") { throw "ProcessorArchitecture is not x64" }
  $pdn = $manifest.SelectSingleNode("//*[local-name()='PublisherDisplayName']")
  if (-not $pdn -or [string]$pdn.InnerText -cne [string]$record.publisherDisplayName) { throw "PublisherDisplayName mismatch" }
  $propertiesName = $manifest.SelectSingleNode("//*[local-name()='Properties']/*[local-name()='DisplayName']")
  $visualElements = @($manifest.SelectNodes("//*[local-name()='VisualElements']"))
  if (-not $propertiesName -or [string]$propertiesName.InnerText -cne [string]$record.productTitle) { throw "Package/Properties/DisplayName differs from recorded title" }
  if ($visualElements.Count -ne 1 -or [string]$visualElements[0].GetAttribute("DisplayName") -cne [string]$record.productTitle) { throw "uap:VisualElements/@DisplayName differs from recorded title" }
  Write-Host "MANIFEST_IDENTITY_PASS $($record.identityName) $($identity.Version) x64"
  Write-Host ("MSIX_SHA256=" + (Get-FileSha256Hex -Path $packages[0].FullName))
  Write-Host ("MSIXUPLOAD_SHA256=" + (Get-FileSha256Hex -Path $uploads[0].FullName))
  Write-Host "Candidate only: live Partner Center acceptance, signed submission, WACK and Windows install/save/restore remain HOLD."
} finally { $zip.Dispose() }
