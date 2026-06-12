# MLUltimate CurseForge Proxy

Este proxy evita distribuir a API key da CurseForge dentro do instalador do MLUltimate.

## Como usar

1. Crie um Worker na Cloudflare.
2. Publique o conteudo de `src/worker.ts`.
3. Salve a chave da CurseForge como segredo do Worker:

```bash
wrangler secret put CURSEFORGE_API_KEY
```

4. Configure o launcher para apontar para o Worker:

```bash
MLULTIMATE_CURSEFORGE_PROXY_URL=https://mlultimate-curseforge-proxy.miguelgossani068.workers.dev
```

No app distribuido para usuarios finais, use sempre o proxy. Nao coloque a API key diretamente no codigo, no GitHub, nem dentro do instalador.

## Rotas aceitas

O proxy aceita apenas consultas `GET` e `HEAD` para rotas publicas da API da CurseForge usadas pelo launcher:

- `/mods`
- `/categories`
- `/minecraft`

Qualquer outra rota e bloqueada.
