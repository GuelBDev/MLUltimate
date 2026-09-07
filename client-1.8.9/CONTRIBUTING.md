# Guia de Contribuição — MLUltimate Client

Obrigado pelo interesse em contribuir com o **MLUltimate Client 1.8.9**!

## Diretrizes de Desenvolvimento

1. **Clean-Room**: Não copie, decompile ou reutilize código de clientes comerciais ou proprietários. Todas as implementações devem ser baseadas em APIs públicas do Minecraft Forge, LWJGL/OpenGL e bibliotecas permissivas (ex: GSON).
2. **Java 8 Compliance**: O projeto deve manter estrita compatibilidade com Java 8 (`--release 8`). Não utilize recursos ou APIs introduzidas em versões superiores do Java na camada de runtime do cliente.
3. **Isolamento e Segurança**: Qualquer novo módulo deve estender `net.mlultimate.client.module.Module` para herdar automaticamente a proteção de tratamento de exceções via `ModuleExceptionHandler`.
4. **Performance First**: Evite criar objetos temporários ou executar operações de I/O dentro dos loops de renderização (`onRender`) ou ticks (`onTick`).
5. **Configurações Atômicas**: Novas configurações devem ser expostas através das classes em `net.mlultimate.client.module.setting` para garantir persistência automática no `ConfigManager`.

## Fluxo de Teste

Antes de submeter alterações:

```bash
# Executar suíte de testes unitários
./gradlew test

# Verificar compilação completa
./gradlew build
```
