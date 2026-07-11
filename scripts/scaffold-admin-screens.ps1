# Generates 55 self-contained admin micro-screen folders + thin route pages
# from admin-screens.manifest.json. Idempotent for structure; only (re)writes
# stub files that do not already exist so collected code is never clobbered.

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot            # edufusionbd-web/
$manifestPath = Join-Path $PSScriptRoot "admin-screens.manifest.json"
$utf8 = New-Object System.Text.UTF8Encoding($false)

function Write-Utf8($path, $content, [switch]$Force) {
  $dir = Split-Path -Parent $path
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
  if ((Test-Path $path) -and -not $Force) { return $false }
  [System.IO.File]::WriteAllText($path, $content, $utf8)
  return $true
}

function To-Pascal($slug) {
  (($slug -split '-') | ForEach-Object { $_.Substring(0,1).ToUpper() + $_.Substring(1) }) -join ''
}

$manifest = [System.IO.File]::ReadAllText($manifestPath, $utf8) | ConvertFrom-Json
$screens = $manifest.screens
$modules = @{}
$created = 0

foreach ($s in $screens) {
  $comp = (To-Pascal $s.slug) + "Screen"
  $featureDir = Join-Path $root ("src/features/admin/{0}/screens/{1}" -f $s.module, $s.slug)
  $routeDir   = Join-Path $root ("src/app/(admin)/admin/{0}" -f $s.route)

  $screenTsx = @"
// AUTO-GENERATED micro-screen stub — replace the body with collected Figma code.
// Figma nodes -> Light: $($s.light) - Dark: $($s.dark)
// ONE themed component: every color is a semantic token, so light & dark both
// render from this single code path (no separate dark file).

export function $comp() {
  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-text-primary">$($s.bn)</h1>
        <p className="mt-1 text-sm text-text-secondary">admin - $($s.module) - $($s.slug)</p>
      </header>
      <div className="grid place-items-center rounded-lg border border-dashed border-border-strong bg-surface p-12 text-center text-text-muted">
        <div>
          <p className="text-sm">Figma collection pending ($($s.en))</p>
          <p className="mt-1 text-xs">Light $($s.light) - Dark $($s.dark)</p>
        </div>
      </div>
    </section>
  );
}
"@

  $indexTs = "export { $comp } from `"./$comp`";`n"

  $apiTs = @"
// Supabase data access for admin/$($s.module)/$($s.slug).
// Add typed queries/mutations here; consume via TanStack Query in the screen.
export {};
"@

  $pageTsx = @"
import { $comp } from "@/features/admin/$($s.module)/screens/$($s.slug)";

export default function Page() {
  return <$comp />;
}
"@

  if (Write-Utf8 (Join-Path $featureDir "$comp.tsx") $screenTsx)      { $created++ }
  Write-Utf8 (Join-Path $featureDir "index.ts") $indexTs | Out-Null
  Write-Utf8 (Join-Path $featureDir "logic/api.ts") $apiTs | Out-Null
  Write-Utf8 (Join-Path $routeDir "page.tsx") $pageTsx | Out-Null

  if (-not $modules.ContainsKey($s.module)) { $modules[$s.module] = @() }
  $modules[$s.module] += "export { $comp } from `"./screens/$($s.slug)`";"
}

# Per-module barrels
foreach ($m in $modules.Keys) {
  $barrel = ($modules[$m] -join "`n") + "`n"
  Write-Utf8 (Join-Path $root ("src/features/admin/{0}/index.ts" -f $m)) $barrel -Force | Out-Null
}

Write-Host ("Screens in manifest : {0}" -f $screens.Count)
Write-Host ("New screen stubs     : {0}" -f $created)
Write-Host ("Modules              : {0}" -f ($modules.Keys -join ', '))
