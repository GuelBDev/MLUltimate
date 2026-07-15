import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const releaseDir = path.join(root, "release");
const workDir = path.join(releaseDir, "online-installer");
const ps1Path = path.join(workDir, "MLUltimate-Installer.ps1");
const vbsPath = path.join(workDir, "install.vbs");
const sedPath = path.join(workDir, "online-installer.sed");
const csharpPath = path.join(workDir, "MLUltimateInstaller.cs");
const heroPath = path.join(workDir, "launcher-hero.png");
const iconPath = path.join(workDir, "mlultimate-icon.png");
const outputPath = path.join(releaseDir, "MLUltimate Installer.exe");
const windowsSiteOutputPath = path.join(releaseDir, "MLUltimate-Installer-Windows.exe");
const linuxOutputPath = path.join(releaseDir, "MLUltimate-Installer-Linux.sh");
const downloadPagePath = path.join(releaseDir, "download.html");
const downloadLogoPath = path.join(releaseDir, "mlultimate-download-logo.png");
const downloadHeroPath = path.join(releaseDir, "mlultimate-download-hero.png");
const packageJson = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
const assemblyVersion = toAssemblyVersion(packageJson.version);

mkdirSync(workDir, { recursive: true });
copyFileSync(path.join(root, "src/assets/launcher-hero.png"), heroPath);
copyFileSync(path.join(root, "src/assets/mlultimate-icon.png"), iconPath);
copyFileSync(path.join(root, "src/assets/mlultimate-icon.png"), downloadLogoPath);
copyFileSync(path.join(root, "src/assets/launcher-hero.png"), downloadHeroPath);

writeFileSync(
  ps1Path,
  [
    '$ErrorActionPreference = "Stop"',
    '$ProgressPreference = "SilentlyContinue"',
    '$repo = "GuelBDev/MLUltimate"',
    '$api = "https://api.github.com/repos/$repo/releases"',
    '$atom = "https://github.com/$repo/releases.atom"',
    '$downloadBase = "https://github.com/$repo/releases/download"',
    '$headers = @{ "Accept" = "application/vnd.github+json"; "User-Agent" = "MLUltimate-Installer" }',
    "try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch {}",
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
    "      return [pscustomobject]@{ TagName = $release.tag_name; DownloadUrl = $asset.browser_download_url }",
    "    }",
    "  }",
    "  return $null",
    "}",
    "",
    "function Get-LatestReleaseFromAtom {",
    '  [xml]$feed = (Invoke-WebRequest -Headers @{ "Accept" = "application/atom+xml, application/xml, text/xml"; "User-Agent" = "MLUltimate-Installer" } -Uri $atom -UseBasicParsing).Content',
    "  foreach ($entry in @($feed.feed.entry)) {",
    "    $href = $null",
    "    foreach ($link in @($entry.link)) {",
    '      if ($link.rel -eq "alternate") { $href = $link.href; break }',
    "    }",
    "    if (-not $href) { continue }",
    '    $tag = [System.Uri]::UnescapeDataString(($href -split "/")[-1])',
    "    if (-not $tag) { continue }",
    '    $version = "$tag" -replace "^v", ""',
    '    $assetName = "MLUltimate-Launcher-$version-win-x64.exe"',
    '    return [pscustomobject]@{ TagName = $tag; DownloadUrl = "$downloadBase/$tag/$assetName" }',
    "  }",
    "  return $null",
    "}",
    "",
    "function Get-LatestRelease {",
    "  try {",
    "    $target = Get-LatestReleaseFromApi",
    "    if ($target) { return $target }",
    "  } catch {}",
    "  return Get-LatestReleaseFromAtom",
    "}",
    "",
    "Add-Type -AssemblyName PresentationFramework",
    "Add-Type -AssemblyName PresentationCore",
    "Add-Type -AssemblyName WindowsBase",
    "",
    "$window = New-Object System.Windows.Window",
    '$window.Title = "MLUltimate Launcher Setup"',
    "$window.Width = 820",
    "$window.Height = 520",
    "$window.ResizeMode = 'NoResize'",
    "$window.WindowStartupLocation = 'CenterScreen'",
    "$window.Background = New-Object System.Windows.Media.SolidColorBrush ([System.Windows.Media.Color]::FromRgb(10,14,20))",
    "$window.AllowsTransparency = $false",
    "",
    "$rootGrid = New-Object System.Windows.Controls.Grid",
    "$rootGrid.Background = New-Object System.Windows.Media.SolidColorBrush ([System.Windows.Media.Color]::FromRgb(10,14,20))",
    "$window.Content = $rootGrid",
    "",
    "$leftColumn = New-Object System.Windows.Controls.ColumnDefinition",
    "$leftColumn.Width = New-Object System.Windows.GridLength 315",
    "$rightColumn = New-Object System.Windows.Controls.ColumnDefinition",
    "$rightColumn.Width = New-Object System.Windows.GridLength 1, Star",
    "$rootGrid.ColumnDefinitions.Add($leftColumn)",
    "$rootGrid.ColumnDefinitions.Add($rightColumn)",
    "",
    "$heroPanel = New-Object System.Windows.Controls.Grid",
    "$heroPanel.Background = New-Object System.Windows.Media.SolidColorBrush ([System.Windows.Media.Color]::FromRgb(14,20,31))",
    "[System.Windows.Controls.Grid]::SetColumn($heroPanel, 0)",
    "$rootGrid.Children.Add($heroPanel) | Out-Null",
    "",
    "$hero = New-Object System.Windows.Controls.Image",
    "$hero.Source = [System.Windows.Media.Imaging.BitmapImage]::new([Uri](Join-Path $PSScriptRoot 'launcher-hero.png'))",
    "$hero.Stretch = 'UniformToFill'",
    "$hero.Opacity = 0.38",
    "$heroPanel.Children.Add($hero) | Out-Null",
    "",
    "$heroShade = New-Object System.Windows.Controls.Border",
    "$heroShade.Background = New-Object System.Windows.Media.SolidColorBrush ([System.Windows.Media.Color]::FromArgb(205,10,14,20))",
    "$heroPanel.Children.Add($heroShade) | Out-Null",
    "",
    "$brandStack = New-Object System.Windows.Controls.StackPanel",
    "$brandStack.Margin = '30'",
    "$brandStack.VerticalAlignment = 'Bottom'",
    "$heroPanel.Children.Add($brandStack) | Out-Null",
    "",
    "$iconFrame = New-Object System.Windows.Controls.Border",
    "$iconFrame.Width = 82",
    "$iconFrame.Height = 82",
    "$iconFrame.CornerRadius = 18",
    "$iconFrame.Padding = '8'",
    "$iconFrame.Background = New-Object System.Windows.Media.SolidColorBrush ([System.Windows.Media.Color]::FromArgb(220,255,255,255))",
    "$iconFrame.HorizontalAlignment = 'Left'",
    "$brandStack.Children.Add($iconFrame) | Out-Null",
    "",
    "$icon = New-Object System.Windows.Controls.Image",
    "$icon.Source = [System.Windows.Media.Imaging.BitmapImage]::new([Uri](Join-Path $PSScriptRoot 'mlultimate-icon.png'))",
    "$icon.Stretch = 'Uniform'",
    "$iconFrame.Child = $icon",
    "",
    "$brandTitle = New-Object System.Windows.Controls.TextBlock",
    '$brandTitle.Text = "MLUltimate Launcher"',
    "$brandTitle.FontSize = 27",
    "$brandTitle.FontWeight = 'Bold'",
    "$brandTitle.Foreground = [System.Windows.Media.Brushes]::White",
    "$brandTitle.Margin = '0,20,0,8'",
    "$brandStack.Children.Add($brandTitle) | Out-Null",
    "",
    "$brandCopy = New-Object System.Windows.Controls.TextBlock",
    '$brandCopy.Text = "Instalador oficial para manter seu launcher sempre atualizado."',
    "$brandCopy.FontSize = 14",
    "$brandCopy.LineHeight = 21",
    "$brandCopy.TextWrapping = 'Wrap'",
    "$brandCopy.Foreground = New-Object System.Windows.Media.SolidColorBrush ([System.Windows.Media.Color]::FromRgb(205,213,225))",
    "$brandStack.Children.Add($brandCopy) | Out-Null",
    "",
    "$content = New-Object System.Windows.Controls.Grid",
    "$content.Margin = '42,38,42,34'",
    "[System.Windows.Controls.Grid]::SetColumn($content, 1)",
    "$rootGrid.Children.Add($content) | Out-Null",
    "",
    "$contentRows = @('Auto','Auto','Auto','Auto','*','Auto')",
    "foreach ($rowHeight in $contentRows) {",
    "  $row = New-Object System.Windows.Controls.RowDefinition",
    "  if ($rowHeight -eq 'Auto') { $row.Height = [System.Windows.GridLength]::Auto } else { $row.Height = New-Object System.Windows.GridLength 1, Star }",
    "  $content.RowDefinitions.Add($row)",
    "}",
    "",
    "$badge = New-Object System.Windows.Controls.Border",
    "$badge.Padding = '10,6'",
    "$badge.CornerRadius = 999",
    "$badge.HorizontalAlignment = 'Left'",
    "$badge.Background = New-Object System.Windows.Media.SolidColorBrush ([System.Windows.Media.Color]::FromRgb(20,83,45))",
    "$badgeText = New-Object System.Windows.Controls.TextBlock",
    '$badgeText.Text = "INSTALADOR OFICIAL"',
    "$badgeText.FontSize = 11",
    "$badgeText.FontWeight = 'Bold'",
    "$badgeText.Foreground = New-Object System.Windows.Media.SolidColorBrush ([System.Windows.Media.Color]::FromRgb(187,247,208))",
    "$badge.Child = $badgeText",
    "[System.Windows.Controls.Grid]::SetRow($badge, 0)",
    "$content.Children.Add($badge) | Out-Null",
    "",
    "$title = New-Object System.Windows.Controls.TextBlock",
    '$title.Text = "Preparando o MLUltimate"',
    "$title.FontSize = 31",
    "$title.FontWeight = 'Bold'",
    "$title.Foreground = [System.Windows.Media.Brushes]::White",
    "$title.Margin = '0,20,0,8'",
    "[System.Windows.Controls.Grid]::SetRow($title, 1)",
    "$content.Children.Add($title) | Out-Null",
    "",
    "$subtitle = New-Object System.Windows.Controls.TextBlock",
    '$subtitle.Text = "Este instalador baixa a versao mais recente publicada no GitHub oficial e conclui a instalacao automaticamente."',
    "$subtitle.FontSize = 14",
    "$subtitle.LineHeight = 21",
    "$subtitle.TextWrapping = 'Wrap'",
    "$subtitle.Foreground = New-Object System.Windows.Media.SolidColorBrush ([System.Windows.Media.Color]::FromRgb(176,185,201))",
    "$subtitle.Margin = '0,0,0,26'",
    "[System.Windows.Controls.Grid]::SetRow($subtitle, 2)",
    "$content.Children.Add($subtitle) | Out-Null",
    "",
    "$steps = New-Object System.Windows.Controls.StackPanel",
    "$steps.Margin = '0,0,0,24'",
    "[System.Windows.Controls.Grid]::SetRow($steps, 3)",
    "$content.Children.Add($steps) | Out-Null",
    "",
    "$step1 = New-Object System.Windows.Controls.TextBlock",
    '$step1.Text = "1. Verificando a release mais recente"',
    "$step1.FontSize = 13",
    "$step1.Foreground = New-Object System.Windows.Media.SolidColorBrush ([System.Windows.Media.Color]::FromRgb(226,232,240))",
    "$step1.Margin = '0,0,0,8'",
    "$steps.Children.Add($step1) | Out-Null",
    "$step2 = New-Object System.Windows.Controls.TextBlock",
    '$step2.Text = "2. Baixando arquivos seguros do launcher"',
    "$step2.FontSize = 13",
    "$step2.Foreground = New-Object System.Windows.Media.SolidColorBrush ([System.Windows.Media.Color]::FromRgb(148,163,184))",
    "$step2.Margin = '0,0,0,8'",
    "$steps.Children.Add($step2) | Out-Null",
    "$step3 = New-Object System.Windows.Controls.TextBlock",
    '$step3.Text = "3. Instalando no Windows"',
    "$step3.FontSize = 13",
    "$step3.Foreground = New-Object System.Windows.Media.SolidColorBrush ([System.Windows.Media.Color]::FromRgb(148,163,184))",
    "$steps.Children.Add($step3) | Out-Null",
    "",
    "$progressPanel = New-Object System.Windows.Controls.StackPanel",
    "$progressPanel.VerticalAlignment = 'Bottom'",
    "[System.Windows.Controls.Grid]::SetRow($progressPanel, 5)",
    "$content.Children.Add($progressPanel) | Out-Null",
    "",
    "$progress = New-Object System.Windows.Controls.ProgressBar",
    "$progress.Height = 14",
    "$progress.Minimum = 0",
    "$progress.Maximum = 100",
    "$progress.Value = 6",
    "$progress.Foreground = New-Object System.Windows.Media.SolidColorBrush ([System.Windows.Media.Color]::FromRgb(34,197,94))",
    "$progress.Background = New-Object System.Windows.Media.SolidColorBrush ([System.Windows.Media.Color]::FromRgb(31,41,55))",
    "$progressPanel.Children.Add($progress) | Out-Null",
    "",
    "$status = New-Object System.Windows.Controls.TextBlock",
    '$status.Text = "Conectando ao GitHub oficial..."',
    "$status.FontSize = 13",
    "$status.Foreground = New-Object System.Windows.Media.SolidColorBrush ([System.Windows.Media.Color]::FromRgb(203,213,225))",
    "$status.Margin = '0,14,0,0'",
    "$status.TextWrapping = 'Wrap'",
    "$progressPanel.Children.Add($status) | Out-Null",
    "",
    "$closeButton = New-Object System.Windows.Controls.Button",
    '$closeButton.Content = "Fechar"',
    "$closeButton.Height = 40",
    "$closeButton.Width = 120",
    "$closeButton.Margin = '0,20,0,0'",
    "$closeButton.HorizontalAlignment = 'Left'",
    "$closeButton.Visibility = 'Collapsed'",
    "$closeButton.Add_Click({ $window.Close() })",
    "$progressPanel.Children.Add($closeButton) | Out-Null",
    "",
    "function Ui($action) { $window.Dispatcher.Invoke([Action]$action) }",
    "function Pump-Ui {",
    "  $frame = New-Object System.Windows.Threading.DispatcherFrame",
    "  [System.Windows.Threading.Dispatcher]::CurrentDispatcher.BeginInvoke([Action]{ $frame.Continue = $false }, [System.Windows.Threading.DispatcherPriority]::Background) | Out-Null",
    "  [System.Windows.Threading.Dispatcher]::PushFrame($frame)",
    "}",
    "function Fail($message) {",
    "  Ui {",
    '    $status.Text = "Nao foi possivel instalar: $message"',
    "    $progress.Value = 100",
    "    $progress.Foreground = New-Object System.Windows.Media.SolidColorBrush ([System.Windows.Media.Color]::FromRgb(239,68,68))",
    "    $closeButton.Visibility = 'Visible'",
    "  }",
    "  Pump-Ui",
    "}",
    "",
    "function Save-FileWithProgress($url, $destination) {",
    "  $request = [System.Net.HttpWebRequest]::Create($url)",
    '  $request.UserAgent = "MLUltimate-Installer"',
    "  $request.AllowAutoRedirect = $true",
    "  $response = $request.GetResponse()",
    "  try {",
    "    $total = [double]$response.ContentLength",
    "    $stream = $response.GetResponseStream()",
    "    $file = [System.IO.File]::Create($destination)",
    "    try {",
    "      $buffer = New-Object byte[] 81920",
    "      $received = 0.0",
    "      $read = $stream.Read($buffer, 0, $buffer.Length)",
    "      while ($read -gt 0) {",
    "        $file.Write($buffer, 0, $read)",
    "        $received += $read",
    "        $percent = 50",
    "        if ($total -gt 0) {",
    "          $percent = [Math]::Min(94, [Math]::Max(14, [Math]::Floor(($received / $total) * 80) + 14))",
    "        }",
        "        Ui {",
    '          $status.Text = "Baixando arquivos do launcher..."',
    "          $progress.Value = $percent",
    "          $step1.Foreground = New-Object System.Windows.Media.SolidColorBrush ([System.Windows.Media.Color]::FromRgb(134,239,172))",
    "          $step2.Foreground = New-Object System.Windows.Media.SolidColorBrush ([System.Windows.Media.Color]::FromRgb(226,232,240))",
    "        }",
    "        Pump-Ui",
    "        $read = $stream.Read($buffer, 0, $buffer.Length)",
    "      }",
    "    } finally {",
    "      if ($file) { $file.Dispose() }",
    "      if ($stream) { $stream.Dispose() }",
    "    }",
    "  } finally {",
    "    if ($response) { $response.Dispose() }",
    "  }",
    "}",
    "",
    "$window.Add_Loaded({",
    "  try {",
    "    $target = Get-LatestRelease",
    '    if (-not $target) { throw "Nenhum instalador Windows foi encontrado no GitHub." }',
    '    $safeTag = ($target.TagName -replace "[^A-Za-z0-9_.-]", "_")',
    '    $downloadPath = Join-Path $env:TEMP "MLUltimate-$safeTag-Setup.exe"',
    "    Ui { $status.Text = 'Conectando ao GitHub oficial...'; $progress.Value = 12; $step1.Foreground = New-Object System.Windows.Media.SolidColorBrush ([System.Windows.Media.Color]::FromRgb(226,232,240)) }",
    "    Pump-Ui",
    "    Save-FileWithProgress $target.DownloadUrl $downloadPath",
    "    Ui { $status.Text = 'Instalando no Windows...'; $progress.Value = 96; $step2.Foreground = New-Object System.Windows.Media.SolidColorBrush ([System.Windows.Media.Color]::FromRgb(134,239,172)); $step3.Foreground = New-Object System.Windows.Media.SolidColorBrush ([System.Windows.Media.Color]::FromRgb(226,232,240)) }",
    "    Pump-Ui",
    '    Start-Process -FilePath $downloadPath -ArgumentList "/S" -Wait',
    "    Ui { $status.Text = 'Instalacao concluida.'; $progress.Value = 100; $step3.Foreground = New-Object System.Windows.Media.SolidColorBrush ([System.Windows.Media.Color]::FromRgb(134,239,172)) }",
    "    Pump-Ui",
    "    Start-Sleep -Milliseconds 900",
    "    Ui { $window.Close() }",
    "  } catch {",
    "    Fail $_.Exception.Message",
    "  }",
    "})",
    "",
    "[void]$window.ShowDialog()",
    "",
  ].join("\r\n"),
);

writeFileSync(
  vbsPath,
  [
    'Set shell = CreateObject("WScript.Shell")',
    'Set fso = CreateObject("Scripting.FileSystemObject")',
    'scriptPath = fso.BuildPath(fso.GetParentFolderName(WScript.ScriptFullName), "MLUltimate-Installer.ps1")',
    'command = "powershell.exe -NoProfile -ExecutionPolicy Bypass -STA -WindowStyle Hidden -File " & Chr(34) & scriptPath & Chr(34)',
    "WScript.Quit shell.Run(command, 0, True)",
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
    "ShowInstallProgramWindow=0",
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
    "AppLaunched=wscript.exe install.vbs",
    "PostInstallCmd=<None>",
    "AdminQuietInstCmd=wscript.exe install.vbs",
    "UserQuietInstCmd=wscript.exe install.vbs",
    "SourceFiles=SourceFiles",
    "[SourceFiles]",
    `SourceFiles0=${workDir}\\`,
    "[SourceFiles0]",
    "install.vbs=",
    "MLUltimate-Installer.ps1=",
    "launcher-hero.png=",
    "mlultimate-icon.png=",
    "",
  ].join("\r\n"),
);

writeFileSync(
  csharpPath,
  `using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Reflection;
using System.Text.RegularExpressions;
using System.Windows.Forms;

[assembly: AssemblyTitle("MLUltimate Launcher Setup")]
[assembly: AssemblyDescription("Official installer for MLUltimate Launcher")]
[assembly: AssemblyCompany("MLUltimate")]
[assembly: AssemblyProduct("MLUltimate Launcher")]
[assembly: AssemblyCopyright("Copyright MLUltimate")]
[assembly: AssemblyVersion("${assemblyVersion}")]
[assembly: AssemblyFileVersion("${assemblyVersion}")]

internal static class Program
{
    [STAThread]
    private static void Main()
    {
        ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls12;
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        Application.Run(new InstallerForm());
    }
}

internal sealed class InstallerForm : Form
{
    private const string Repo = "GuelBDev/MLUltimate";
    private const string ApiUrl = "https://api.github.com/repos/" + Repo + "/releases";
    private const string AtomUrl = "https://github.com/" + Repo + "/releases.atom";
    private const string DownloadBase = "https://github.com/" + Repo + "/releases/download";

    private readonly Panel content;
    private readonly Label title;
    private readonly Label subtitle;
    private readonly ProgressBar progress;
    private readonly Label status;
    private readonly Label step1;
    private readonly Label step2;
    private readonly Label step3;
    private readonly Button primaryButton;
    private readonly Button secondaryButton;
    private readonly RichTextBox termsBox;
    private readonly CheckBox acceptTerms;
    private readonly TextBox folderText;
    private readonly CheckBox desktopShortcut;
    private readonly CheckBox openNow;
    private string downloadFolder;
    private int stage;

    public InstallerForm()
    {
        Text = "MLUltimate Launcher Setup";
        Width = 940;
        Height = 620;
        FormBorderStyle = FormBorderStyle.FixedSingle;
        MaximizeBox = false;
        StartPosition = FormStartPosition.CenterScreen;
        BackColor = Color.FromArgb(10, 14, 20);
        Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
        Font = new Font("Segoe UI", 9);

        var root = new TableLayoutPanel();
        root.Dock = DockStyle.Fill;
        root.ColumnCount = 2;
        root.RowCount = 1;
        root.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 350));
        root.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
        Controls.Add(root);

        var left = new Panel();
        left.Dock = DockStyle.Fill;
        left.BackColor = Color.FromArgb(14, 20, 31);
        root.Controls.Add(left, 0, 0);

        var hero = new PictureBox();
        hero.Dock = DockStyle.Fill;
        hero.SizeMode = PictureBoxSizeMode.StretchImage;
        hero.Image = LoadImage("launcher-hero.png");
        left.Controls.Add(hero);

        var brand = new Panel();
        brand.Dock = DockStyle.Bottom;
        brand.Height = 210;
        brand.Padding = new Padding(30);
        brand.BackColor = Color.FromArgb(232, 10, 14, 20);
        left.Controls.Add(brand);
        brand.BringToFront();

        var logo = new PictureBox();
        logo.Width = 82;
        logo.Height = 82;
        logo.SizeMode = PictureBoxSizeMode.Zoom;
        logo.Image = LoadImage("mlultimate-icon.png");
        logo.Location = new Point(30, 24);
        brand.Controls.Add(logo);

        var brandTitle = new Label();
        brandTitle.Text = "MLUltimate Launcher";
        brandTitle.AutoSize = false;
        brandTitle.Width = 285;
        brandTitle.Height = 34;
        brandTitle.Location = new Point(30, 126);
        brandTitle.Font = new Font("Segoe UI", 18, FontStyle.Bold);
        brandTitle.ForeColor = Color.White;
        brand.Controls.Add(brandTitle);

        var brandCopy = new Label();
        brandCopy.Text = "Instalador oficial para manter seu launcher sempre atualizado.";
        brandCopy.AutoSize = false;
        brandCopy.Width = 280;
        brandCopy.Height = 48;
        brandCopy.Location = new Point(30, 166);
        brandCopy.Font = new Font("Segoe UI", 9);
        brandCopy.ForeColor = Color.FromArgb(205, 213, 225);
        brand.Controls.Add(brandCopy);

        content = new Panel();
        content.Dock = DockStyle.Fill;
        content.Padding = new Padding(42, 38, 42, 34);
        content.BackColor = Color.FromArgb(10, 14, 20);
        root.Controls.Add(content, 1, 0);

        var badge = new Label();
        badge.Text = "  INSTALADOR OFICIAL  ";
        badge.AutoSize = true;
        badge.Font = new Font("Segoe UI", 8, FontStyle.Bold);
        badge.ForeColor = Color.FromArgb(187, 247, 208);
        badge.BackColor = Color.FromArgb(20, 83, 45);
        badge.Location = new Point(42, 38);
        content.Controls.Add(badge);

        title = new Label();
        title.Text = "Preparando o MLUltimate";
        title.AutoSize = false;
        title.Width = 470;
        title.Height = 42;
        title.Location = new Point(42, 78);
        title.Font = new Font("Segoe UI", 21, FontStyle.Bold);
        title.ForeColor = Color.White;
        content.Controls.Add(title);

        subtitle = new Label();
        subtitle.Text = "Este instalador baixa a versao mais recente publicada no GitHub oficial e conclui a instalacao automaticamente.";
        subtitle.AutoSize = false;
        subtitle.Width = 470;
        subtitle.Height = 54;
        subtitle.Location = new Point(42, 128);
        subtitle.Font = new Font("Segoe UI", 9);
        subtitle.ForeColor = Color.FromArgb(176, 185, 201);
        content.Controls.Add(subtitle);

        step1 = CreateStep("1  Termos", 188, true);
        step2 = CreateStep("2  Pasta", 188, false);
        step3 = CreateStep("3  Download", 188, false);
        step2.Left = 198;
        step3.Left = 354;
        content.Controls.Add(step1);
        content.Controls.Add(step2);
        content.Controls.Add(step3);

        termsBox = new RichTextBox();
        termsBox.ReadOnly = true;
        termsBox.ScrollBars = RichTextBoxScrollBars.Vertical;
        termsBox.Width = 470;
        termsBox.Height = 190;
        termsBox.Location = new Point(42, 238);
        termsBox.BackColor = Color.FromArgb(15, 23, 42);
        termsBox.ForeColor = Color.FromArgb(226, 232, 240);
        termsBox.BorderStyle = BorderStyle.None;
        termsBox.Font = new Font("Segoe UI", 9);
        termsBox.TabStop = false;
        termsBox.DetectUrls = false;
        termsBox.Text = TermsText();
        content.Controls.Add(termsBox);

        acceptTerms = new CheckBox();
        acceptTerms.Text = "Li e aceito os termos de uso";
        acceptTerms.AutoSize = true;
        acceptTerms.Location = new Point(42, 444);
        acceptTerms.Font = new Font("Segoe UI", 9);
        acceptTerms.ForeColor = Color.FromArgb(226, 232, 240);
        acceptTerms.BackColor = Color.Transparent;
        acceptTerms.CheckedChanged += delegate { StylePrimaryButton(); };
        content.Controls.Add(acceptTerms);

        folderText = new TextBox();
        folderText.Width = 350;
        folderText.Height = 30;
        folderText.Location = new Point(42, 294);
        folderText.BackColor = Color.FromArgb(15, 23, 42);
        folderText.ForeColor = Color.White;
        folderText.BorderStyle = BorderStyle.FixedSingle;
        folderText.Visible = false;
        content.Controls.Add(folderText);

        secondaryButton = new Button();
        secondaryButton.Text = "Procurar";
        secondaryButton.Width = 110;
        secondaryButton.Height = 32;
        secondaryButton.Location = new Point(402, 292);
        secondaryButton.FlatStyle = FlatStyle.Flat;
        secondaryButton.FlatAppearance.BorderColor = Color.FromArgb(71, 85, 105);
        secondaryButton.BackColor = Color.FromArgb(30, 41, 59);
        secondaryButton.ForeColor = Color.White;
        secondaryButton.Visible = false;
        secondaryButton.Click += delegate { BrowseFolder(); };
        content.Controls.Add(secondaryButton);

        progress = new ProgressBar();
        progress.Minimum = 0;
        progress.Maximum = 100;
        progress.Value = 6;
        progress.Width = 470;
        progress.Height = 18;
        progress.Location = new Point(42, 326);
        progress.Visible = false;
        content.Controls.Add(progress);

        status = new Label();
        status.Text = "Conectando ao GitHub oficial...";
        status.AutoSize = false;
        status.Width = 470;
        status.Height = 42;
        status.Location = new Point(42, 356);
        status.Font = new Font("Segoe UI", 9);
        status.ForeColor = Color.FromArgb(203, 213, 225);
        content.Controls.Add(status);

        desktopShortcut = new CheckBox();
        desktopShortcut.Text = "Criar atalho na area de trabalho";
        desktopShortcut.Checked = true;
        desktopShortcut.AutoSize = true;
        desktopShortcut.Location = new Point(42, 292);
        desktopShortcut.Font = new Font("Segoe UI", 9);
        desktopShortcut.ForeColor = Color.FromArgb(226, 232, 240);
        desktopShortcut.BackColor = Color.Transparent;
        desktopShortcut.Visible = false;
        content.Controls.Add(desktopShortcut);

        openNow = new CheckBox();
        openNow.Text = "Abrir o MLUltimate agora";
        openNow.Checked = true;
        openNow.AutoSize = true;
        openNow.Location = new Point(42, 326);
        openNow.Font = new Font("Segoe UI", 9);
        openNow.ForeColor = Color.FromArgb(226, 232, 240);
        openNow.BackColor = Color.Transparent;
        openNow.Visible = false;
        content.Controls.Add(openNow);

        primaryButton = new Button();
        primaryButton.Text = "Aceitar e continuar";
        primaryButton.Width = 180;
        primaryButton.Height = 40;
        primaryButton.Location = new Point(42, 500);
        primaryButton.FlatStyle = FlatStyle.Flat;
        primaryButton.FlatAppearance.BorderSize = 0;
        primaryButton.Font = new Font("Segoe UI", 9, FontStyle.Bold);
        primaryButton.ForeColor = Color.White;
        primaryButton.Enabled = true;
        primaryButton.Click += delegate { PrimaryAction(); };
        content.Controls.Add(primaryButton);

        downloadFolder = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "MLUltimate", "Installer");
        ShowTermsStep();
    }

    private Label CreateStep(string text, int top, bool active)
    {
        var label = new Label();
        label.Text = text;
        label.AutoSize = false;
        label.Width = 146;
        label.Height = 36;
        label.Location = new Point(42, top);
        label.Font = new Font("Segoe UI", 9, FontStyle.Bold);
        label.TextAlign = ContentAlignment.MiddleCenter;
        label.BorderStyle = BorderStyle.FixedSingle;
        label.BackColor = active ? Color.FromArgb(22, 101, 52) : Color.FromArgb(15, 23, 42);
        label.ForeColor = active ? Color.FromArgb(226, 232, 240) : Color.FromArgb(148, 163, 184);
        return label;
    }

    private void SetStep(Label label, bool active, bool done)
    {
        label.BackColor = done
            ? Color.FromArgb(20, 83, 45)
            : active
                ? Color.FromArgb(30, 41, 59)
                : Color.FromArgb(15, 23, 42);
        label.ForeColor = done
            ? Color.FromArgb(187, 247, 208)
            : active
                ? Color.White
                : Color.FromArgb(148, 163, 184);
    }

    private void StylePrimaryButton()
    {
        primaryButton.BackColor = acceptTerms.Checked || stage != 0
            ? Color.FromArgb(34, 197, 94)
            : Color.FromArgb(51, 65, 85);
        primaryButton.ForeColor = acceptTerms.Checked || stage != 0
            ? Color.FromArgb(3, 20, 12)
            : Color.FromArgb(203, 213, 225);
    }

    private static Image LoadImage(string name)
    {
        var stream = Assembly.GetExecutingAssembly().GetManifestResourceStream(name);
        return stream == null ? null : Image.FromStream(stream);
    }

    private void ShowTermsStep()
    {
        title.Text = "Termos de uso";
        subtitle.Text = "Antes de baixar, confirme que voce aceita os termos do instalador oficial do MLUltimate.";
        SetStep(step1, true, false);
        SetStep(step2, false, false);
        SetStep(step3, false, false);
        termsBox.Visible = true;
        termsBox.SelectionStart = 0;
        termsBox.SelectionLength = 0;
        acceptTerms.Visible = true;
        folderText.Visible = false;
        secondaryButton.Visible = false;
        progress.Visible = false;
        desktopShortcut.Visible = false;
        openNow.Visible = false;
        status.Text = "";
        primaryButton.Text = "Aceitar e continuar";
        stage = 0;
        StylePrimaryButton();
    }

    private void ShowFolderStep()
    {
        title.Text = "Escolha onde baixar";
        subtitle.Text = "Escolha a pasta onde o instalador temporario sera baixado antes da instalacao.";
        SetStep(step1, false, true);
        SetStep(step2, true, false);
        SetStep(step3, false, false);
        termsBox.Visible = false;
        acceptTerms.Visible = false;
        folderText.Visible = true;
        secondaryButton.Visible = true;
        progress.Visible = false;
        desktopShortcut.Visible = false;
        openNow.Visible = false;
        folderText.Text = downloadFolder;
        status.Text = "A pasta pode ser apagada depois que a instalacao terminar.";
        primaryButton.Text = "Baixar e instalar";
        primaryButton.Enabled = true;
        stage = 1;
        StylePrimaryButton();
    }

    private void BrowseFolder()
    {
        using (var dialog = new FolderBrowserDialog())
        {
            dialog.Description = "Escolha onde baixar o instalador do MLUltimate";
            dialog.SelectedPath = folderText.Text;
            if (dialog.ShowDialog(this) == DialogResult.OK)
            {
                folderText.Text = dialog.SelectedPath;
            }
        }
    }

    private void StartInstall()
    {
        try
        {
            primaryButton.Enabled = false;
            secondaryButton.Visible = false;
            folderText.Visible = false;
            progress.Visible = true;
            status.Text = "Conectando ao GitHub oficial...";
            stage = 2;
            StylePrimaryButton();
            var target = FindLatestInstaller();
            if (String.IsNullOrWhiteSpace(target.TagName) || String.IsNullOrWhiteSpace(target.DownloadUrl))
            {
                throw new InvalidOperationException("Nenhum instalador Windows foi encontrado no GitHub.");
            }

            progress.Value = 12;
            status.Text = "Baixando MLUltimate Launcher " + target.TagName + "...";
            SetStep(step1, false, true);
            SetStep(step2, false, true);
            SetStep(step3, true, false);

            var safeTag = Regex.Replace(target.TagName, "[^A-Za-z0-9_.-]", "_");
            downloadFolder = String.IsNullOrWhiteSpace(folderText.Text) ? downloadFolder : folderText.Text;
            Directory.CreateDirectory(downloadFolder);
            var downloadPath = Path.Combine(downloadFolder, "MLUltimate-" + safeTag + "-Setup.exe");

            using (var client = CreateClient())
            {
                client.DownloadProgressChanged += delegate(object sender, DownloadProgressChangedEventArgs args)
                {
                    var value = Math.Min(94, Math.Max(14, args.ProgressPercentage));
                    progress.Value = value;
                    status.Text = "Baixando arquivos do launcher... " + args.ProgressPercentage + "%";
                };
                var finished = new System.Threading.ManualResetEvent(false);
                Exception downloadError = null;
                client.DownloadFileCompleted += delegate(object sender, System.ComponentModel.AsyncCompletedEventArgs args)
                {
                    downloadError = args.Error;
                    finished.Set();
                };
                client.DownloadFileAsync(new Uri(target.DownloadUrl), downloadPath);
                while (!finished.WaitOne(80))
                {
                    Application.DoEvents();
                }
                if (downloadError != null)
                {
                    throw downloadError;
                }
            }

            progress.Value = 96;
            status.Text = "Instalando no Windows...";
            SetStep(step1, false, true);
            SetStep(step2, false, true);
            SetStep(step3, true, false);

            var process = Process.Start(new ProcessStartInfo(downloadPath, "/S") { UseShellExecute = true });
            if (process != null)
            {
                process.WaitForExit();
            }

            progress.Value = 100;
            status.Text = "Instalacao concluida. Escolha como finalizar.";
            SetStep(step3, false, true);
            ShowFinalStep();
        }
        catch (Exception error)
        {
            progress.Value = 100;
            status.Text = "Nao foi possivel instalar: " + error.Message;
            primaryButton.Text = "Fechar";
            primaryButton.Enabled = true;
            stage = 4;
            StylePrimaryButton();
        }
    }

    private void ShowFinalStep()
    {
        title.Text = "Tudo pronto";
        subtitle.Text = "O launcher foi instalado. Voce pode criar um atalho e abrir o app agora.";
        SetStep(step1, false, true);
        SetStep(step2, false, true);
        SetStep(step3, false, true);
        progress.Visible = false;
        desktopShortcut.Visible = true;
        openNow.Visible = true;
        primaryButton.Text = "Concluir";
        primaryButton.Enabled = true;
        stage = 3;
        StylePrimaryButton();
    }

    private void PrimaryAction()
    {
        if (stage == 0)
        {
            if (!acceptTerms.Checked)
            {
                status.ForeColor = Color.FromArgb(252, 211, 77);
                status.Text = "Marque a opcao de aceite para continuar.";
                return;
            }
            status.ForeColor = Color.FromArgb(203, 213, 225);
            ShowFolderStep();
        }
        else if (stage == 1)
        {
            StartInstall();
        }
        else if (stage == 3)
        {
            FinishInstall();
        }
        else if (stage == 4)
        {
            Close();
        }
    }

    private void FinishInstall()
    {
        var appPath = FindInstalledApp();
        if (desktopShortcut.Checked && !String.IsNullOrWhiteSpace(appPath))
        {
            CreateDesktopShortcut(appPath);
        }
        if (!desktopShortcut.Checked)
        {
            RemoveDesktopShortcut();
        }
        if (openNow.Checked && !String.IsNullOrWhiteSpace(appPath))
        {
            Process.Start(new ProcessStartInfo(appPath) { UseShellExecute = true });
        }
        Close();
    }

    private static string TermsText()
    {
        return "Termos do MLUltimate Launcher\\r\\n\\r\\n" +
            "1. Este instalador oficial baixa arquivos somente das releases publicas do repositorio GuelBDev/MLUltimate no GitHub.\\r\\n" +
            "2. O launcher e fornecido como esta, sem garantia de disponibilidade continua dos servicos externos.\\r\\n" +
            "3. O usuario e responsavel por usar contas, mods, modpacks e servidores conforme as regras dos respectivos donos.\\r\\n" +
            "4. O instalador pode criar atalhos locais e baixar o pacote mais recente necessario para instalar o launcher.\\r\\n" +
            "5. Ao continuar, voce autoriza o download e a instalacao do MLUltimate Launcher neste computador.";
    }

    private static string FindInstalledApp()
    {
        var names = new[] { "MLUltimate Launcher.exe", "mlultimate-launcher.exe" };
        var roots = new[]
        {
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs"),
            Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),
            Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86)
        };
        foreach (var root in roots)
        {
            if (String.IsNullOrWhiteSpace(root) || !Directory.Exists(root)) continue;
            foreach (var name in names)
            {
                var files = Directory.GetFiles(root, name, SearchOption.AllDirectories);
                if (files.Length > 0) return files[0];
            }
        }
        return null;
    }

    private static void CreateDesktopShortcut(string appPath)
    {
        var desktop = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
        var shortcutPath = Path.Combine(desktop, "MLUltimate Launcher.lnk");
        var shellType = Type.GetTypeFromProgID("WScript.Shell");
        dynamic shell = Activator.CreateInstance(shellType);
        dynamic shortcut = shell.CreateShortcut(shortcutPath);
        shortcut.TargetPath = appPath;
        shortcut.WorkingDirectory = Path.GetDirectoryName(appPath);
        shortcut.IconLocation = appPath;
        shortcut.Save();
    }

    private static void RemoveDesktopShortcut()
    {
        var desktop = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
        var shortcutPath = Path.Combine(desktop, "MLUltimate Launcher.lnk");
        if (File.Exists(shortcutPath))
        {
            File.Delete(shortcutPath);
        }
    }

    private static ReleaseTarget FindLatestInstaller()
    {
        try
        {
            var json = CreateClient().DownloadString(ApiUrl);
            var asset = Regex.Match(json, @"""browser_download_url""\\s*:\\s*""([^""]*/releases/download/([^/""]+)/MLUltimate-Launcher-[^""]*-win-x64\\.exe)""");
            if (asset.Success)
            {
                return new ReleaseTarget(asset.Groups[2].Value, asset.Groups[1].Value.Replace(@"\\/", "/"));
            }
        }
        catch
        {
        }

        var xml = CreateClient().DownloadString(AtomUrl);
        var href = Regex.Match(xml, @"<link[^>]+rel=""alternate""[^>]+href=""([^""]+)""");
        if (!href.Success)
        {
            return new ReleaseTarget(null, null);
        }

        var tag = Uri.UnescapeDataString(WebUtility.HtmlDecode(href.Groups[1].Value).Split('/')[WebUtility.HtmlDecode(href.Groups[1].Value).Split('/').Length - 1]);
        var version = Regex.Replace(tag, "^v", "");
        return new ReleaseTarget(tag, DownloadBase + "/" + tag + "/MLUltimate-Launcher-" + version + "-win-x64.exe");
    }

    private static WebClient CreateClient()
    {
        var client = new WebClient();
        client.Headers.Add("Accept", "application/vnd.github+json");
        client.Headers.Add("User-Agent", "MLUltimate-Installer");
        return client;
    }

    private struct ReleaseTarget
    {
        public readonly string TagName;
        public readonly string DownloadUrl;

        public ReleaseTarget(string tagName, string downloadUrl)
        {
            TagName = tagName;
            DownloadUrl = downloadUrl;
        }
    }
}
`,
);

writeFileSync(
  linuxOutputPath,
  `#!/usr/bin/env bash
set -euo pipefail

repo="GuelBDev/MLUltimate"
api="https://api.github.com/repos/$repo/releases"
atom="https://github.com/$repo/releases.atom"
download_base="https://github.com/$repo/releases/download"
icon_url="https://raw.githubusercontent.com/$repo/main/src/assets/mlultimate-icon.png"
install_dir="\${XDG_DATA_HOME:-$HOME/.local/share}/MLUltimate"
bin_dir="\${XDG_BIN_HOME:-$HOME/.local/bin}"
desktop_dir="\${XDG_DATA_HOME:-$HOME/.local/share}/applications"
desktop_shortcut_dir="\${XDG_DESKTOP_DIR:-$HOME/Desktop}"
appimage_path="$install_dir/MLUltimate-Launcher.AppImage"
icon_path="$install_dir/mlultimate-icon.png"
desktop_file="$desktop_dir/mlultimate-launcher.desktop"
desktop_shortcut_file="$desktop_shortcut_dir/MLUltimate Launcher.desktop"
green=""
blue=""
yellow=""
red=""
muted=""
bold=""
reset=""

if [[ -t 1 ]]; then
  green="$(printf '\\033[32m')"
  blue="$(printf '\\033[36m')"
  yellow="$(printf '\\033[33m')"
  red="$(printf '\\033[31m')"
  muted="$(printf '\\033[90m')"
  bold="$(printf '\\033[1m')"
  reset="$(printf '\\033[0m')"
fi

have() {
  command -v "$1" >/dev/null 2>&1
}

header() {
  clear 2>/dev/null || true
  printf '%s\\n' "\${blue}============================================================\${reset}"
  printf '%s\\n' "\${bold}MLUltimate Launcher Setup\${reset}"
  printf '%s\\n' "\${muted}Instalador oficial para Linux 64-bit\${reset}"
  printf '%s\\n' "\${blue}============================================================\${reset}"
  printf '\\n'
}

step() {
  printf '%s\\n' "\${blue}>\${reset} $1"
}

ok() {
  printf '%s\\n' "\${green}OK\${reset} $1"
}

warn() {
  printf '%s\\n' "\${yellow}!\${reset} $1"
}

die() {
  printf '%s\\n' "\${red}Erro:\${reset} $1" >&2
  if have zenity; then
    zenity --error --title="MLUltimate Launcher Setup" --text="$1" >/dev/null 2>&1 || true
  elif have kdialog; then
    kdialog --error "$1" --title "MLUltimate Launcher Setup" >/dev/null 2>&1 || true
  fi
  exit 1
}

success_message() {
  local message="MLUltimate Launcher instalado com sucesso."
  if have zenity; then
    zenity --info --title="MLUltimate Launcher Setup" --text="$message\\n\\nArquivo: $appimage_path" >/dev/null 2>&1 || true
  elif have kdialog; then
    kdialog --msgbox "$message\\n\\nArquivo: $appimage_path" --title "MLUltimate Launcher Setup" >/dev/null 2>&1 || true
  fi
}

terms_text() {
  cat <<'EOF'
Termos do MLUltimate Launcher

1. Este instalador oficial baixa arquivos somente das releases publicas do repositorio GuelBDev/MLUltimate no GitHub.
2. O launcher e fornecido como esta, sem garantia de disponibilidade continua dos servicos externos.
3. O usuario e responsavel por usar contas, mods, modpacks e servidores conforme as regras dos respectivos donos.
4. O instalador pode criar atalhos locais e baixar o pacote mais recente necessario para instalar o launcher.
5. Ao continuar, voce autoriza o download e a instalacao do MLUltimate Launcher neste computador.
EOF
}

ask_yes_no() {
  local prompt="$1"
  local default_answer="\${2:-s}"
  local answer=""
  local suffix="[s/N]"
  if [[ "$default_answer" == "s" ]]; then
    suffix="[S/n]"
  fi

  if [[ ! -t 0 ]]; then
    [[ "$default_answer" == "s" ]]
    return
  fi

  while true; do
    read -r -p "$prompt $suffix " answer
    answer="\${answer:-$default_answer}"
    case "$answer" in
      s|S|sim|SIM|y|Y|yes|YES) return 0 ;;
      n|N|nao|NAO|não|NÃO|no|NO) return 1 ;;
      *) warn "Responda com s ou n." ;;
    esac
  done
}

choose_install_dir() {
  local chosen=""
  step "Escolha onde o launcher sera baixado/instalado"
  printf '%s\\n' "Pasta padrao: $install_dir"

  if [[ -t 0 ]]; then
    read -r -p "Digite outra pasta ou pressione Enter para manter a padrao: " chosen
  fi

  if [[ -n "$chosen" ]]; then
    install_dir="\${chosen/#\\~/$HOME}"
  fi

  appimage_path="$install_dir/MLUltimate-Launcher.AppImage"
  icon_path="$install_dir/mlultimate-icon.png"
  ok "Pasta escolhida: $install_dir"
}

fetch() {
  local url="$1"
  if have curl; then
    curl -fsSL -H "User-Agent: MLUltimate-Linux-Installer" "$url"
  elif have wget; then
    wget -qO- --user-agent="MLUltimate-Linux-Installer" "$url"
  else
    die "curl ou wget e necessario para baixar o launcher."
  fi
}

download_file() {
  local url="$1"
  local destination="$2"
  if have curl; then
    curl -fL --progress-bar -H "User-Agent: MLUltimate-Linux-Installer" -o "$destination" "$url"
  elif have wget; then
    wget --show-progress --user-agent="MLUltimate-Linux-Installer" -O "$destination" "$url"
  else
    die "curl ou wget e necessario para baixar o launcher."
  fi
}

latest_from_api() {
  fetch "$api" | node -e '
let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", chunk => input += chunk);
process.stdin.on("end", () => {
  const releases = JSON.parse(input);
  for (const release of releases) {
    if (release.draft) continue;
    const asset = (release.assets || []).find(item =>
      /MLUltimate-Launcher-.+-linux-x64\\.AppImage$/.test(item.name)
    );
    if (asset) {
      console.log([release.tag_name, asset.browser_download_url].join("\\t"));
      return;
    }
  }
  process.exit(1);
});
'
}

latest_from_atom() {
  local href tag version asset
  href="$(fetch "$atom" | grep -m 1 -Eo 'href="https://github.com/[^"]+/releases/tag/[^"]+"' | sed 's/^href="//; s/"$//; s/&amp;/\\&/g')"
  if [[ -z "$href" ]]; then
    return 1
  fi
  tag="\${href##*/}"
  version="\${tag#v}"
  asset="MLUltimate-Launcher-$version-linux-x64.AppImage"
  printf '%s\\t%s\\n' "$tag" "$download_base/$tag/$asset"
}

header
step "Termos de uso"
terms_text
printf '\\n'
if ! ask_yes_no "Voce aceita os termos para continuar?" "n"; then
  die "Voce precisa aceitar os termos para instalar o MLUltimate Launcher."
fi
ok "Termos aceitos"

choose_install_dir

step "Verificando ferramentas do sistema"

if ! have curl && ! have wget; then
  die "Instale curl ou wget e tente novamente."
fi

if ! have node; then
  warn "Node.js nao foi encontrado. Usando o feed publico do GitHub como fallback."
fi

target=""
step "Consultando a release oficial mais recente"
if have node; then
  target="$(latest_from_api 2>/dev/null || true)"
fi
if [[ -z "$target" ]]; then
  target="$(latest_from_atom 2>/dev/null || true)"
fi
if [[ -z "$target" ]]; then
  die "Nao foi possivel encontrar o AppImage Linux mais recente no GitHub."
fi

tag="\${target%%$'\\t'*}"
download_url="\${target#*$'\\t'}"
tmp_file="$(mktemp "\${TMPDIR:-/tmp}/mlultimate-$tag-XXXXXX.AppImage")"
trap 'rm -f "$tmp_file"' EXIT

ok "Release encontrada: $tag"
step "Baixando MLUltimate Launcher $tag"
download_file "$download_url" "$tmp_file"

step "Instalando no seu usuario"
mkdir -p "$install_dir" "$bin_dir" "$desktop_dir"
mv "$tmp_file" "$appimage_path"
chmod +x "$appimage_path"

if fetch "$icon_url" > "$icon_path.tmp" 2>/dev/null; then
  mv "$icon_path.tmp" "$icon_path"
else
  rm -f "$icon_path.tmp"
  warn "Nao foi possivel baixar o icone do menu. O launcher ainda foi instalado."
fi

cat > "$bin_dir/mlultimate-launcher" <<EOF
#!/usr/bin/env bash
exec "$appimage_path" "\\$@"
EOF
chmod +x "$bin_dir/mlultimate-launcher"

cat > "$desktop_file" <<EOF
[Desktop Entry]
Type=Application
Name=MLUltimate Launcher
Comment=Minecraft launcher
Exec=$appimage_path
Icon=$icon_path
Terminal=false
Categories=Game;
EOF

if ask_yes_no "Deseja criar um atalho na area de trabalho?" "s"; then
  mkdir -p "$desktop_shortcut_dir"
  cp "$desktop_file" "$desktop_shortcut_file"
  chmod +x "$desktop_shortcut_file"
  ok "Atalho criado em: $desktop_shortcut_file"
else
  rm -f "$desktop_shortcut_file"
  warn "Atalho da area de trabalho ignorado."
fi

if have update-desktop-database; then
  update-desktop-database "$desktop_dir" >/dev/null 2>&1 || true
fi

ok "MLUltimate Launcher instalado em: $appimage_path"
ok "Comando criado em: $bin_dir/mlultimate-launcher"
ok "Atalho criado no menu de aplicativos"
printf '\\n%s\\n' "\${bold}Para abrir agora:\${reset} $appimage_path"
success_message
if ask_yes_no "Deseja abrir o MLUltimate agora?" "s"; then
  "$appimage_path" >/dev/null 2>&1 &
fi
`,
);
chmodSync(linuxOutputPath, 0o755);
console.log(`Linux online installer created: ${linuxOutputPath}`);

writeFileSync(
  downloadPagePath,
  `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Baixar MLUltimate Launcher</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #0e1117;
        --panel: #171d26;
        --panel-strong: #202837;
        --text: #f8fafc;
        --muted: #b8c1d1;
        --line: rgba(255, 255, 255, 0.14);
        --green: #22c55e;
        --green-dark: #15803d;
        --blue: #38bdf8;
        --amber: #f59e0b;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        min-height: 100vh;
        background: var(--bg);
        color: var(--text);
        font-family:
          Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
          "Segoe UI", sans-serif;
      }

      .shell {
        min-height: 100vh;
        background:
          linear-gradient(90deg, rgba(14, 17, 23, 0.98), rgba(14, 17, 23, 0.74)),
          url("./mlultimate-download-hero.png") center / cover;
        display: flex;
        align-items: center;
        padding: 40px 20px;
      }

      .content {
        width: min(100%, 1040px);
        margin: 0 auto;
        display: grid;
        grid-template-columns: minmax(0, 1fr) 360px;
        gap: 36px;
        align-items: center;
      }

      .brand {
        display: flex;
        align-items: center;
        gap: 14px;
        margin-bottom: 32px;
      }

      .brand img {
        width: 58px;
        height: 58px;
        border-radius: 14px;
      }

      .brand-name {
        font-size: 17px;
        font-weight: 800;
      }

      h1 {
        margin: 0;
        max-width: 760px;
        font-size: clamp(38px, 7vw, 76px);
        line-height: 0.96;
        letter-spacing: 0;
      }

      .lead {
        max-width: 640px;
        margin: 24px 0 0;
        color: var(--muted);
        font-size: 18px;
        line-height: 1.6;
      }

      .trust {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-top: 28px;
      }

      .trust span {
        border: 1px solid var(--line);
        background: rgba(14, 17, 23, 0.62);
        border-radius: 999px;
        padding: 9px 12px;
        color: #dbeafe;
        font-size: 13px;
        font-weight: 700;
      }

      .panel {
        border: 1px solid var(--line);
        background: rgba(23, 29, 38, 0.94);
        border-radius: 8px;
        padding: 22px;
        box-shadow: 0 24px 70px rgba(0, 0, 0, 0.35);
      }

      .panel h2 {
        margin: 0 0 16px;
        font-size: 19px;
      }

      .download {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        min-height: 74px;
        border: 1px solid var(--line);
        background: var(--panel-strong);
        border-radius: 8px;
        padding: 14px;
        color: inherit;
        text-decoration: none;
        transition:
          transform 160ms ease,
          border-color 160ms ease,
          background 160ms ease;
      }

      .download + .download {
        margin-top: 12px;
      }

      .download:hover {
        transform: translateY(-1px);
        border-color: rgba(56, 189, 248, 0.66);
        background: #263247;
      }

      .download strong {
        display: block;
        margin-bottom: 4px;
        font-size: 15px;
      }

      .download small {
        display: block;
        color: var(--muted);
        font-size: 12px;
        line-height: 1.35;
      }

      .button {
        flex: 0 0 auto;
        min-width: 96px;
        border-radius: 8px;
        background: var(--green);
        color: #04130a;
        padding: 11px 13px;
        font-size: 13px;
        font-weight: 900;
        text-align: center;
      }

      .download:hover .button {
        background: #4ade80;
      }

      .note {
        margin: 16px 0 0;
        border-left: 3px solid var(--amber);
        padding-left: 12px;
        color: var(--muted);
        font-size: 13px;
        line-height: 1.5;
      }

      .direct {
        margin-top: 18px;
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
      }

      .direct a {
        color: var(--blue);
        font-size: 13px;
        font-weight: 700;
      }

      @media (max-width: 860px) {
        .shell {
          align-items: flex-start;
          padding: 26px 16px;
        }

        .content {
          grid-template-columns: 1fr;
          gap: 28px;
        }

        .brand {
          margin-bottom: 24px;
        }

        .panel {
          padding: 16px;
        }
      }
    </style>
  </head>
  <body>
    <main class="shell">
      <section class="content" aria-label="Download do MLUltimate Launcher">
        <div>
          <div class="brand">
            <img src="./mlultimate-download-logo.png" alt="MLUltimate" />
            <div>
              <div class="brand-name">MLUltimate Launcher</div>
              <div>Instalador oficial</div>
            </div>
          </div>

          <h1>Baixe o launcher oficial.</h1>
          <p class="lead">
            Use estes instaladores fixos no site. Eles buscam automaticamente a
            versao mais recente publicada no GitHub, entao voce nao precisa trocar
            os links a cada atualizacao.
          </p>

          <div class="trust" aria-label="Garantias">
            <span>Release oficial do GitHub</span>
            <span>Windows e Linux 64-bit</span>
            <span>Instalador sempre atualizado</span>
          </div>
        </div>

        <aside class="panel" aria-label="Escolha seu sistema">
          <h2>Escolha seu sistema</h2>

          <a class="download" href="./MLUltimate-Installer-Windows.exe" download>
            <span>
              <strong>Windows</strong>
              <small>Baixa e instala a versao mais recente automaticamente.</small>
            </span>
            <span class="button">Baixar</span>
          </a>

          <a class="download" href="./MLUltimate-Installer-Linux.sh" download>
            <span>
              <strong>Linux</strong>
              <small>Instala o AppImage mais recente no seu usuario.</small>
            </span>
            <span class="button">Baixar</span>
          </a>

          <p class="note">
            No Linux, depois do download, execute:
            <br />
            <strong>chmod +x MLUltimate-Installer-Linux.sh && ./MLUltimate-Installer-Linux.sh</strong>
          </p>

          <div class="direct">
            <a href="https://github.com/GuelBDev/MLUltimate/releases" rel="noreferrer">
              Ver releases
            </a>
          </div>
        </aside>
      </section>
    </main>
  </body>
</html>
`,
);
console.log(`Download page created: ${downloadPagePath}`);

if (process.platform !== "win32") {
  console.log("Online installer packaging skipped outside Windows.");
  process.exit(0);
}

const iexpress = path.join(process.env.SystemRoot ?? "C:\\Windows", "System32", "iexpress.exe");
const csc = findCsc();

if (csc) {
  execFileSync(
    csc,
    [
      "/nologo",
      "/target:winexe",
      `/out:${outputPath}`,
      `/win32icon:${path.join(root, "build", "icon.ico")}`,
      "/reference:System.dll",
      "/reference:System.Drawing.dll",
      "/reference:System.Windows.Forms.dll",
      `/resource:${heroPath},launcher-hero.png`,
      `/resource:${iconPath},mlultimate-icon.png`,
      csharpPath,
    ],
    { stdio: "inherit" },
  );
} else {
  if (!existsSync(iexpress)) {
    throw new Error("Neither csc.exe nor iexpress.exe was found. Cannot build Windows online installer.");
  }

  execFileSync(iexpress, ["/N", "/Q", sedPath], { stdio: "inherit" });
}

if (!existsSync(outputPath)) {
  throw new Error(`Online installer was not created at ${outputPath}`);
}

const rcedit = path.join(root, "node_modules", "electron-winstaller", "vendor", "rcedit.exe");
if (!csc && existsSync(rcedit)) {
  execFileSync(
    rcedit,
    [
      outputPath,
      "--set-icon",
      path.join(root, "build", "icon.ico"),
      "--set-version-string",
      "CompanyName",
      "MLUltimate",
      "--set-version-string",
      "FileDescription",
      "MLUltimate Launcher Setup",
      "--set-version-string",
      "ProductName",
      "MLUltimate Launcher",
      "--set-version-string",
      "OriginalFilename",
      "MLUltimate-Installer-Windows.exe",
    ],
    {
      stdio: "inherit",
    },
  );
}

console.log(`Online installer created: ${outputPath}`);

copyFileSync(outputPath, windowsSiteOutputPath);
console.log(`Windows site installer created: ${windowsSiteOutputPath}`);

function findCsc() {
  const systemRoot = process.env.SystemRoot ?? "C:\\Windows";
  const candidates = [
    path.join(systemRoot, "Microsoft.NET", "Framework64", "v4.0.30319", "csc.exe"),
    path.join(systemRoot, "Microsoft.NET", "Framework", "v4.0.30319", "csc.exe"),
  ];

  return candidates.find((candidate) => existsSync(candidate));
}

function toAssemblyVersion(version) {
  const parts = String(version)
    .split(/[^0-9]+/)
    .filter(Boolean)
    .slice(0, 4);

  while (parts.length < 4) {
    parts.push("0");
  }

  return parts.join(".");
}

