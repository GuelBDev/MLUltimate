import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const releaseDir = path.join(root, "release");
const workDir = path.join(releaseDir, "online-installer");
const ps1Path = path.join(workDir, "MLUltimate-Online-Installer.ps1");
const cmdPath = path.join(workDir, "install.cmd");
const sedPath = path.join(workDir, "online-installer.sed");
const outputPath = path.join(releaseDir, "MLUltimate-Launcher-Online-Setup.exe");

mkdirSync(workDir, { recursive: true });

writeFileSync(
  ps1Path,
  [
    '$ErrorActionPreference = "Stop"',
    '$ProgressPreference = "SilentlyContinue"',
    "",
    '$repo = "GuelBDev/MLUltimate"',
    '$api = "https://api.github.com/repos/$repo/releases"',
    "$headers = @{",
    '  "Accept" = "application/vnd.github+json"',
    '  "User-Agent" = "MLUltimate-Online-Installer"',
    "}",
    "",
    "function Show-Info($message) {",
    '  Write-Host "[MLUltimate] $message"',
    "}",
    "",
    "try {",
    '  Show-Info "Procurando a versao mais recente..."',
    "  $releases = Invoke-RestMethod -Headers $headers -Uri $api",
    "  $release = $releases |",
    "    Where-Object { -not $_.draft } |",
    "    Where-Object {",
    "      $_.assets | Where-Object {",
    '        $_.name -like "*.exe" -and $_.name -notlike "*Online-Setup*"',
    "      }",
    "    } |",
    "    Select-Object -First 1",
    "",
    "  if (-not $release) {",
    '    throw "Nenhuma release com instalador Windows foi encontrada."',
    "  }",
    "",
    "  $asset = $release.assets |",
    '    Where-Object { $_.name -like "*.exe" -and $_.name -notlike "*Online-Setup*" } |',
    "    Select-Object -First 1",
    "",
    "  if (-not $asset) {",
    '    throw "A release mais recente nao possui instalador Windows."',
    "  }",
    "",
    '  $safeTag = ($release.tag_name -replace "[^A-Za-z0-9_.-]", "_")',
    '  $downloadPath = Join-Path $env:TEMP "MLUltimate-$safeTag-Setup.exe"',
    "",
    '  Show-Info "Baixando $($asset.name)..."',
    "  Invoke-WebRequest -Headers $headers -Uri $asset.browser_download_url -OutFile $downloadPath",
    "",
    "  if (-not (Test-Path $downloadPath)) {",
    '    throw "O instalador nao foi baixado."',
    "  }",
    "",
    '  Show-Info "Abrindo instalador $($release.tag_name)..."',
    "  Start-Process -FilePath $downloadPath -Wait",
    "} catch {",
    "  $message = $_.Exception.Message",
    '  if (-not $message) { $message = "$_" }',
    "  Add-Type -AssemblyName PresentationFramework",
    "  [System.Windows.MessageBox]::Show(",
    '    "Nao foi possivel baixar o MLUltimate Launcher.`n`n$message",',
    '    "MLUltimate Launcher Online Setup",',
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
    'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0MLUltimate-Online-Installer.ps1"',
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
    "FriendlyName=MLUltimate Launcher Online Setup",
    "AppLaunched=install.cmd",
    "PostInstallCmd=<None>",
    "AdminQuietInstCmd=install.cmd",
    "UserQuietInstCmd=install.cmd",
    "SourceFiles=SourceFiles",
    "[SourceFiles]",
    `SourceFiles0=${workDir}\\`,
    "[SourceFiles0]",
    "install.cmd=",
    "MLUltimate-Online-Installer.ps1=",
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
