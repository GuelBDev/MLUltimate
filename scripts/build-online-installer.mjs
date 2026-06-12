import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const releaseDir = path.join(root, "release");
const workDir = path.join(releaseDir, "online-installer");
const ps1Path = path.join(workDir, "MLUltimate-Installer.ps1");
const cmdPath = path.join(workDir, "install.cmd");
const sedPath = path.join(workDir, "online-installer.sed");
const outputPath = path.join(releaseDir, "MLUltimate Installer.exe");

mkdirSync(workDir, { recursive: true });

writeFileSync(
  ps1Path,
  [
    '$ErrorActionPreference = "Stop"',
    '$ProgressPreference = "SilentlyContinue"',
    "",
    '$repo = "GuelBDev/MLUltimate"',
    '$api = "https://api.github.com/repos/$repo/releases"',
    '$atom = "https://github.com/$repo/releases.atom"',
    '$downloadBase = "https://github.com/$repo/releases/download"',
    "$headers = @{",
    '  "Accept" = "application/vnd.github+json"',
    '  "User-Agent" = "MLUltimate-Installer"',
    "}",
    "",
    "function Show-Info($message) {",
    '  Write-Host "[MLUltimate Installer] $message"',
    "}",
    "",
    "function Format-VersionLabel($tag) {",
    '  $value = "$tag" -replace "^v", ""',
    '  $value = $value -replace "-alpha[.-]?", " alpha "',
    '  $value = $value -replace "-beta[.-]?", " beta "',
    '  $value = $value -replace "-rc[.-]?", " rc "',
    "  return $value.Trim()",
    "}",
    "",
    "function Get-InstallerAsset($release) {",
    "  return $release.assets |",
    "    Where-Object {",
    '      $_.name -like "*.exe" -and',
    '      $_.name -notlike "*Installer*" -and',
    '      $_.name -notlike "*Online-Setup*"',
    "    } |",
    "    Sort-Object name |",
    "    Select-Object -First 1",
    "}",
    "",
    "function Get-LatestReleaseFromApi {",
    "  $releases = Invoke-RestMethod -Headers $headers -Uri $api",
    "  foreach ($release in @($releases | Where-Object { -not $_.draft })) {",
    "    $asset = Get-InstallerAsset $release",
    "    if ($asset) {",
    "      return [pscustomobject]@{",
    "        TagName = $release.tag_name",
    "        AssetName = $asset.name",
    "        DownloadUrl = $asset.browser_download_url",
    "      }",
    "    }",
    "  }",
    "  return $null",
    "}",
    "",
    "function Get-LatestReleaseFromAtom {",
    "  $atomHeaders = @{",
    '    "Accept" = "application/atom+xml, application/xml, text/xml"',
    '    "User-Agent" = "MLUltimate-Installer"',
    "  }",
    "  [xml]$feed = (Invoke-WebRequest -Headers $atomHeaders -Uri $atom -UseBasicParsing).Content",
    "  foreach ($entry in @($feed.feed.entry)) {",
    "    $href = $null",
    "    foreach ($link in @($entry.link)) {",
    '      if ($link.rel -eq "alternate") {',
    "        $href = $link.href",
    "        break",
    "      }",
    "    }",
    "    if (-not $href) { continue }",
    '    $tag = [System.Uri]::UnescapeDataString(($href -split "/")[-1])',
    "    if (-not $tag) { continue }",
    '    $version = "$tag" -replace "^v", ""',
    '    $assetName = "MLUltimate-Launcher-$version-win-x64.exe"',
    "    return [pscustomobject]@{",
    "      TagName = $tag",
    "      AssetName = $assetName",
    '      DownloadUrl = "$downloadBase/$tag/$assetName"',
    "    }",
    "  }",
    "  return $null",
    "}",
    "",
    "try {",
    '  Show-Info "Procurando a versão mais recente no GitHub..."',
    "  $target = $null",
    "  try {",
    "    $target = Get-LatestReleaseFromApi",
    "  } catch {",
    '    Show-Info "API do GitHub indisponível; usando feed público..."',
    "  }",
    "",
    "  if (-not $target) {",
    "    $target = Get-LatestReleaseFromAtom",
    "  }",
    "",
    "  if (-not $target) {",
    '    throw "Nenhuma release com instalador Windows foi encontrada."',
    "  }",
    "",
    "  $label = Format-VersionLabel $target.TagName",
    '  $safeTag = ($target.TagName -replace "[^A-Za-z0-9_.-]", "_")',
    '  $downloadPath = Join-Path $env:TEMP "MLUltimate-$safeTag-Setup.exe"',
    "",
    '  Show-Info "Versão mais recente: $label"',
    '  Show-Info "Baixando MLUltimate $label..."',
    "  Invoke-WebRequest -Headers @{",
    '    "User-Agent" = "MLUltimate-Installer"',
    "  } -Uri $target.DownloadUrl -OutFile $downloadPath",
    "",
    "  if (-not (Test-Path $downloadPath)) {",
    '    throw "O instalador não foi baixado."',
    "  }",
    "",
    '  Show-Info "Abrindo instalador MLUltimate $label..."',
    "  Start-Process -FilePath $downloadPath -Wait",
    "} catch {",
    "  $message = $_.Exception.Message",
    '  if (-not $message) { $message = "$_" }',
    "  Add-Type -AssemblyName PresentationFramework",
    "  [System.Windows.MessageBox]::Show(",
    '    "Não foi possível baixar o MLUltimate Launcher.`n`n$message",',
    '    "MLUltimate Installer",',
    '    "OK",',
    '    "Error"',
    "  ) | Out-Null",
    "  exit 1",
    "}",
    "",
  ].join("\r\n"),
);

writeFileSync(
  cmdPath,
  [
    "@echo off",
    "setlocal",
    'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0MLUltimate-Installer.ps1"',
    "exit /b %ERRORLEVEL%",
    "",
  ].join("\r\n"),
);

writeFileSync(
  sedPath,
  [
    "[Version]",
    "Class=IEXPRESS",
    "SEDVersion=3",
    "[Options]",
    "PackagePurpose=InstallApp",
    "ShowInstallProgramWindow=1",
    "HideExtractAnimation=1",
    "UseLongFileName=1",
    "InsideCompressed=0",
    "CAB_FixedSize=0",
    "CAB_ResvCodeSigning=0",
    "RebootMode=N",
    "InstallPrompt=",
    "DisplayLicense=",
    "FinishMessage=",
    `TargetName=${outputPath}`,
    "FriendlyName=MLUltimate Installer",
    "AppLaunched=install.cmd",
    "PostInstallCmd=<None>",
    "AdminQuietInstCmd=install.cmd",
    "UserQuietInstCmd=install.cmd",
    "SourceFiles=SourceFiles",
    "[SourceFiles]",
    `SourceFiles0=${workDir}\\`,
    "[SourceFiles0]",
    "install.cmd=",
    "MLUltimate-Installer.ps1=",
    "",
  ].join("\r\n"),
);

if (process.platform !== "win32") {
  console.log("Online installer packaging skipped outside Windows.");
  process.exit(0);
}

const iexpress = path.join(process.env.SystemRoot ?? "C:\\Windows", "System32", "iexpress.exe");

if (!existsSync(iexpress)) {
  throw new Error("iexpress.exe was not found. Cannot build Windows online installer.");
}

execFileSync(iexpress, ["/N", "/Q", sedPath], { stdio: "inherit" });

if (!existsSync(outputPath)) {
  throw new Error(`Online installer was not created at ${outputPath}`);
}

console.log(`Created ${outputPath}`);
