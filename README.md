# MLUltimate Launcher

Launcher desktop para instalar, organizar e jogar Minecraft e modpacks.

## Linux — Lubuntu e Ubuntu

A release oferece dois formatos para computadores Linux de 64 bits:

- `MLUltimate-Launcher-<versão>-linux-x64.deb`: instalador recomendado para Lubuntu, Ubuntu e distribuições derivadas do Debian.
- `MLUltimate-Launcher-<versão>-linux-x64.AppImage`: versão portátil que não precisa ser instalada.

### Instalar o pacote DEB

Abra o arquivo `.deb` pela Central de Aplicativos ou execute:

```bash
sudo apt install ./MLUltimate-Launcher-*-linux-x64.deb
```

Depois da instalação, o **MLUltimate Launcher** estará disponível no menu de aplicativos, na categoria Jogos.

### Executar o AppImage

```bash
chmod +x MLUltimate-Launcher-*-linux-x64.AppImage
./MLUltimate-Launcher-*-linux-x64.AppImage
```

O launcher procura uma instalação Java compatível e, quando necessário, baixa automaticamente o runtime correto para Linux.

## Desenvolvimento

```bash
npm install
npm run dev
```

## Validação e empacotamento

```bash
npm run lint
npm run build
npm run dist:linux
```

Os instaladores são gerados na pasta `release`.
