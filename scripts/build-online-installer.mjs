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
const manifestPath = path.join(workDir, "app.manifest");
const csharpPath = path.join(workDir, "MLUltimateInstaller.cs");
const outputPath = path.join(releaseDir, "MLUltimate Installer.exe");
const windowsSiteOutputPath = path.join(releaseDir, "MLUltimate-Installer-Windows.exe");
const linuxOutputPath = path.join(releaseDir, "MLUltimate-Installer-Linux.sh");
const downloadPagePath = path.join(releaseDir, "download.html");
const downloadLogoPath = path.join(releaseDir, "mlultimate-download-logo.png");
const downloadHeroPath = path.join(releaseDir, "mlultimate-download-hero.png");
const packageJson = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
const assemblyVersion = toAssemblyVersion(packageJson.version);

const args = process.argv.slice(2);
const buildWin = args.includes("--win") || args.length === 0;
const buildLinux = args.includes("--linux") || args.length === 0;

if (buildWin) {
  mkdirSync(workDir, { recursive: true });
}

copyFileSync(path.join(root, "src/assets/mlultimate-icon.png"), downloadLogoPath);
copyFileSync(path.join(root, "src/assets/launcher-hero.png"), downloadHeroPath);

if (buildWin) {
writeFileSync(
  manifestPath,
  `<?xml version="1.0" encoding="utf-8"?>
<assembly manifestVersion="1.0" xmlns="urn:schemas-microsoft-com:asm.v1">
  <assemblyIdentity version="${assemblyVersion}" name="MLUltimate.Launcher.Setup" type="win32" processorArchitecture="*" />
  <trustInfo xmlns="urn:schemas-microsoft-com:asm.v2">
    <security>
      <requestedPrivileges xmlns="urn:schemas-microsoft-com:asm.v3">
        <requestedExecutionLevel level="asInvoker" uiAccess="false" />
      </requestedPrivileges>
    </security>
  </trustInfo>
  <compatibility xmlns="urn:schemas-microsoft-com:compatibility.v1">
    <application>
      <!-- Windows 10 and Windows 11 -->
      <supportedOS Id="{8e0f7a12-bfb3-4fe8-b9a5-48fd50a15a9a}" />
      <!-- Windows 8.1 -->
      <supportedOS Id="{1f676c76-80e1-4239-95bb-83d0f6d0da78}" />
      <!-- Windows 8 -->
      <supportedOS Id="{4a2f28e3-53b9-4441-ba9c-d69d4a4a6e38}" />
      <!-- Windows 7 -->
      <supportedOS Id="{35138b9a-5d96-4fbd-8e2d-a2440225f93a}" />
    </application>
  </compatibility>
</assembly>
`
);

writeFileSync(
  csharpPath,
  `using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Reflection;
using System.Windows.Forms;

[assembly: AssemblyTitle("MLUltimate Launcher Setup")]
[assembly: AssemblyDescription("Instalador oficial do MLUltimate Launcher")]
[assembly: AssemblyCompany("MLUltimate Team")]
[assembly: AssemblyProduct("MLUltimate Launcher")]
[assembly: AssemblyCopyright("Copyright © MLUltimate Team")]
[assembly: AssemblyTrademark("MLUltimate")]
[assembly: AssemblyVersion("${assemblyVersion}")]
[assembly: AssemblyFileVersion("${assemblyVersion}")]
[assembly: System.Runtime.InteropServices.Guid("6B1D2A4C-9F3E-4B7D-8C2A-1E3F5A7B9C0D")]

internal static class Program
{
    [STAThread]
    private static void Main()
    {
        try
        {
            ServicePointManager.SecurityProtocol = (SecurityProtocolType)3072 | SecurityProtocolType.Tls12 | SecurityProtocolType.Tls11 | SecurityProtocolType.Tls;
        }
        catch
        {
            try { ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls12; } catch {}
        }

        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        Application.Run(new SetupForm());
    }
}

internal sealed class SetupForm : Form
{
    private const string AppTitle = "MLUltimate Launcher";
    private const string PublisherName = "MLUltimate Team";
    private const string CurrentVersion = "${packageJson.version}";
    private const string DownloadBase = "https://github.com/GuelBDev/MLUltimate/releases/download";

    private readonly PictureBox iconBox;
    private readonly Label titleLabel;
    private readonly Label publisherLabel;
    private readonly Panel headerSeparator;
    private readonly Label infoLabel;
    private readonly Label statusLabel;
    private readonly ProgressBar progressBar;
    private readonly Panel footerSeparator;
    private readonly Button btnInstall;
    private readonly Button btnCancel;

    private WebClient downloadClient;
    private string targetDownloadUrl;
    private string tempSetupPath;
    private bool isInstalling;

    public SetupForm()
    {
        Text = "Instalação do " + AppTitle;
        StartPosition = FormStartPosition.CenterScreen;
        FormBorderStyle = FormBorderStyle.FixedDialog;
        MaximizeBox = false;
        MinimizeBox = true;
        ClientSize = new Size(500, 240);
        Font = new Font("Segoe UI", 9f, FontStyle.Regular);
        BackColor = SystemColors.Control;
        ForeColor = SystemColors.ControlText;

        try
        {
            Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
            ShowIcon = true;
        }
        catch {}

        iconBox = new PictureBox
        {
            Location = new Point(20, 16),
            Size = new Size(40, 40),
            SizeMode = PictureBoxSizeMode.CenterImage
        };
        try
        {
            if (Icon != null)
            {
                iconBox.Image = new Icon(Icon, new Size(36, 36)).ToBitmap();
            }
        }
        catch {}

        titleLabel = new Label
        {
            Location = new Point(72, 14),
            Size = new Size(410, 24),
            Text = "Assistente de Instalação do " + AppTitle,
            Font = new Font("Segoe UI", 11f, FontStyle.Bold),
            ForeColor = SystemColors.ControlText
        };

        publisherLabel = new Label
        {
            Location = new Point(72, 38),
            Size = new Size(410, 18),
            Text = "Fornecedor: " + PublisherName + "   |   Versão: " + CurrentVersion,
            Font = new Font("Segoe UI", 8.5f, FontStyle.Regular),
            ForeColor = SystemColors.GrayText
        };

        headerSeparator = new Panel
        {
            Location = new Point(0, 68),
            Size = new Size(500, 1),
            BackColor = SystemColors.ControlDark
        };

        infoLabel = new Label
        {
            Location = new Point(22, 82),
            Size = new Size(456, 36),
            Text = "Este assistente instalará a versão oficial do " + AppTitle + " para Windows em seu computador.",
            ForeColor = SystemColors.ControlText
        };

        statusLabel = new Label
        {
            Location = new Point(22, 122),
            Size = new Size(456, 18),
            Text = "Clique em 'Instalar' para iniciar a instalação padrão.",
            ForeColor = SystemColors.ControlText
        };

        progressBar = new ProgressBar
        {
            Location = new Point(22, 144),
            Size = new Size(456, 20),
            Minimum = 0,
            Maximum = 100,
            Value = 0,
            Visible = false
        };

        footerSeparator = new Panel
        {
            Location = new Point(0, 180),
            Size = new Size(500, 1),
            BackColor = SystemColors.ControlDark
        };

        btnInstall = new Button
        {
            Location = new Point(296, 194),
            Size = new Size(92, 28),
            Text = "Instalar",
            UseVisualStyleBackColor = true,
            TabIndex = 0
        };
        btnInstall.Click += BtnInstall_Click;

        btnCancel = new Button
        {
            Location = new Point(396, 194),
            Size = new Size(82, 28),
            Text = "Cancelar",
            UseVisualStyleBackColor = true,
            TabIndex = 1
        };
        btnCancel.Click += BtnCancel_Click;

        Controls.Add(iconBox);
        Controls.Add(titleLabel);
        Controls.Add(publisherLabel);
        Controls.Add(headerSeparator);
        Controls.Add(infoLabel);
        Controls.Add(statusLabel);
        Controls.Add(progressBar);
        Controls.Add(footerSeparator);
        Controls.Add(btnInstall);
        Controls.Add(btnCancel);

        AcceptButton = btnInstall;
        CancelButton = btnCancel;

        FormClosing += SetupForm_FormClosing;
    }

    private void BtnInstall_Click(object sender, EventArgs e)
    {
        if (isInstalling) return;

        isInstalling = true;
        btnInstall.Enabled = false;
        progressBar.Visible = true;
        progressBar.Value = 0;
        statusLabel.Text = "Verificando arquivos de instalação...";

        var localCandidate = FindLocalInstaller();
        if (!String.IsNullOrEmpty(localCandidate))
        {
            LaunchInstaller(localCandidate);
            return;
        }

        targetDownloadUrl = DownloadBase + "/v" + CurrentVersion + "/MLUltimate-Launcher-" + CurrentVersion + "-win-x64.exe";
        ResolveAndStartDownload();
    }

    private void ResolveAndStartDownload()
    {
        try
        {
            var tempDir = Path.Combine(Path.GetTempPath(), "MLUltimateSetup");
            Directory.CreateDirectory(tempDir);
            tempSetupPath = Path.Combine(tempDir, "MLUltimate-Launcher-" + CurrentVersion + "-Setup.exe");

            if (File.Exists(tempSetupPath))
            {
                try { File.Delete(tempSetupPath); } catch {}
            }

            statusLabel.Text = "Conectando ao GitHub oficial...";
            progressBar.Value = 5;

            downloadClient = new WebClient();
            downloadClient.Headers.Add("User-Agent", "MLUltimate-Setup");

            downloadClient.DownloadProgressChanged += delegate(object s, DownloadProgressChangedEventArgs args)
            {
                progressBar.Value = Math.Min(100, Math.Max(0, args.ProgressPercentage));
                if (args.TotalBytesToReceive > 0)
                {
                    double mbRec = args.BytesReceived / 1048576.0;
                    double mbTot = args.TotalBytesToReceive / 1048576.0;
                    statusLabel.Text = string.Format("Baixando instalador oficial: {0}% ({1:0.0} / {2:0.0} MB)", args.ProgressPercentage, mbRec, mbTot);
                }
                else
                {
                    statusLabel.Text = string.Format("Baixando instalador oficial: {0}%", args.ProgressPercentage);
                }
            };

            downloadClient.DownloadFileCompleted += delegate(object s, System.ComponentModel.AsyncCompletedEventArgs args)
            {
                if (args.Cancelled)
                {
                    isInstalling = false;
                    btnInstall.Enabled = true;
                    progressBar.Visible = false;
                    statusLabel.Text = "Instalação cancelada.";
                    return;
                }

                if (args.Error != null)
                {
                    isInstalling = false;
                    btnInstall.Enabled = true;
                    progressBar.Visible = false;
                    statusLabel.Text = "Erro ao baixar o instalador oficial.";
                    MessageBox.Show(this, "Não foi possível baixar o instalador oficial do MLUltimate Launcher:\\n\\n" + args.Error.Message + "\\n\\nPor favor, verifique sua conexão com a internet.", AppTitle, MessageBoxButtons.OK, MessageBoxIcon.Error);
                    return;
                }

                progressBar.Value = 100;
                statusLabel.Text = "Iniciando instalador padrão do Windows...";
                LaunchInstaller(tempSetupPath);
            };

            downloadClient.DownloadFileAsync(new Uri(targetDownloadUrl), tempSetupPath);
        }
        catch (Exception ex)
        {
            isInstalling = false;
            btnInstall.Enabled = true;
            progressBar.Visible = false;
            statusLabel.Text = "Erro ao iniciar download.";
            MessageBox.Show(this, "Erro: " + ex.Message, AppTitle, MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }

    private void LaunchInstaller(string setupPath)
    {
        try
        {
            var psi = new ProcessStartInfo(setupPath)
            {
                UseShellExecute = true
            };
            Process.Start(psi);
            Close();
        }
        catch (Exception ex)
        {
            isInstalling = false;
            btnInstall.Enabled = true;
            statusLabel.Text = "Erro ao executar o instalador.";
            MessageBox.Show(this, "Não foi possível iniciar o assistente de instalação:\\n" + ex.Message, AppTitle, MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }

    private static string FindLocalInstaller()
    {
        try
        {
            var appDir = AppDomain.CurrentDomain.BaseDirectory;
            var candidates = new[]
            {
                Path.Combine(appDir, "MLUltimate-Launcher-" + CurrentVersion + "-win-x64.exe"),
                Path.Combine(appDir, "..", "MLUltimate-Launcher-" + CurrentVersion + "-win-x64.exe")
            };
            foreach (var candidate in candidates)
            {
                if (File.Exists(candidate) && new FileInfo(candidate).Length > 10000000)
                {
                    return Path.GetFullPath(candidate);
                }
            }
        }
        catch {}
        return null;
    }

    private void BtnCancel_Click(object sender, EventArgs e)
    {
        Close();
    }

    private void SetupForm_FormClosing(object sender, FormClosingEventArgs e)
    {
        if (downloadClient != null && downloadClient.IsBusy)
        {
            try { downloadClient.CancelAsync(); } catch {}
        }
    }
}
`,
);
}

if (buildLinux) {
writeFileSync(
  linuxOutputPath,
  `#!/usr/bin/env bash
set -euo pipefail

repo="GuelBDev/MLUltimate"
api="https://api.github.com/repos/$repo/releases"
download_base="https://github.com/$repo/releases/download"
icon_url="https://raw.githubusercontent.com/$repo/main/src/assets/mlultimate-icon.png"
install_dir="\${XDG_DATA_HOME:-$HOME/.local/share}/MLUltimate"
bin_dir="\${XDG_BIN_HOME:-$HOME/.local/bin}"
desktop_dir="\${XDG_DATA_HOME:-$HOME/.local/share}/applications"
desktop_shortcut_dir="\${XDG_DESKTOP_DIR:-$HOME/Desktop}"
appimage_path="$install_dir/MLUltimate-Launcher.AppImage"
icon_path="$install_dir/mlultimate-icon.png"
wrapper_path="$bin_dir/mlultimate-launcher"
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
  printf '%s\\n' "\${blue}╭────────────────────────────────────────────────────────────╮\${reset}"
  printf '%s\\n' "\${blue}│\${reset} \${bold}MLUltimate Launcher Setup\${reset}                                  \${blue}│\${reset}"
  printf '%s\\n' "\${blue}│\${reset} \${muted}Instalador oficial para Linux 64-bit (Pop!_OS / Ubuntu / Debian)\${reset} \${blue}│\${reset}"
  printf '%s\\n' "\${blue}╰────────────────────────────────────────────────────────────╯\${reset}"
  printf '\\n'
}

step() {
  printf '\\n%s\\n' "\${blue}●\${reset} \${bold}$1\${reset}"
}

ok() {
  printf '%s\\n' "  \${green}✔\${reset} $1"
}

info() {
  printf '%s\\n' "  \${blue}ℹ\${reset} $1"
}

warn() {
  printf '%s\\n' "  \${yellow}!\${reset} $1"
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

terms_text() {
  cat <<'EOF'
Termos de Serviço do MLUltimate Launcher

1. Aceitação dos Termos: Ao baixar, instalar ou utilizar o MLUltimate Launcher ("Launcher"),
   você concorda integralmente com estes Termos de Serviço. Se não concordar, cancele.

2. Fornecimento do Serviço ("As-Is"): O Launcher é fornecido "no estado em que se encontra",
   sem garantias de qualquer natureza. Não garantimos disponibilidade contínua dos serviços.

3. Propriedade Intelectual: O Launcher facilita o download de mods. O usuário compromete-se
   a respeitar as licenças dos criadores originais (Minecraft/Mojang AB).

4. Privacidade e Contas: O uso de contas Microsoft/Xbox é feito exclusivamente através
   de autenticação oficial segura. O MLUltimate não intercepta nem armazena senhas.

5. Atualizações: O instalador efetua o download do pacote mais recente diretamente do
   repositório oficial no GitHub.

6. Limitação de Responsabilidade: Os desenvolvedores não serão responsáveis por perdas
   de dados, banimentos ou danos decorrentes do uso inadequado deste software.
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

fetch() {
  local url="$1"
  if have curl; then
    curl -fsSL -H "User-Agent: MLUltimate-Linux-Installer" "$url"
  elif have wget; then
    wget -qO- --user-agent="MLUltimate-Linux-Installer" "$url"
  else
    die "curl ou wget é necessário para baixar o launcher."
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
    die "curl ou wget é necessário para baixar o launcher."
  fi
}

resolve_releases_python() {
  python3 -c '
import sys, json

try:
    data = json.load(sys.stdin)
    if isinstance(data, dict) and "message" in data:
        sys.exit(1)
    if not isinstance(data, list):
        data = [data]
    for rel in data:
        if rel.get("draft"):
            continue
        tag = rel.get("tag_name", "")
        assets = rel.get("assets", [])
        appimage_url = ""
        deb_url = ""
        for a in assets:
            name = a.get("name", "")
            if name.endswith(".AppImage"):
                appimage_url = a.get("browser_download_url", "")
            elif name.endswith(".deb"):
                deb_url = a.get("browser_download_url", "")
        if appimage_url or deb_url:
            print(f"{tag}\\t{appimage_url}\\t{deb_url}")
            sys.exit(0)
    sys.exit(1)
except Exception:
    sys.exit(1)
'
}

resolve_releases_jq() {
  jq -r '.[] | select(.draft != true) | [.tag_name, ([.assets[] | select(.name | endswith(".AppImage")) | .browser_download_url][0] // ""), ([.assets[] | select(.name | endswith(".deb")) | .browser_download_url][0] // "")] | @tsv' | head -n 1
}

resolve_releases_node() {
  node -e '
let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", chunk => input += chunk);
process.stdin.on("end", () => {
  try {
    const releases = JSON.parse(input);
    const list = Array.isArray(releases) ? releases : [releases];
    for (const rel of list) {
      if (rel.draft) continue;
      const assets = rel.assets || [];
      const appimage = assets.find(a => a.name.endsWith(".AppImage"))?.browser_download_url || "";
      const deb = assets.find(a => a.name.endsWith(".deb"))?.browser_download_url || "";
      if (appimage || deb) {
        console.log([rel.tag_name, appimage, deb].join("\\t"));
        process.exit(0);
      }
    }
  } catch (e) {}
  process.exit(1);
});
'
}

resolve_releases_manifest() {
  local manifest_url="https://github.com/$repo/releases/latest/download/latest-linux.yml"
  local content
  content="$(fetch "$manifest_url" 2>/dev/null || true)"
  if [[ -n "$content" ]]; then
    local version appimage_name tag
    version="$(echo "$content" | grep -m 1 '^version:' | awk '{print $2}' | tr -d '\\r" ')"
    appimage_name="$(echo "$content" | grep -m 1 'url:.*\\.AppImage' | awk '{print $2}' | tr -d '\\r" ')"
    if [[ -z "$appimage_name" ]]; then
      appimage_name="$(echo "$content" | grep -m 1 'path:.*\\.AppImage' | awk '{print $2}' | tr -d '\\r" ')"
    fi
    if [[ -n "$version" && -n "$appimage_name" ]]; then
      tag="v$version"
      local appimage_url="$download_base/$tag/$appimage_name"
      local deb_url="$download_base/$tag/MLUltimate-Launcher-$version-linux-x64.deb"
      printf '%s\\t%s\\t%s\\n' "$tag" "$appimage_url" "$deb_url"
      return 0
    fi
  fi
  return 1
}

resolve_releases_grep() {
  local json="$1"
  local tag appimage deb
  tag="$(echo "$json" | grep -m 1 -o '"tag_name": *"[^"]*"' | sed 's/"tag_name": *"//; s/"//')"
  appimage="$(echo "$json" | grep -m 1 -o '"browser_download_url": *"[^"]*\\.AppImage"' | sed 's/"browser_download_url": *"//; s/"//')"
  deb="$(echo "$json" | grep -m 1 -o '"browser_download_url": *"[^"]*\\.deb"' | sed 's/"browser_download_url": *"//; s/"//')"
  if [[ -n "$tag" && ( -n "$appimage" || -n "$deb" ) ]]; then
    printf '%s\\t%s\\t%s\\n' "$tag" "$appimage" "$deb"
    return 0
  fi
  return 1
}

detect_distro() {
  distro_name="Linux"
  is_debian_like=false
  if [[ -f /etc/os-release ]]; then
    distro_name="$(grep -E '^PRETTY_NAME=' /etc/os-release | cut -d= -f2 | tr -d '"' || true)"
    if [[ -z "$distro_name" ]]; then
      distro_name="$(grep -E '^NAME=' /etc/os-release | cut -d= -f2 | tr -d '"' || true)"
    fi
    local distro_id
    distro_id="$(grep -E '^ID=' /etc/os-release | cut -d= -f2 | tr -d '"' | tr '[:upper:]' '[:lower:]' || true)"
    local distro_like
    distro_like="$(grep -E '^ID_LIKE=' /etc/os-release | cut -d= -f2 | tr -d '"' | tr '[:upper:]' '[:lower:]' || true)"

    if [[ "$distro_id" =~ ^(pop|ubuntu|debian|linuxmint|elementary|zorin)$ ]] || [[ "$distro_like" =~ (debian|ubuntu) ]]; then
      is_debian_like=true
    fi
  fi
  if have dpkg && have apt-get; then
    is_debian_like=true
  fi
}

header
detect_distro
info "Sistema detectado: \${bold}$distro_name\${reset}"

step "Termos de uso"
terms_text
printf '\\n'
if ! ask_yes_no "Você aceita os termos para continuar?" "n"; then
  die "Você precisa aceitar os termos para instalar o MLUltimate Launcher."
fi
ok "Termos aceitos"

step "Verificando ferramentas do sistema"
if ! have curl && ! have wget; then
  die "Instale curl ou wget e tente novamente (ex: sudo apt install curl)."
fi
ok "Ferramenta de download disponível"

target=""
step "Consultando a release oficial mais recente no GitHub"
raw_json="$(fetch "$api" 2>/dev/null || true)"

if [[ -n "$raw_json" ]]; then
  if have python3; then
    target="$(printf '%s' "$raw_json" | resolve_releases_python 2>/dev/null || true)"
  fi
  if [[ -z "$target" ]] && have jq; then
    target="$(printf '%s' "$raw_json" | resolve_releases_jq 2>/dev/null || true)"
  fi
  if [[ -z "$target" ]] && have node; then
    target="$(printf '%s' "$raw_json" | resolve_releases_node 2>/dev/null || true)"
  fi
  if [[ -z "$target" ]]; then
    target="$(resolve_releases_grep "$raw_json" 2>/dev/null || true)"
  fi
fi

if [[ -z "$target" ]]; then
  target="$(resolve_releases_manifest 2>/dev/null || true)"
fi

if [[ -z "$target" ]]; then
  die "Não foi possível encontrar uma release válida do MLUltimate Launcher no GitHub."
fi

tag="$(echo "$target" | cut -f1)"
appimage_url="$(echo "$target" | cut -f2)"
deb_url="$(echo "$target" | cut -f3)"

ok "Release encontrada: \${bold}$tag\${reset}"

install_mode="appimage"

if [[ "$is_debian_like" == "true" && -n "$deb_url" ]]; then
  step "Escolha o formato de instalação para $distro_name"
  printf '%s\\n' "  1) Pacote nativo (.deb) [Recomendado para Pop!_OS / Ubuntu / Debian - Requer sudo]"
  printf '%s\\n' "  2) Executável portátil (.AppImage) [Instala apenas no seu usuário - Sem necessidade de sudo]"

  if [[ -t 0 ]]; then
    read -r -p "Escolha a opção (1 ou 2) [Padrão: 1]: " chosen_opt
    chosen_opt="\${chosen_opt:-1}"
    if [[ "$chosen_opt" == "1" ]]; then
      install_mode="deb"
    else
      install_mode="appimage"
    fi
  else
    install_mode="deb"
  fi
fi

if [[ "$install_mode" == "deb" ]]; then
  step "Instalando pacote .deb nativo"
  tmp_deb="$(mktemp "\${TMPDIR:-/tmp}/mlultimate-$tag-XXXXXX.deb")"
  trap 'rm -f "$tmp_deb"' EXIT

  info "Baixando pacote DEB..."
  download_file "$deb_url" "$tmp_deb"

  info "Instalando via gerenciador de pacotes do sistema (solicitará sua senha se necessário)..."
  if have sudo; then
    sudo apt-get install -y "$tmp_deb" || {
      sudo dpkg -i "$tmp_deb" || sudo apt-get install -f -y
    }
  else
    apt-get install -y "$tmp_deb" || {
      dpkg -i "$tmp_deb" || apt-get install -f -y
    }
  fi

  if ask_yes_no "Deseja criar um atalho na área de trabalho?" "s"; then
    mkdir -p "$desktop_shortcut_dir"
    sys_desktop="/usr/share/applications/mlultimate-launcher.desktop"
    if [[ -f "$sys_desktop" ]]; then
      cp "$sys_desktop" "$desktop_shortcut_file"
      chmod +x "$desktop_shortcut_file"
      if have gio; then
        gio set "$desktop_shortcut_file" metadata::trusted true 2>/dev/null || true
      fi
      ok "Atalho criado em: $desktop_shortcut_file"
    fi
  fi

  ok "MLUltimate Launcher instalado com sucesso no sistema!"
  info "Você já pode encontrá-lo no menu de aplicativos do Pop!_OS."

  if ask_yes_no "Deseja abrir o MLUltimate agora?" "s"; then
    nohup mlultimate-launcher >/dev/null 2>&1 &
  fi

else
  step "Instalação do AppImage no seu usuário"
  mkdir -p "$install_dir" "$bin_dir" "$desktop_dir"

  tmp_appimage="$(mktemp "\${TMPDIR:-/tmp}/mlultimate-$tag-XXXXXX.AppImage")"
  trap 'rm -f "$tmp_appimage"' EXIT

  info "Baixando executável AppImage..."
  download_file "$appimage_url" "$tmp_appimage"

  mv "$tmp_appimage" "$appimage_path"
  chmod +x "$appimage_path"
  ok "Executável instalado em: $appimage_path"

  info "Configurando ícone do launcher..."
  if fetch "$icon_url" > "$icon_path.tmp" 2>/dev/null; then
    mv "$icon_path.tmp" "$icon_path"
  else
    rm -f "$icon_path.tmp"
    warn "Não foi possível baixar o ícone do menu, mas o launcher foi instalado."
  fi

  # Cria o script wrapper com suporte automático a FUSE (essencial para Pop!_OS 22.04+ e 24.04+)
  cat > "$wrapper_path" <<EOF
#!/usr/bin/env bash
# Detecção automática de libfuse2 ausente (comum no Pop!_OS 22.04+/24.04+ e Ubuntu 24.04+)
if ! ldconfig -p 2>/dev/null | grep -qE "libfuse\\\\.so\\\\.2|libfuse2" && [ ! -f /lib/x86_64-linux-gnu/libfuse.so.2 ] && [ ! -f /usr/lib/x86_64-linux-gnu/libfuse.so.2 ] && [ ! -f /usr/lib/libfuse.so.2 ] && [ ! -f /lib64/libfuse.so.2 ]; then
  export APPIMAGE_EXTRACT_AND_RUN=1
fi
exec "$appimage_path" "\\$@"
EOF
  chmod +x "$wrapper_path"
  ok "Comando criado em: $wrapper_path"

  # Cria o atalho no menu de aplicativos (.desktop)
  cat > "$desktop_file" <<EOF
[Desktop Entry]
Type=Application
Name=MLUltimate Launcher
Comment=Launcher desktop para instalar, organizar e jogar Minecraft e modpacks.
Exec=$wrapper_path %U
Icon=$icon_path
Terminal=false
Categories=Game;ActionGame;AdventureGame;
StartupWMClass=mlultimate-launcher
StartupNotify=true
Keywords=minecraft;launcher;mlultimate;modpack;
EOF
  chmod +x "$desktop_file"
  ok "Atalho registrado no menu de aplicativos"

  if ask_yes_no "Deseja criar um atalho na área de trabalho?" "s"; then
    mkdir -p "$desktop_shortcut_dir"
    cp "$desktop_file" "$desktop_shortcut_file"
    chmod +x "$desktop_shortcut_file"
    if have gio; then
      gio set "$desktop_shortcut_file" metadata::trusted true 2>/dev/null || true
    fi
    ok "Atalho criado em: $desktop_shortcut_file"
  else
    rm -f "$desktop_shortcut_file"
  fi

  if have update-desktop-database; then
    update-desktop-database "$desktop_dir" >/dev/null 2>&1 || true
  fi

  if [[ ":\$PATH:" != *":$bin_dir:"* ]]; then
    info "Dica: Adicione $bin_dir ao seu PATH para executar 'mlultimate-launcher' em qualquer terminal."
  fi

  ok "MLUltimate Launcher instalado com sucesso!"

  if ask_yes_no "Deseja abrir o MLUltimate agora?" "s"; then
    nohup "$wrapper_path" >/dev/null 2>&1 &
  fi
fi
`,
);
chmodSync(linuxOutputPath, 0o755);
console.log(`Linux online installer created: ${linuxOutputPath}`);
}

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
        width: min(100%, 1080px);
        margin: 0 auto;
        display: grid;
        grid-template-columns: minmax(0, 1fr) 390px;
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
        font-size: clamp(36px, 6vw, 70px);
        line-height: 0.96;
        letter-spacing: 0;
      }

      .lead {
        max-width: 640px;
        margin: 24px 0 0;
        color: var(--muted);
        font-size: 17px;
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
        border-radius: 12px;
        padding: 24px;
        box-shadow: 0 24px 70px rgba(0, 0, 0, 0.35);
      }

      .panel h2 {
        margin: 0 0 16px;
        font-size: 20px;
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
        min-width: 88px;
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
        border-left: 3px solid var(--blue);
        padding-left: 12px;
        color: var(--muted);
        font-size: 13px;
        line-height: 1.5;
      }

      .code-box {
        margin-top: 6px;
        background: #0d1117;
        border: 1px solid var(--line);
        border-radius: 6px;
        padding: 8px 10px;
        font-family: ui-monospace, monospace;
        font-size: 11px;
        color: #7dd3fc;
        word-break: break-all;
        user-select: all;
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
            Instaladores com busca automática da versão mais recente publicada no GitHub.
            Compatível com Windows 10/11 e distribuições Linux (Pop!_OS, Ubuntu, Debian, Fedora e Arch).
          </p>

          <div class="trust" aria-label="Garantias">
            <span>Criador: MLUltimate Team</span>
            <span>Fornecedor: MLUltimate Team</span>
            <span>Release oficial do GitHub</span>
            <span>100% Livre de malware & seguro</span>
          </div>
        </div>

        <aside class="panel" aria-label="Escolha seu sistema">
          <h2>Escolha seu sistema</h2>

          <a class="download" href="./MLUltimate-Installer-Windows.exe" download>
            <span>
              <strong>Windows (.exe)</strong>
              <small>Instalador oficial seguro para Windows (Criador: MLUltimate Team).</small>
            </span>
            <span class="button">Baixar</span>
          </a>

          <a class="download" href="./MLUltimate-Installer-Linux.sh" download>
            <span>
              <strong>Linux (.sh)</strong>
              <small>Instalador automático (Pop!_OS, Ubuntu, Debian, etc.).</small>
            </span>
            <span class="button">Baixar</span>
          </a>

          <div class="note" style="border-left-color: #38bdf8;">
            <strong style="color: #7dd3fc; display: block; margin-bottom: 2px;">Aviso do Windows Defender / SmartScreen:</strong>
            <span>Como este é um executável de lançamento recente sem certificado pago caro, o Windows pode exibir uma tela azul informativa. Basta clicar em <strong>"Mais informações"</strong> e depois em <strong>"Executar assim mesmo"</strong>. O aplicativo é 100% seguro e de código aberto.</span>
          </div>

          <div class="note">
            <span>No Linux, execute no terminal:</span>
            <div class="code-box">chmod +x MLUltimate-Installer-Linux.sh && ./MLUltimate-Installer-Linux.sh</div>
          </div>

          <div class="direct">
            <a href="https://github.com/GuelBDev/MLUltimate/releases" rel="noreferrer">
              Ver releases (.deb / .AppImage)
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

if (!buildWin) {
  process.exit(0);
}

if (process.platform !== "win32") {
  console.log("Online installer packaging skipped outside Windows.");
  process.exit(0);
}

const csc = findCsc();

if (!csc) {
  throw new Error("csc.exe was not found. Cannot build Windows online installer.");
}

execFileSync(
  csc,
  [
    "/nologo",
    "/target:winexe",
    `/out:${outputPath}`,
    `/win32icon:${path.join(root, "build", "icon.ico")}`,
    `/win32manifest:${manifestPath}`,
    "/reference:System.dll",
    "/reference:System.Drawing.dll",
    "/reference:System.Windows.Forms.dll",
    csharpPath,
  ],
  { stdio: "inherit" },
);

if (!existsSync(outputPath)) {
  throw new Error(`Online installer was not created at ${outputPath}`);
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

