# MLUltimate Updates

MLUltimate usa GitHub Releases como canal de atualizacao.

Repositorio esperado:

```text
https://github.com/GuelBDev/MLUltimate
```

## Publicar uma nova alpha

1. Atualize a versao em `package.json`.
2. Commit as alteracoes.
3. Crie uma tag:

```powershell
git tag v2.0.1-alpha.7
git push origin main --tags
```

O GitHub Actions vai gerar a Release com o instalador Windows e os arquivos de update.

## Canal atual

O canal atual e `latest`, usando o arquivo `latest.yml` gerado pelo Electron Builder.
Enquanto o app estiver em alpha, publique as releases como pre-release no GitHub.

O launcher verifica updates automaticamente ao abrir e tambem pela tela `Configuracoes`.

## Seguranca

Nao coloque API keys no repositorio. Chaves locais devem ser salvas pelo app ou por variaveis de ambiente.
