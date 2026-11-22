# Desenvolvimento e operação de módulos

## Instalação

Módulos são código confiável instalado pelo operador. Não há upload de plugins pela web nem imports arbitrários recebidos em requisições. Pacotes locais ficam sob `modules/`; a fixture de exemplo sob `tests/fixtures/`. Para pacote npm confiável, instale-o no workspace/raiz com `npm install nome-do-pacote` e declare a entrada exportada (por exemplo, `@instituicao/modulo/server`) na lista `packages`.

A mesma extensão pode ter entradas independentes:

```json
{
  "packages": [
    {
      "id": "autenticacao-basica",
      "entry": "./modules/autenticacao-basica/server.ts"
    },
    { "id": "exemplo", "entry": "./tests/fixtures/modulo-exemplo/server.ts" }
  ],
  "enabled": ["autenticacao-basica", "exemplo"],
  "options": { "exemplo": {} }
}
```

No arquivo do cliente, use as entradas `client.ts`. Preserve os outros módulos desejados na lista. O catálogo de imports é gerado por `npm run modules:catalog`; não é um import de caminho arbitrário executado no navegador. Entradas locais são verificadas contra diretórios permitidos, incluindo symlinks.

Procedimento de alteração:

1. Instale o pacote confiável e revise seu manifesto/compatibilidade.
2. Faça backup consistente (`npm run backup -- ...`).
3. Declare pacote e ID habilitado nos arquivos desejados.
4. Execute `npm run modules:check` e `npm run typecheck`.
5. Compile com `npm run build`, reinicie o servidor e redistribua a SPA.
6. Confira `/api/capabilities` e as contribuições na interface.

Para remover, primeiro retire o ID de `enabled`, reconstrua/reinicie e depois desinstale o pacote e remova sua declaração. Dados permanecem. Ao reabilitar, as migrações já executadas são reconhecidas por versão/checksum. Não altere migrações publicadas. Não há hot reload de módulos em produção.

## Manifesto

Cada entrada exporta por padrão um objeto/classe com `manifesto` e `inicializar`. O manifesto contém `id`, `nome`, `versao` inteira positiva, `apiVersion: 1`, `capacidades: string[]` e `dependencias?: Record<string, number>`. A versão do contrato é independente da versão semântica do pacote npm. As dependências são ordenadas topologicamente; IDs repetidos, ciclo, ausência/incompatibilidade e erro de inicialização impedem a disponibilização do servidor.

## SDK do servidor

Contrato: `packages/module-sdk/src/server.ts`. Exemplo executável: `tests/fixtures/modulo-exemplo/server.ts`.

```ts
import type { ModuloServidor } from "@tcc/module-sdk/server";

export default {
  manifesto: {
    id: "meu-modulo",
    nome: "Meu módulo",
    versao: 1,
    apiVersion: 1,
    capacidades: ["minha-capacidade"],
  },
  inicializar(registro) {
    registro.servicos.banco.migrar(
      "meu-modulo",
      1,
      "CREATE TABLE meu_modulo_dados(id TEXT PRIMARY KEY, valor TEXT NOT NULL) STRICT;",
    );
    registro.registrarMetodo(
      "meu-modulo.saudacao",
      (nome: string) => `Olá, ${nome}`,
    );
    registro.registrarRotaAPI(
      "/api/meu-modulo",
      async (req, res) => {
        const mensagem = await registro.invocarMetodo("meu-modulo.saudacao", [
          req.usuario!.nome,
        ]);
        res.json({ mensagem });
      },
      { metodo: "get" },
    );
  },
} satisfies ModuloServidor;
```

`registrarRotaAPI(url, callback, opções?)` assume POST autenticado. Opções: `metodo`, `publica`, `papeis`, `schema` Zod e `middleware`. O núcleo já verifica sessão, CSRF/origem para operações mutáveis e tratamento de erros. O módulo deve validar parâmetros e aplicar acesso ao projeto via `servicos.dominio.acesso(id, req.usuario!)`. As rotas do núcleo também ocupam o registro; barra final e nomes de parâmetros são normalizados para detecção de colisões.

`registrarMetodo` exige namespace do proprietário e rejeita duplicatas. `invocarMetodo` é aguardável, não constitui um endpoint genérico e não concede autorização por si só. Passe o usuário quando o método depender de acesso. A fachada expõe banco/transações, domínio/projetos/notificações, sessão e configuração do servidor. Não importe repositórios privados de outros módulos.

Transações são síncronas, curtas e não aceitam Promise. Não execute rede ou PDF dentro de transações. `aoEncerrar(callback)` libera recursos. Migração que falha é revertida; erro de inicialização fecha recursos e o servidor não abre porta.

Provedores de autenticação declaram capacidade `autenticacao`. A associação/rotação de sessão é feita com `servicos.sessoes.criar(req,res,usuario,idDoModulo)`. Pelo menos um provedor precisa existir. Credenciais do módulo básico ficam em tabela própria e o comando administrativo compartilha o serviço de hash.

## SDK do cliente

Contrato: `packages/module-sdk/src/client.ts`. Exemplo: `tests/fixtures/modulo-exemplo/client.ts`.

- `registrarTela(nome, componente, {path?, publica?, papeis?})`: registra rota e guardas; nomes e caminhos não podem colidir.
- `escutarEvento(nome, callback)`: retorna cancelamento da inscrição.
- `dispararEvento(nome, argumentos)`: callbacks síncronos recebem os mesmos objetos, em ordem. Não use Promise em eventos de coleta.
- `temCapacidade(nome)`: consulta capacidades anunciadas pelo servidor.

Eventos tipados: `listarBotoesDeLogin`, `listarItensDeNavegacao`, `listarAbasDoProjeto`, `listarAcoesDoProjeto`. Os dois últimos recebem lista e contexto do projeto. Cada contribuição tem `id`, `proprietario`, `rotulo`, `ordem?`, `papeis?`, e `path`, `component` ou `executar` conforme o evento.

O padrão UML é preservado literalmente:

```ts
registro.escutarEvento("listarBotoesDeLogin", (lista) => {
  lista.push({
    id: "meu-login.botao",
    proprietario: "meu-login",
    rotulo: "Entrar",
    path: "/meu-login",
  });
});
registro.dispararEvento("listarBotoesDeLogin", [listaVazia]);
```

A ação de projeto recebe `projeto`, `salvar()` e `download(url, body, nome)`. Antes de exportar/consumir texto persistido, aguarde `salvar()` e continue somente quando retornar `true`. Componentes de abas recebem `projectId` e `fontes`; emitam `changed` após alterar fontes/arquivos para atualizar o editor. Componentes fazem suas próprias consultas assíncronas.

Antes de inicializar extensões, o cliente confere protocolo, ID, versão e capacidades. Incompatibilidade opcional oculta contribuições e mostra diagnóstico. Protocolo base incompatível bloqueia a aplicação com mensagem para atualização. As guardas de UI complementam, mas não substituem, autorização no servidor.

## Prova de instalação/remoção

`tests/integration/modules.test.ts` instala o exemplo por configuração, invoca método/rota, grava dado, desabilita, reinicia, confirma ausência da rota e preservação da tabela, e reabilita sem reaplicar migração. Também substitui o provedor básico por um provedor mínimo de teste, verifica revogação de sessões de provedor removido e falhas de rota/método/migração.

`tests/unit/core.test.ts` verifica duas contribuições na mesma lista, cancelamento, tela/colisão e dependências. A suíte de navegador cobre tela e aba do exemplo no build de teste. A fixture nunca é habilitada na configuração de produção padrão.
