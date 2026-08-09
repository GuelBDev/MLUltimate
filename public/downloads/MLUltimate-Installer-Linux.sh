#!/usr/bin/env bash
set -euo pipefail

repo="GuelBDev/MLUltimate"
api="https://api.github.com/repos/$repo/releases"
atom="https://github.com/$repo/releases.atom"
download_base="https://github.com/$repo/releases/download"
icon_url="https://raw.githubusercontent.com/$repo/main/src/assets/mlultimate-icon.png"
install_dir="${XDG_DATA_HOME:-$HOME/.local/share}/MLUltimate"
bin_dir="${XDG_BIN_HOME:-$HOME/.local/bin}"
desktop_dir="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
desktop_shortcut_dir="${XDG_DESKTOP_DIR:-$HOME/Desktop}"
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
  green="$(printf '\033[32m')"
  blue="$(printf '\033[36m')"
  yellow="$(printf '\033[33m')"
  red="$(printf '\033[31m')"
  muted="$(printf '\033[90m')"
  bold="$(printf '\033[1m')"
  reset="$(printf '\033[0m')"
fi

have() {
  command -v "$1" >/dev/null 2>&1
}

header() {
  clear 2>/dev/null || true
  printf '%s\n' "${blue}============================================================${reset}"
  printf '%s\n' "${bold}MLUltimate Launcher Setup${reset}"
  printf '%s\n' "${muted}Instalador oficial para Linux 64-bit${reset}"
  printf '%s\n' "${blue}============================================================${reset}"
  printf '\n'
}

step() {
  printf '%s\n' "${blue}>${reset} $1"
}

ok() {
  printf '%s\n' "${green}OK${reset} $1"
}

warn() {
  printf '%s\n' "${yellow}!${reset} $1"
}

die() {
  printf '%s\n' "${red}Erro:${reset} $1" >&2
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
    zenity --info --title="MLUltimate Launcher Setup" --text="$message\n\nArquivo: $appimage_path" >/dev/null 2>&1 || true
  elif have kdialog; then
    kdialog --msgbox "$message\n\nArquivo: $appimage_path" --title "MLUltimate Launcher Setup" >/dev/null 2>&1 || true
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
  local default_answer="${2:-s}"
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
    answer="${answer:-$default_answer}"
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
  printf '%s\n' "Pasta padrao: $install_dir"

  if [[ -t 0 ]]; then
    read -r -p "Digite outra pasta ou pressione Enter para manter a padrao: " chosen
  fi

  if [[ -n "$chosen" ]]; then
    install_dir="${chosen/#\~/$HOME}"
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
      /MLUltimate-Launcher-.+-linux-x64\.AppImage$/.test(item.name)
    );
    if (asset) {
      console.log([release.tag_name, asset.browser_download_url].join("\t"));
      return;
    }
  }
  process.exit(1);
});
'
}

latest_from_atom() {
  local href tag version asset
  href="$(fetch "$atom" | grep -m 1 -Eo 'href="https://github.com/[^"]+/releases/tag/[^"]+"' | sed 's/^href="//; s/"$//; s/&amp;/\&/g')"
  if [[ -z "$href" ]]; then
    return 1
  fi
  tag="${href##*/}"
  version="${tag#v}"
  asset="MLUltimate-Launcher-$version-linux-x64.AppImage"
  printf '%s\t%s\n' "$tag" "$download_base/$tag/$asset"
}

header
step "Termos de uso"
terms_text
printf '\n'
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

tag="${target%%$'\t'*}"
download_url="${target#*$'\t'}"
tmp_file="$(mktemp "${TMPDIR:-/tmp}/mlultimate-$tag-XXXXXX.AppImage")"
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
exec "$appimage_path" "\$@"
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
printf '\n%s\n' "${bold}Para abrir agora:${reset} $appimage_path"
success_message
if ask_yes_no "Deseja abrir o MLUltimate agora?" "s"; then
  "$appimage_path" >/dev/null 2>&1 &
fi
