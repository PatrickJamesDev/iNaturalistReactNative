param(
    [Parameter(Mandatory = $true)]
    [string]$Root,
    [switch]$Clean,
    [int]$MaxPathLength = 80
)

$ErrorActionPreference = "Stop"

function Write-Step {
    param([string]$Message)
    Write-Host "  $Message"
}

function Remove-Tree {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) {
        return
    }
    try {
        Remove-Item -LiteralPath $Path -Recurse -Force -ErrorAction Stop
    } catch {
        Write-Host "WARNING: Could not remove $Path"
        Write-Host "         $($_.Exception.Message)"
    }
}

if (-not (Test-Path -LiteralPath $Root)) {
    Write-Host "ERROR: Project folder not found: $Root"
    exit 1
}

$Root = [System.IO.Path]::GetFullPath($Root)
while ($Root.Length -gt 3 -and $Root.EndsWith('\')) {
    $Root = $Root.Substring(0, $Root.Length - 1)
}

$rootItem = Get-Item -LiteralPath $Root -Force -ErrorAction SilentlyContinue
if (-not $rootItem) {
    Write-Host "ERROR: Could not read project folder: $Root"
    exit 1
}

$reparsePoints = @()
$current = $Root
while ($current) {
    $item = Get-Item -LiteralPath $current -Force -ErrorAction SilentlyContinue
    if ($item -and (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0)) {
        $reparsePoints += $item
    }
    $parent = Split-Path -LiteralPath $current -Parent
    if ([string]::IsNullOrEmpty($parent) -or $parent -eq $current) {
        break
    }
    $current = $parent
}

$nodeModules = Join-Path $Root "node_modules"
if (Test-Path -LiteralPath $nodeModules) {
    $nmItem = Get-Item -LiteralPath $nodeModules -Force -ErrorAction SilentlyContinue
    if ($nmItem -and (($nmItem.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0)) {
        $reparsePoints += $nmItem
    }
}

foreach ($item in ($reparsePoints | Sort-Object FullName -Unique)) {
    $target = ""
    try {
        if ($item.Target) {
            $target = @($item.Target)[0]
        }
    } catch {
        $target = ""
    }
    Write-Host "WARNING: This build path is a junction or symlink:"
    Write-Host "         $($item.FullName)"
    if ($target) {
        Write-Host "         -> $target"
    }
    Write-Host "         Windows build tools may resolve the real target path, so the short"
    Write-Host "         name does not always avoid the 250-character native build limit."
    if ($target -and $target.Length -gt $MaxPathLength) {
        Write-Host "         The target path is $($target.Length) characters long. Use a real folder instead:"
        Write-Host "           robocopy `"$Root`" `"C:\inat-build`" /E /XD node_modules .git dist"
        Write-Host "           cd /d C:\inat-build"
        Write-Host "           build-apk.bat deps"
        exit 1
    }
}

if ($Root.Length -gt $MaxPathLength) {
    Write-Host "WARNING: The project path is $($Root.Length) characters long:"
    Write-Host "         $Root"
    Write-Host "         Android native builds can fail when generated object paths exceed"
    Write-Host "         250 characters. If the build fails, move it to a short real folder:"
    Write-Host "           robocopy `"$Root`" `"C:\inat-build`" /E /XD node_modules .git dist"
    Write-Host "           cd /d C:\inat-build"
    Write-Host "           build-apk.bat deps"
}

$cxxDirs = @()
$rootPattern = [System.Management.Automation.WildcardPattern]::Escape($Root)
$cxxPatterns = @(
    "$rootPattern\node_modules\*\android\.cxx",
    "$rootPattern\node_modules\@*\*\android\.cxx",
    "$rootPattern\node_modules\*\node_modules\*\android\.cxx",
    "$rootPattern\android\app\.cxx",
    "$rootPattern\android\.cxx"
)
foreach ($pattern in $cxxPatterns) {
    $found = Get-ChildItem -Path $pattern -Directory -Force -ErrorAction SilentlyContinue
    if ($found) {
        $cxxDirs += $found
    }
}
$cxxDirs = @($cxxDirs | Sort-Object FullName -Unique)

$staleReasons = @()
$staleCxx = @()

$autolinkingJson = Join-Path $Root "android\build\generated\autolinking\autolinking.json"
if (Test-Path -LiteralPath $autolinkingJson) {
    try {
        $config = Get-Content -Raw -LiteralPath $autolinkingJson | ConvertFrom-Json
        $configRoot = [string]$config.root
        if ($configRoot -and [System.IO.Path]::IsPathRooted($configRoot)) {
            $configRoot = ($configRoot -replace '/', '\').TrimEnd('\')
            if ($configRoot -ine $Root) {
                $staleReasons += "autolinking was generated for $configRoot"
            }
        }
        $reactNativePath = [string]$config.reactNativePath
        if ($reactNativePath -and [System.IO.Path]::IsPathRooted($reactNativePath)) {
            $reactNativePath = ($reactNativePath -replace '/', '\').TrimEnd('\')
            if (-not $reactNativePath.StartsWith($Root + '\', [System.StringComparison]::OrdinalIgnoreCase)) {
                $staleReasons += "autolinking points react-native at $reactNativePath"
            }
        }
    } catch {
        $staleReasons += "autolinking.json could not be read"
    }
}

foreach ($cxx in $cxxDirs) {
    $cache = Get-ChildItem -LiteralPath $cxx.FullName -Recurse -File -Filter "CMakeCache.txt" -Force -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $cache) {
        $staleCxx += $cxx
        continue
    }
    $homeLine = Select-String -LiteralPath $cache.FullName -Pattern '^CMAKE_HOME_DIRECTORY:INTERNAL=(.*)$' -List -ErrorAction SilentlyContinue
    if (-not $homeLine) {
        $staleCxx += $cxx
        continue
    }
    $cacheRoot = $homeLine.Matches[0].Groups[1].Value.Trim() -replace '/', '\'
    if (-not ($cacheRoot -ieq $Root -or $cacheRoot.StartsWith($Root + '\', [System.StringComparison]::OrdinalIgnoreCase))) {
        $staleCxx += $cxx
    }
}

if ($Clean) {
    Write-Step "Cleaning native build caches..."
} elseif ($staleReasons.Count -gt 0 -or $staleCxx.Count -gt 0) {
    Write-Step "Found build output from a different project folder:"
    foreach ($reason in ($staleReasons | Sort-Object -Unique)) {
        Write-Step "  $reason"
    }
    if ($staleCxx.Count -gt 0) {
        Write-Step "  stale CMake caches: $($staleCxx.Count)"
    }
    Write-Step "Cleaning them so Gradle and CMake use $Root ..."
}

if ($Clean -or $staleReasons.Count -gt 0 -or $staleCxx.Count -gt 0) {
    Remove-Tree (Join-Path $Root "android\build")
    Remove-Tree (Join-Path $Root "android\.gradle")
    Remove-Tree (Join-Path $Root "android\app\build")
    Remove-Tree (Join-Path $Root "android\app\.cxx")

    if ($Clean) {
        $toRemove = $cxxDirs
    } else {
        $toRemove = $staleCxx
    }

    foreach ($cxx in $toRemove) {
        Remove-Tree $cxx.FullName
        $packageBuild = Join-Path $cxx.Parent.FullName "build"
        Remove-Tree $packageBuild
    }
}

exit 0
