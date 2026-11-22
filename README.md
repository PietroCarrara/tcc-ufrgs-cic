# Trama — sistema modular de apoio ao TCC

Aplicação completa em TypeScript: Vue 3, Tiptap, Express 5 e SQLite nativo do Node. Inclui alunos/professores, diretório de orientadores, propostas e projetos colaborativos, grade semanal, reuniões com confirmação de conflitos, editor acadêmico, fontes/BibTeX, anexos, notificações e PDF.

Os diagramas e casos de uso originais estão preservados. O plano de referência é `plano_de_execucao.md`.

## Instalação e primeiro uso

Requer **Node 26.13.x**, **npm 11.x**, Linux/macOS/Windows com dependências do Chromium. Use `.nvmrc` com `nvm use` quando disponível.

```bash
npm ci
npx playwright install chromium
# No Linux, caso faltem bibliotecas do navegador:
# npx playwright install --with-deps chromium
cp .env.example .env
npm run migrate
npm run seed
npm run dev
```

Abra **http://localhost:5173**. O Vite encaminha `/api` ao servidor em `127.0.0.1:3000`. Ambos devem executar na mesma máquina. Não alterne `localhost` e `127.0.0.1`: a origem deve corresponder exatamente a `APP_ORIGIN`.

O seed é **opcional**, explícito, aceita somente banco vazio e é bloqueado em produção. Cria três alunos (`ana`, `bruno`, `clara`) e três professores (`marina`, `rafael`, `helena`) em `@exemplo.edu`. Senha de demonstração: **`Demonstracao!2026`**. Inclui projeto com vários autores/orientadores, propostas simultâneas, agenda e reunião. Nunca use essas credenciais em produção.

Para uma instalação real, pule o seed e provisione contas:

```bash
npm run provision -- --nome "Nome do Aluno" --email "aluno@instituicao.edu" --papel aluno
npm run provision -- --nome "Nome do Professor" --email "professor@instituicao.edu" --papel professor
```

A senha é pedida no terminal sem eco (12–128 caracteres) e confirmada. Execute novamente com o mesmo e-mail e papel para redefini-la; isso revoga todas as sessões da conta. Não há cadastro público ou recuperação por e-mail. O papel de uma conta existente não é convertido pelo comando.

## Configuração

O arquivo `.env` é local e ignorado. Não coloque segredos no cliente nem nas configurações de módulos.

| Variável                    | Padrão / propósito                                                        |
| --------------------------- | ------------------------------------------------------------------------- |
| `PORT`                      | `3000`, porta da API e da SPA compilada                                   |
| `DATABASE_PATH`             | `data/tcc.sqlite`; diretório criado automaticamente                       |
| `APP_ORIGIN`                | `http://localhost:5173`; origem exata usada pelo navegador                |
| `APP_TIMEZONE`              | `America/Sao_Paulo`; fuso institucional da grade semanal                  |
| `CONFIRMATION_SECRET`       | Segredo com ao menos 32 caracteres; obrigatório e persistente em produção |
| `COOKIE_SECURE`             | `false` somente para desenvolvimento HTTP; `true` em HTTPS                |
| `NODE_ENV`                  | `production` aplica exigências de HTTPS e segredo                         |
| `SERPAPI_API_KEY`           | Chave privada para a busca Google Scholar via SerpApi                     |
| `JSON_LIMIT_BYTES`          | `2097152`, corpo JSON (2 MiB)                                             |
| `DOCUMENT_LIMIT_BYTES`      | `1048576`, texto RichText serializado (1 MiB)                             |
| `UPLOAD_LIMIT_BYTES`        | `10485760`, anexo (10 MiB)                                                |
| `PHOTO_LIMIT_BYTES`         | `2097152`, foto (2 MiB)                                                   |
| `PROJECT_FILES_LIMIT_BYTES` | `104857600`, anexos por projeto (100 MiB)                                 |

Gere o segredo, copie-o para `.env` e mantenha-o entre reinícios:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Em desenvolvimento, a omissão gera um segredo efêmero; confirmações de reunião pendentes deixam de valer após reinício. A sessão continua persistida no SQLite. Cookies são opacos, `HttpOnly`, `SameSite=Lax` e `Secure` quando configurado. Sessões expiram em oito horas de inatividade ou sete dias de vida. Operações mutáveis exigem origem e token CSRF, inclusive login e logout.

## Compilação e produção

```bash
npm run modules:check
npm run typecheck
npm run build
# Configure APP_ORIGIN para a URL efetivamente usada:
APP_ORIGIN=http://localhost:3000 npm start
```

O comando acima é uma verificação local do artefato compilado. Em implantação real, configure `NODE_ENV=production`, `COOKIE_SECURE=true`, `APP_ORIGIN=https://seu-dominio` e o segredo persistente; termine TLS no proxy reverso. Sirva tanto SPA quanto `/api` pela mesma origem. O servidor entrega arquivos de `dist/client`, suporta links profundos e devolve JSON para API desconhecida. Não exponha arquivos em `data/`.

O serviço escuta somente em `127.0.0.1`. Execute atrás de proxy no mesmo host, com armazenamento SQLite em volume persistente. Encerramento por SIGINT/SIGTERM fecha HTTP, Chromium e banco. Não execute várias instâncias escrevendo o mesmo SQLite em armazenamento de rede.

## Módulos

A configuração padrão habilita `autenticacao-basica`, `busca-scholar` e `exportacao-basica`. Os arquivos `config/modules.client.json` e `config/modules.server.json` são independentes. Alterações no servidor exigem reinício; no cliente, recompilação e redistribuição.

Consulte [extensão e exemplo instalável](docs/modulos.md). O exemplo real em `tests/fixtures/modulo-exemplo` contribui com tela, navegação, aba de projeto, rota, método e migração sem alterar o núcleo.

Desabilitar módulos preserva dados; não há `DROP TABLE` automático. Exige-se ao menos um módulo com capacidade de autenticação no servidor. A ausência de um módulo de login compatível no cliente mostra um estado de configuração indisponível. Busca e exportação podem ser removidas sem afetar fontes já cadastradas ou escrita.

## Busca bibliográfica

Configure `SERPAPI_API_KEY`, reinicie o servidor e abra **projeto → Buscar referências**. Busque um termo, confira resultados e use **Adicionar fonte** ou arraste para a lista de fontes. O formulário permite complementar metadados desconhecidos. Sem chave, há explicação e link para pesquisa externa; nenhuma resposta fictícia é produzida.

O adaptador usa `engine=google_scholar`, idioma português, dez resultados por página, timeout de dez segundos, cache de dez minutos e limite de vinte consultas por minuto/usuário. Quota e rede indisponíveis são tratadas como 503. SerpApi é um serviço terceiro e sua conta pode ter custos. Não é necessário para cadastrar fontes ou importar BibTeX.

A execução automatizada usa `tests/fixtures/scholar.json` na fronteira HTTP. **A homologação ao vivo depende de credencial; não foi substituída por essa fixture.** Para verificá-la: configure a chave, realize busca no navegador, abra uma publicação, adicione uma fonte e confirme a persistência após reload.

## Banco e backup

Migrações versionadas/checksummadas são aplicadas antes de atender requisições. `npm run migrate` as executa explicitamente; repetir é seguro. Chaves estrangeiras, WAL e transações curtas estão habilitados. Não edite SQL de migrações já aplicadas: acrescente uma nova versão.

Backup consistente com a API online do SQLite:

```bash
npm run backup -- /caminho/seguro/trama-backup.sqlite
```

Alternativa: pare o serviço e só então copie o banco e seus arquivos WAL/SHM associados. Não copie somente o arquivo principal enquanto o serviço está ativo. Para restaurar, pare o serviço, preserve o estado atual como cópia de segurança, remova do destino os WAL/SHM antigos, coloque o backup em `DATABASE_PATH`, aplique/verifique migrações com a mesma versão do software e reinicie. Proteja backups: contêm documentos, anexos e dados de autenticação.

## Verificação

```bash
npm run lint
npm run typecheck
npm test
npm run test:integration
npm run test:e2e
npm run build
npm run test:production
```

Testes unitários verificam intervalos, RichText, numeração, módulos, adaptador e autosave. Integração usa Express e SQLite reais em diretório temporário, incluindo CSRF, sessão, propostas, rollback, membros, agenda, arquivos e exportação. E2E inicia um banco isolado e o build real, cobrindo propostas, editor, conflitos entre abas, reconexão, grade por arraste e PDF. Falhas retornam código diferente de zero; traces e screenshots ficam em `test-results/` e o relatório em `playwright-report/`.

`output/pdf/validacao-academica.pdf` é produzido pelos testes de integração para revisão visual; esses artefatos são ignorados pelo controle de versão. As fixtures ficam apenas em `tests/`. As contas E2E são isoladas das contas da instalação.

Documentação adicional: [API OpenAPI](docs/openapi.json), [módulos](docs/modulos.md), [RichText e colaboração](docs/editor.md), [decisões](docs/decisoes.md) e [verificação](docs/verificacao.md).
