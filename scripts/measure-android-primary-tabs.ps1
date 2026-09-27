param(
  [Parameter(Mandatory = $true)]
  [string]$Serial,
  [string]$Package = "com.android.vshop",
  [ValidateRange(1, 20)]
  [int]$Runs = 5
)

$ErrorActionPreference = "Stop"

function Invoke-PinnedAdb {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)
  $output = & adb -s $Serial @Arguments 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw "ADB command failed for serial $Serial."
  }
  return ($output -join "`n")
}

function Read-FirstMatch {
  param([string]$Text, [string]$Pattern, [double]$Fallback = 0)
  $match = [regex]::Match($Text, $Pattern)
  if (-not $match.Success) { return $Fallback }
  return [double]::Parse(
    $match.Groups[1].Value,
    [Globalization.CultureInfo]::InvariantCulture
  )
}

$deviceRows = & adb devices
$matchingRows = @($deviceRows | Where-Object { $_ -match "^$([regex]::Escape($Serial))\s+device(?:\s|$)" })
if ($matchingRows.Count -ne 1) {
  throw "Expected exactly one connected device row for serial $Serial."
}

$wakefulness = Invoke-PinnedAdb shell dumpsys power
if ($wakefulness -notmatch "mWakefulness=Awake") {
  throw "Device $Serial is not awake. Wake and unlock it before measuring."
}

$sizeOutput = Invoke-PinnedAdb shell wm size
$overrideSizeMatch = [regex]::Match(
  $sizeOutput,
  "Override size:\s*(\d+)x(\d+)"
)
$physicalSizeMatch = [regex]::Match(
  $sizeOutput,
  "Physical size:\s*(\d+)x(\d+)"
)
$resolvedSizeMatch = if ($overrideSizeMatch.Success) {
  $overrideSizeMatch
} else {
  $physicalSizeMatch
}
if (-not $resolvedSizeMatch.Success) {
  throw "Unable to resolve Android display size."
}
$width = [int]$resolvedSizeMatch.Groups[1].Value
$height = [int]$resolvedSizeMatch.Groups[2].Value
$tabY = [int][Math]::Round($height * 0.94)

$tabs = @(
  [pscustomobject]@{ Name = "bundles"; X = [int][Math]::Round($width * 0.18) },
  [pscustomobject]@{ Name = "shop"; X = [int][Math]::Round($width * 0.34) },
  [pscustomobject]@{ Name = "profile"; X = [int][Math]::Round($width * 0.50) },
  [pscustomobject]@{ Name = "night_market"; X = [int][Math]::Round($width * 0.66) },
  [pscustomobject]@{ Name = "settings"; X = [int][Math]::Round($width * 0.82) }
)

$startArguments = @("shell", "am", "start", "-W", "-n", "$Package/.MainActivity")
Invoke-PinnedAdb @startArguments | Out-Null
Start-Sleep -Milliseconds 1200
$pidArguments = @("shell", "pidof", "-s", $Package)
$pidValue = (Invoke-PinnedAdb @pidArguments).Trim()
if (-not $pidValue) { throw "Package $Package has no running PID." }

function Read-Memory {
  $memory = Invoke-PinnedAdb shell dumpsys meminfo $Package
  return [pscustomobject]@{
    pssKb = [int](Read-FirstMatch $memory "TOTAL PSS:\s*(\d+)")
    rssKb = [int](Read-FirstMatch $memory "TOTAL RSS:\s*(\d+)")
  }
}

function Measure-Transition {
  param($Source, $Destination, [int]$Run)
  Invoke-PinnedAdb shell input tap $Source.X $tabY | Out-Null
  Start-Sleep -Milliseconds 900
  Invoke-PinnedAdb shell dumpsys gfxinfo $Package reset | Out-Null
  Invoke-PinnedAdb shell input tap $Destination.X $tabY | Out-Null
  Start-Sleep -Milliseconds 900
  $gfx = Invoke-PinnedAdb shell dumpsys gfxinfo $Package
  $result = [pscustomobject]@{
    source = $Source.Name
    destination = $Destination.Name
    run = $Run
    totalFrames = [int](Read-FirstMatch $gfx "Total frames rendered:\s*(\d+)")
    jankyFrames = [int](Read-FirstMatch $gfx "Janky frames:\s*(\d+)")
    jankyPercent = Read-FirstMatch $gfx "Janky frames:\s*\d+\s*\(([\d.]+)%\)"
    p90Ms = [int](Read-FirstMatch $gfx "90th percentile:\s*(\d+)ms")
    p95Ms = [int](Read-FirstMatch $gfx "95th percentile:\s*(\d+)ms")
    p99Ms = [int](Read-FirstMatch $gfx "99th percentile:\s*(\d+)ms")
  }
  if ($result.totalFrames -le 0) {
    throw "No frames were rendered for $($Source.Name)->$($Destination.Name)."
  }
  Write-Host ("{0}->{1} run {2}: {3}% jank, P95 {4}ms" -f `
    $Source.Name, $Destination.Name, $Run, $result.jankyPercent, $result.p95Ms)
  return $result
}

$preMeasurementMemory = Read-Memory
$measurements = [Collections.Generic.List[object]]::new()
foreach ($source in $tabs) {
  foreach ($destination in $tabs) {
    if ($source.Name -eq $destination.Name) { continue }
    for ($run = 1; $run -le $Runs; $run += 1) {
      $measurements.Add((Measure-Transition $source $destination $run))
    }
  }
}

$postMeasurementMemory = Read-Memory
$memoryCycles = [Collections.Generic.List[object]]::new()
for ($cycle = 0; $cycle -lt 10; $cycle += 1) {
  foreach ($tab in $tabs) {
    Invoke-PinnedAdb shell input tap $tab.X $tabY | Out-Null
    Start-Sleep -Milliseconds 250
  }
  Start-Sleep -Milliseconds 300
  $cycleMemory = Read-Memory
  $memoryCycles.Add([pscustomobject]@{
    cycle = $cycle + 1
    pssKb = $cycleMemory.pssKb
    rssKb = $cycleMemory.rssKb
  })
}
$beforeMemory = $memoryCycles[0]
$afterMemory = $memoryCycles[$memoryCycles.Count - 1]
$logcatArguments = @("logcat", "-d", "--pid=$pidValue", "-v", "brief")
$logcat = Invoke-PinnedAdb @logcatArguments
$fatalLines = @($logcat -split "`n" | Where-Object {
  $_ -match "TypeError|FATAL EXCEPTION|ANR in|SIGSEGV|isComponentError"
})
$packageInfo = Invoke-PinnedAdb shell dumpsys package $Package

$report = [pscustomobject]@{
  capturedAt = [DateTimeOffset]::Now.ToString("o")
  device = [pscustomobject]@{
    serial = $Serial
    width = $width
    height = $height
  }
  package = [pscustomobject]@{
    name = $Package
    versionCode = [int](Read-FirstMatch $packageInfo "versionCode=(\d+)")
    versionName = if ($packageInfo -match "versionName=([^\r\n]+)") { $Matches[1].Trim() } else { "unknown" }
  }
  runsPerDirection = $Runs
  measurements = $measurements
  memory = [pscustomobject]@{
        preMeasurement = $preMeasurementMemory
        postMeasurement = $postMeasurementMemory
        cycles = $memoryCycles
    before = $beforeMemory
    after = $afterMemory
    pssDeltaKb = $afterMemory.pssKb - $beforeMemory.pssKb
    rssDeltaKb = $afterMemory.rssKb - $beforeMemory.rssKb
  }
  fatalLines = $fatalLines
}

$workspace = Split-Path -Parent $PSScriptRoot
$outputDirectory = Join-Path $workspace ".codex-tmp\performance"
New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null
$outputPath = Join-Path $outputDirectory (
  "primary-tabs-{0}.json" -f [DateTimeOffset]::Now.ToString("yyyyMMdd-HHmmss")
)
$report | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $outputPath -Encoding utf8
Write-Output "Performance report: $outputPath"
