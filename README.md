# MLUltimate Launcher Download Site

Site oficial de download público do MLUltimate Launcher, com tema gamer premium,
busca automática da última release no GitHub e fallback para a página oficial de
releases.

## Rodar localmente

```bash
npm install
npm run dev
```

Abra o endereço mostrado no terminal. O botão principal tenta usar a API pública
do GitHub para encontrar o instalador Windows da última release:

`https://api.github.com/repos/GuelBDev/MLUltimate/releases/latest`

Se a API não responder ou não houver instalador detectável, o botão usa:

`https://github.com/GuelBDev/MLUltimate/releases/latest`

## Build

```bash
npm run build
```
