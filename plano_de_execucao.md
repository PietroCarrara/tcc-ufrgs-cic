# Plano de execução — Sistema modular de auxílio à escrita do TCC

Documento para o agente responsável pela implementação completa. Elaborado em 10/11/2026. Esta etapa produz somente o plano; os arquivos UML e os casos de uso devem ser preservados.

## 1. Objetivo e fontes de requisitos

Construir uma aplicação web em TypeScript, com cliente Vue, servidor Node.js/Express e persistência SQLite. A aplicação deve permitir autenticação de alunos e professores, procura de orientador, tramitação de propostas, escrita do projeto, organização de fontes e arquivos, manutenção de horários, reuniões semanais e notificações. A extensibilidade precisa funcionar efetivamente nos dois lados: módulos instaláveis registram recursos em contratos públicos, e sua configuração determina o que estará disponível após reinício/recompilação.

As fontes locais são:

| Fonte | Obrigações de implementação |
| --- | --- |
| `casos-de-uso/login.md` | Botões de autenticação contribuídos por módulos; sessão de aluno ou professor; retorno à página inicial. |
| `casos-de-uso/modulos.md` | Instalação e configuração independentes no servidor e cliente; reinício do servidor e redistribuição do cliente. |
| `casos-de-uso/procurar-orientador.md` | Diretório com contadores, filtros textuais e de disponibilidade, proposta, aceite/rejeição e notificações. |
| `casos-de-uso/editar-horarios.md` | Grade semanal, criação por arraste, edição/exclusão de atividades próprias e exibição das reuniões dos projetos. |
| `casos-de-uso/reunioes.md` | Criação/edição de reuniões, ocupação dos membros, aviso de conflitos com possibilidade de ignorar e notificação dos demais participantes. |
| `casos-de-uso/escrita.md` | Editor com elementos acadêmicos, salvamento periódico, referências, arquivos e contribuições de módulos. |
| `casos-de-uso/buscar-referencias.md` | Busca integrada ao Google Scholar e inclusão de fontes por arraste. |
| `autenticacao-cliente.mmd` | Registro de tela e evento `listarBotoesDeLogin`, com alteração da lista recebida pelo callback. |
| `autenticacao-servidor.mmd` | Inicialização do módulo, criação de tabelas, registro de `/api/login` e alteração da sessão. |
| `diagrama-de-classes.mmd` | Entidades, cardinalidades, separação Core/Client/Server, registros de módulos e módulo de exportação PDF. |

Os requisitos acima são obrigatórios. As escolhas abaixo resolvem lacunas dos documentos e não devem virar funcionalidades simuladas. Quando houver dependência externa indisponível, implementar o adaptador real e informar claramente o que não foi possível validar ao vivo.

## 2. Decisões de escopo e interpretação

1. **Perfis:** uma conta possui exatamente um papel, `aluno` ou `professor`. `Usuario` é abstrato no domínio, com subclasses `Aluno` e `Professor`; a persistência usa discriminador. O administrador dos módulos é o operador da instalação, sem um terceiro papel ou painel administrativo web.
2. **Provisionamento:** fornecer comando administrativo para criar contas e definir/redefinir senha, com entrada oculta de senha. Não haverá cadastro público, recuperação por e-mail ou login social nesta entrega; esses fluxos não foram especificados. Incluir seed demonstrativo explícito para desenvolvimento e testes, nunca executado automaticamente em produção.
3. **Campo incompleto:** o `+Blob` sem nome de `Usuario` será interpretado como foto de perfil opcional, persistida como imagem binária com tipo MIME. Incluir upload/substituição/remoção no perfil, sem torná-la obrigatória.
4. **Base e extensões:** usuários, projetos, propostas, horários, notificações, editor, fontes cadastradas e arquivos pertencem à base. Entregar como módulos removíveis `autenticacao-basica`, `busca-scholar` e `exportacao-basica`. Assim, remover a busca externa não elimina fontes já cadastradas nem impede a escrita.
5. **Criação de projeto:** ocorre pelo aceite da proposta. O formulário da proposta adiciona um título sugerido, além da descrição obrigatória. O projeto nasce com esse título, o aluno autor, o professor orientador, texto vazio e demais metadados editáveis. Não criar um fluxo paralelo de projeto sem orientador.
6. **Cardinalidades:** permitir vários autores e orientadores, conforme UML. Um orientador já vinculado pode adicionar/remover membros por uma tela simples, respeitando ao menos um aluno e um professor. Alunos não alteram membros. Novos membros recebem notificação; mudanças de membros invalidam a versão do projeto. Não implementar convites ou aceite de convites.
7. **Edição:** todos os membros podem ler o projeto, alterar texto/metadados, administrar fontes/arquivos e gerenciar reuniões. Professores também editam: isso é uma decisão de colaboração, embora o cenário principal de escrita mencione o aluno.
8. **Propostas:** permitir propostas simultâneas a professores distintos. Bloquear mais de uma proposta pendente do mesmo aluno ao mesmo professor. Aceite ou rejeição remove fisicamente a proposta, como solicitado; preservar o contexto necessário nas notificações. Não cancelar outras propostas automaticamente.
9. **Grade semanal:** a expressão “de sábado a domingo” é ambígua. Adotar sete dias completos, de domingo a sábado, com identificação explícita de cada dia. Representar dias por `0=domingo` até `6=sábado` e horários por minutos desde meia-noite.
10. **Tempo:** atividades são recorrências semanais, sem datas de ocorrência, feriados ou recorrências complexas. Usar fuso institucional configurado em `APP_TIMEZONE`, padrão `America/Sao_Paulo`, exibido na interface. Datas técnicas de criação/atualização/expiração usam UTC.
11. **Disponibilidade:** ausência de atividade significa disponibilidade. Um professor atende ao filtro se estiver livre durante todo o intervalo informado em pelo menos um dos dias selecionados; a interface explicita essa regra. Contar também reuniões de todos os projetos de que participa.
12. **Conflitos:** sobreposições não são proibidas globalmente. Em reuniões, exigir confirmação explícita dos conflitos encontrados antes de salvar. Na agenda pessoal, permitir sobreposição e representá-la visualmente. Eventos que apenas encostam nas extremidades não conflitam.
13. **Colaboração de texto:** adotar controle otimista de versão e recuperação de rascunho, sem edição simultânea via CRDT/WebSocket. Nunca sobrescrever silenciosamente alterações de outro membro.
14. **Notificações:** internas à aplicação, com lista e contador de não lidas, atualizados por consulta periódica. Não enviar e-mail, SMS ou notificações push.
15. **Exportação:** implementar PDF real porque `ExportacaoBasica.exportarPDF` consta do diagrama de classes. Usar apresentação acadêmica básica, sem alegar conformidade integral com ABNT ou normas institucionais não fornecidas.
16. **Limites:** não incluir IA generativa, detecção de plágio, banca, notas, chat, integração com calendário externo ou marketplace de módulos. A extensão futura desses recursos deve ser possível pelos contratos de módulos.

## 3. Stack e organização do repositório

### 3.1 Ferramentas escolhidas

- TypeScript em modo `strict`, módulos ESM e npm workspaces; compartilhar tipos e validações entre cliente e servidor sem importar código de servidor no navegador.
- Node.js **26.13.x**, linha efetivamente encontrada no ambiente desta análise, e npm 11.x. Registrar a versão em `.nvmrc` e `engines`; fixar versões resolvidas no `package-lock.json`. Antes de implementar, conferir o ambiente do executor e a disponibilidade das APIs usadas.
- Vue 3 com Composition API, SFCs e `<script setup lang="ts">`, Vite, Vue Router e Pinia. O scaffolding oficial suporta essa organização, conforme o [guia do Vue](https://vuejs.org/guide/quick-start.html#creating-a-vue-application).
- Express 5, tipos de Node/Express, validação de entradas com Zod, cliente HTTP com `fetch` e upload multipart com middleware que aplique limites antes de carregar os arquivos integralmente.
- SQLite pelo módulo nativo `node:sqlite`, SQL parametrizado e migrações versionadas, sem ORM. No ambiente verificado, `Database` é exportado e `DatabaseSync` é alias obsoleto; usar `Database` com a versão fixada e encapsulá-lo no adaptador de persistência. As operações são síncronas: transações devem ser curtas. Referência: [documentação de SQLite do Node](https://nodejs.org/api/sqlite.html).
- Tiptap 3, integração Vue 3 e extensões abertas para editor e tabelas; nós próprios para citação, figura, acrônimo e referência interna. A integração é documentada em [Tiptap para Vue](https://tiptap.dev/docs/editor/getting-started/install/vue3). Não depender de recursos comerciais do editor.
- Playwright/Chromium no servidor para gerar PDF; Vitest, Vue Test Utils, Supertest e Playwright Test para verificação. Fixar dependências compatíveis e instalar explicitamente o navegador necessário.
- CSS local com variáveis de cores/espaçamento e componentes reutilizáveis; interface em português, responsiva e acessível. Não é necessário um framework visual adicional.

Não instalar dependências ou gerar código durante a etapa atual. As ferramentas acima são instruções para a implementação posterior.

### 3.2 Estrutura prevista

```text
apps/
  client/src/
    core/                 # bootstrap, sessão, HTTP, roteamento, registro de módulos
    features/             # projetos, editor, professores, propostas, agenda, notificações
    components/           # componentes reutilizáveis e layout
  server/src/
    core/                 # Servidor, registro, sessão, configuração, tratamento de erros
    domain/               # entidades e serviços do domínio
    persistence/          # SQLite, repositórios e migrações do núcleo
    http/                 # rotas e controladores da base
packages/
  shared/                 # DTOs, esquemas, contratos, eventos e modelo RichText
  module-sdk/             # contratos públicos cliente/servidor com exports separados
modules/
  autenticacao-basica/    # entradas client/server, contratos e migrações próprias
  busca-scholar/
  exportacao-basica/
config/
  modules.client.json
  modules.server.json
scripts/                  # migração, provisionamento, seed e checagem de módulos
tests/
  integration/
  e2e/
  fixtures/               # módulos de teste e respostas de provedor, sem uso em produção
docs/                     # API, extensão de módulos, operação e decisões complementares
data/                     # SQLite local, ignorado pelo controle de versão
```

Preservar os UML e `casos-de-uso/` na raiz. Configurar scripts na raiz para desenvolver, verificar tipos, testar e construir todos os workspaces na ordem correta. Usar `tsx` no desenvolvimento do servidor e compilação `tsc` para executar JavaScript em produção. Cliente em desenvolvimento usa proxy `/api` para Express; produção serve cliente e API na mesma origem. O fallback da SPA não deve interceptar `/api/*`.

## 4. Arquitetura e extensibilidade

### 4.1 Responsabilidades e correspondência com UML

Manter entidades e regras de negócio independentes de Express/Vue. Controladores validam transporte e autorização; serviços coordenam regras e transações; repositórios persistem. Modelar explicitamente `Usuario`, `Aluno`, `Professor`, `Projeto`, `PropostaDeProjeto`, `Atividade`, `Fonte`, `Arquivo` e `Notificacao`. Métodos de aceitar/rejeitar proposta devem delegar a uma operação transacional; não espalhar essas regras por controladores.

`Servidor.inicializar()` configura banco, serviços, sessão, rotas base e módulos; `servir()` só abre a porta quando tudo está pronto. `Cliente.inicializar()` registra módulos, consulta capacidades e restaura a sessão; `servir()` monta a aplicação Vue. `Cliente.sessao` representa o usuário autenticado ou `null`, nunca credenciais. A associação Cookie/Session de `Servidor` usa um armazenamento persistente SQLite, em lugar de um mapa apenas em memória.

Implementar classes abstratas ou contratos equivalentes com implementações concretas nomeadas para os módulos do UML. Os nomes públicos `inicializar`, `registrarTela`, `escutarEvento`, `dispararEvento`, `registrarRotaAPI`, `registrarMetodo` e `invocarMetodo` devem existir. Podem receber extensões tipadas sem perder o comportamento descrito.

### 4.2 Manifestos e carregamento

Cada módulo declara `id` estável, `nome`, `versao` inteira positiva conforme UML, `apiVersion: 1`, dependências com versões mínimas, capacidades oferecidas e entradas client/server quando aplicáveis. A versão do pacote npm é separada da versão inteira do contrato.

As configurações contêm lista de pacotes instalados, IDs habilitados e opções não secretas. Segredos permanecem em variáveis de ambiente do servidor. Instalar módulos como pacotes locais/npm confiáveis, nunca executar código recebido em uma requisição HTTP.

No servidor, resolver somente pacotes declarados e caminhos locais permitidos. No cliente, gerar um catálogo de imports durante o build a partir da configuração; não tentar importar caminhos arbitrários de npm em tempo de execução no navegador. O mesmo módulo pode ter duas entradas e configurações separadas.

Ordenar por dependências antes da inicialização. Falhar com mensagem acionável em ID duplicado, versão incompatível, dependência ausente/cíclica, colisão de rota/método/tela ou exceção de inicialização. Impedir que um módulo substitua silenciosamente serviços de outro ou do núcleo.

### 4.3 Registro do servidor

- `registrarRotaAPI(url, callback, opcoes)` registra método HTTP, autenticação, papéis e esquema de validação. A forma do UML com dois parâmetros continua utilizável; a convenção padrão é POST e rota autenticada, e o login declara explicitamente que é público. Canonicalizar barra final para detectar colisões e aceitar `/api/login` e `/api/login/`.
- O registro mantém o proprietário de cada contribuição e aplica o mesmo tratamento de erros, autorização e limites das rotas base. Rotas base também reservam seus caminhos no registro.
- `registrarMetodo(nome, callback)` e `invocarMetodo(nome, argumentos)` usam nomes qualificados, contratos tipados e resultado aguardável quando assíncrono. Chamadas inexistentes geram erro explícito. Serviços expostos a módulos recebem contexto do usuário quando necessário; a invocação não é uma rota HTTP genérica.
- Disponibilizar serviços do núcleo por uma fachada: sessão, acesso a projetos, transações, notificações e banco/migrações. Módulos não importam repositórios privados uns dos outros.
- `registrarTabelasBancoDeDados()` do módulo básico registra e aplica suas migrações antes de liberar suas rotas. Migrações pertencem ao módulo, são identificadas por versão/checksum e registradas na tabela de migrações.
- `GET /api/capabilities` publica apenas IDs/versões e capacidades ativas necessárias ao cliente; não revela configuração sensível.

### 4.4 Registro do cliente

- `registrarTela(nome, page, metadados)` associa caminho e componente Vue com guardas de autenticação/papel. `/autenticacao` pertence ao módulo básico.
- `escutarEvento(nome, callback)` devolve função de cancelamento da inscrição. `dispararEvento(nome, argumentos)` executa callbacks síncronos na ordem de inicialização e mantém as referências dos objetos recebidos.
- Preservar literalmente o padrão `dispararEvento("listarBotoesDeLogin", [listaVazia])`: o callback recebe a lista como primeiro argumento, faz `push` de uma contribuição e retorna `void`. Dados assíncronos são carregados pelos componentes, não pelos eventos de coleta.
- Definir eventos tipados `listarItensDeNavegacao`, `listarAbasDoProjeto` e `listarAcoesDoProjeto`, além do evento de login. Cada contribuição tem ID, proprietário, ordem e permissões; o contexto do projeto acompanha os eventos pertinentes.
- A tela de escrita coleta abas/ações desses eventos, permitindo que busca e exportação sejam acrescentadas sem editar o editor. Metadados de autorização no cliente servem à navegação; a API sempre verifica permissões novamente.
- Validar capacidades do servidor antes de expor contribuições dependentes. Incompatibilidade de um módulo opcional oculta seu recurso e mostra diagnóstico apropriado; incompatibilidade de protocolo da base impede o uso com mensagem para atualizar o cliente. Se não houver autenticação compatível, mostrar estado de configuração indisponível, sem inventar um login alternativo.

### 4.5 Ciclo de instalação e remoção

Documentar o procedimento: instalar pacote no workspace apropriado, editar configuração, checar dependências, fazer backup, reiniciar servidor com migrações e reconstruir/redistribuir cliente. Não haverá hot reload de módulos em produção nem painel de upload de plugins.

Desabilitar módulo elimina suas rotas/telas/eventos/métodos na próxima inicialização, mas conserva suas tabelas e dados. Remover pacote exige antes desabilitá-lo; reabilitar não duplica migrações. Não executar `DROP TABLE` automaticamente. Dados de extensões removidas devem ser preservados; o editor deve manter nós desconhecidos como conteúdo opaco não editável com aviso, sem descartá-los ao salvar.

A instalação padrão habilita os três módulos. Exigir pelo menos um provedor de autenticação no servidor para o modo normal. Testar a substituição do módulo básico por um módulo mínimo de teste para comprovar que a dependência é da capacidade de autenticação, não de sua classe concreta. Remover busca/exportação deve manter a base funcional.

## 5. Persistência e invariantes

Usar IDs UUID em texto, FKs habilitadas, tabelas com restrições de tipo quando viável, `CHECK`, unicidade e índices. Ativar WAL em banco de arquivo e timeout de ocupação. Migrações e operações compostas usam transações com rollback; não realizar chamadas de rede ou geração de PDF dentro de transações. Banco temporário isolado por suíte de integração.

| Tabela / proprietário | Campos e regras principais |
| --- | --- |
| `usuarios` / núcleo | `id`, `nome`, `email_normalizado UNIQUE`, `papel`, foto BLOB/MIME opcionais, timestamps. E-mail sem diferenciação entre maiúsculas/minúsculas. |
| `professores` / núcleo | `usuario_id PK/FK`, `biografia_json`, `sugestoes_json`, representação textual normalizada para busca. Papel validado pelo serviço. |
| `sessoes` / núcleo | Hash do token como chave, usuário opcional antes do login, provedor de autenticação, token CSRF, criação, última atividade e expiração. Não armazenar token bruto. |
| `auth_basica_credenciais` / módulo | `usuario_id UNIQUE/FK`, hash de senha, salt e parâmetros do algoritmo. Não colocar senha em `usuarios`. |
| `propostas` / núcleo | `id`, `aluno_id`, `professor_id`, título, descrição, criação; unicidade do par aluno/professor enquanto pendente. Só armazena propostas pendentes. |
| `projetos` / núcleo | Títulos PT/EN, resumos RichText PT/EN, palavras-chave PT/EN, `texto_json`, `schema_version`, `versao`, timestamps. |
| `projeto_autores` / núcleo | Chave composta projeto/aluno e FKs. Um projeto precisa ter ao menos um autor. |
| `projeto_orientadores` / núcleo | Chave composta projeto/professor e FKs. Um projeto precisa ter ao menos um orientador. |
| `atividades` / núcleo | `id`, `usuario_id` ou `projeto_id`, dia, início/fim em minutos, descrição, versão e timestamps. `CHECK` exige exatamente um proprietário. Reuniões têm `projeto_id`. |
| `fontes` / núcleo | `id`, `projeto_id`, título, URL opcional, autores JSON, publicação parcial, BibTeX, DOI normalizado opcional, provedor/ID externo opcionais, versão e timestamps. |
| `arquivos` / núcleo | `id`, `projeto_id`, nome, MIME, tamanho, hash, conteúdo BLOB e criador. DTOs de listagem excluem conteúdo. |
| `notificacoes` / núcleo | `id`, destinatário, título, texto, lida, link interno opcional, tipo, contexto JSON e criação. Contexto preserva motivo de rejeição/dados da reunião. |
| `schema_migrations` / infraestrutura | Proprietário (`core` ou módulo), versão, checksum e instante de aplicação. |

Listas e RichText podem usar JSON validado em TEXT. `Fonte.publicacao` do UML será representada por valor ISO parcial (`AAAA`, `AAAA-MM` ou `AAAA-MM-DD`) e precisão; admitir desconhecida. Não inventar dia/mês de uma publicação cujo provedor só fornece ano.

Restrições essenciais:

- Contar projetos por professor com `COUNT(DISTINCT projeto_id)` e propostas pendentes independentemente, evitando multiplicação causada por joins.
- Aceitar proposta em transação: verificar destinatário, ler proposta, criar projeto e vínculos, notificar aluno e excluir proposta. Duas aceitações concorrentes devem produzir exatamente um projeto; a segunda recebe conflito ou recurso já processado.
- Rejeitar em transação: exigir motivo não vazio, notificar autor e excluir proposta. A notificação não pode depender de FK para uma proposta eliminada.
- Garantir quantidade mínima e papéis dos membros no serviço, dentro da mesma transação de mudança. Não expor endpoints que removam o último autor/orientador.
- Consultar agenda pessoal como união das atividades próprias com reuniões dos projetos atuais, eliminando repetições. Não copiar reuniões para cada usuário.
- Atualizar texto/metadados e versão com condição atômica `WHERE id = ? AND versao = ?`. Zero linhas alteradas gera conflito, sem sobrescrita.
- Bloquear exclusão de fonte ou arquivo referenciado no documento, com explicação dos usos. Revalidar referências no salvamento; IDs precisam pertencer ao mesmo projeto. Para excluir, remover antes os usos no editor e salvar.
- Não expor exclusão de contas ou projetos nesta entrega. Exclusões de recursos filhos autorizadas devem preservar integridade referencial.

## 6. Sessão, autorização e segurança

O módulo básico autentica e pede ao serviço de sessão do núcleo para associar o usuário à sessão. Usar senha com `crypto.scrypt` assíncrono, salt aleatório e parâmetros explícitos, comparação constante e tamanho de senha de 12 a 128 caracteres. O provisionamento e a troca administrativa de senha devem usar o mesmo serviço. Redefinir senha revoga as sessões do usuário.

Cookie de sessão opaco com entropia de pelo menos 256 bits, `HttpOnly`, `SameSite=Lax`, `Path=/` e `Secure` em HTTPS. Regenerar identificador após login; expirar após 8 horas de inatividade e no máximo 7 dias de existência; logout remove sessão e cookie. Sessões de provedores desabilitados deixam de ser aceitas. O modo HTTP local deve ser configurado explicitamente para não exigir `Secure`.

`GET /api/session` devolve estado da sessão e token CSRF, criando sessão anônima quando necessário. Exigir o token em cabeçalho e verificar origem nas operações mutáveis, inclusive login/logout. Responder login inválido com mensagem genérica, preservando os campos apropriados e limitando tentativas por IP/conta com HTTP 429. Nunca registrar senha, cookies, chave externa ou conteúdo integral de documentos nos logs.

| Operação | Quem pode executar |
| --- | --- |
| Consultar diretório e perfil público de professor | Qualquer usuário autenticado. |
| Alterar perfil/foto/agenda pessoal | Somente o próprio usuário. Biografia e sugestões apenas para professor. |
| Enviar proposta / listar propostas enviadas | Aluno autor. |
| Listar propostas recebidas / aceitar / rejeitar | Professor destinatário. |
| Ler/editar projeto, fontes, arquivos, reuniões e exportar | Membros atuais do projeto. |
| Adicionar/remover membros | Professor já orientador do projeto. |
| Ler/marcar notificações | Somente o destinatário. |
| Instalar/remover módulos ou provisionar contas | Operador com acesso ao servidor/CLI. |

O diretório não expõe agenda detalhada nem e-mails de terceiros. A busca para adicionar membros retorna apenas ID, nome e papel, é paginada e restrita a orientadores. Na visão de ocupação de um projeto, mostrar horários e participante ocupado; ocultar descrições de atividades pessoais e de outros projetos.

Validar IDs, tamanhos, papéis, URLs e conteúdo em todas as rotas; não confiar no proprietário informado pelo cliente. Usar consultas parametrizadas. Renderizar somente nós/marcas RichText permitidos; escapar texto, sanitizar HTML colado e proibir scripts/handlers/URLs `javascript:`. Links externos usam protocolos HTTP(S) e isolamento de janela. Links de notificação são rotas internas conhecidas.

Limites iniciais configuráveis: corpo JSON de 2 MiB, documento serializado de 1 MiB, upload de 10 MiB por arquivo, foto de 2 MiB, 100 MiB em arquivos por projeto. Aceitar PDF, TXT, BibTeX e imagens PNG/JPEG/WebP; verificar conteúdo/MIME, bloquear SVG/HTML/executáveis. Fotos aceitam somente os formatos de imagem listados. Downloads exigem autorização e cabeçalho apropriado; não expor diretório estático de anexos.

## 7. Contratos HTTP e telas

### 7.1 Convenções da API

API JSON sob `/api`; datas UTC ISO 8601 e horários semanais em minutos. DTOs validados em `packages/shared`. Erros usam `{ erro: { codigo, mensagem, campos?, detalhes? } }`, sem stack trace para cliente. Usar 400 para entrada inválida, 401 sem sessão, 403 para papel inadequado, 404 para recurso inexistente/inacessível, 409 para conflitos de versão/agenda/recurso, 413 para excesso de tamanho, 429 para limites e 503 para dependência externa indisponível.

Coleções grandes usam paginação com `pagina`, `limite` (padrão 20, máximo 100), total e ordenação estável. Criações retornam 201 com recurso; alterações 200; exclusões 204. Documentar corpos de requisição/resposta e códigos em OpenAPI durante a implementação.

| Grupo | Rotas mínimas |
| --- | --- |
| Infraestrutura | `GET /api/health`, `GET /api/capabilities`, `GET /api/session`, `POST /api/logout`. |
| Autenticação básica | `POST /api/login` com e-mail e senha, registrada pelo módulo. |
| Perfil | `GET/PATCH /api/me`, `PUT/DELETE /api/me/foto`, `GET /api/usuarios/:id/foto` com política de visibilidade. |
| Professores | `GET /api/professores`, `GET /api/professores/:id`. Filtros: texto, dias, início e fim. |
| Propostas | `GET/POST /api/propostas`, `POST /api/propostas/:id/aceitar`, `POST /api/propostas/:id/rejeitar`. GET filtra pelo papel e usuário autenticado. |
| Projetos | `GET /api/projetos`, `GET/PATCH /api/projetos/:id`, `PUT /api/projetos/:id/documento`. Edições recebem versão esperada. |
| Membros | `GET /api/projetos/:id/candidatos`, `POST/DELETE /api/projetos/:id/membros/:usuarioId`; alterações recebem versão esperada do projeto. |
| Agenda | `GET /api/me/agenda`, `POST /api/me/atividades`, `PATCH/DELETE /api/me/atividades/:id`. |
| Reuniões | `GET/POST /api/projetos/:id/reunioes`, `PATCH/DELETE /api/projetos/:id/reunioes/:reuniaoId`, `GET /api/projetos/:id/ocupacao`. |
| Fontes | `GET/POST /api/projetos/:id/fontes`, `PATCH/DELETE /api/projetos/:id/fontes/:fonteId`, `POST /api/projetos/:id/fontes/importar-bibtex`. |
| Busca externa | `GET /api/projetos/:id/busca-referencias?q=...&pagina=...`, registrada pelo módulo. |
| Arquivos | `GET/POST /api/projetos/:id/arquivos`, `GET/DELETE /api/projetos/:id/arquivos/:arquivoId`; opção inline apenas para imagens permitidas. |
| Notificações | `GET /api/notificacoes`, `PATCH /api/notificacoes/:id`, `POST /api/notificacoes/marcar-todas-lidas`. |
| Exportação | `POST /api/projetos/:id/exportacoes/pdf` com versão esperada, registrada pelo módulo; retorna `application/pdf`. |

Atualizações/exclusões de atividades, reuniões e fontes também exigem versão esperada. A inclusão de fonte tem deduplicação; a submissão de proposta tem unicidade; criação de reunião/arquivo usa chave de idempotência para repetição após falha de rede. Registrar resultado dessas chaves por usuário/operação, com expiração de 24 horas, em tabela de infraestrutura criada para esse fim.

### 7.2 Navegação e estados

Telas: entrada pública com botões de módulos; `/autenticacao`; início autenticado com projetos e notificações; perfil; diretório e detalhe de professor; propostas enviadas/recebidas; grade semanal; projeto com abas de escrita, fontes, arquivos, reuniões e membros; lista de notificações. Busca bibliográfica aparece lateralmente na escrita e exportação como ação contribuída por módulo.

Cada tela deve tratar carregamento, vazio, sucesso, validação, erro recuperável e sessão expirada. Manter foco e rótulos de formulários, contraste adequado e navegação por teclado. Arraste sempre tem alternativa por botão/formulário, inclusive em telas pequenas. Não usar dados demonstrativos em telas reais quando a API retorna vazio ou erro.

## 8. Comportamentos detalhados

### 8.1 Diretório, propostas e notificações

Biografia e sugestões usam editor RichText limitado. Busca textual é insensível a caixa e acentos, sobre texto visível de nome, biografia e sugestões; todos os termos informados devem aparecer no conjunto pesquisado. Manter versão normalizada para busca, sem pesquisar JSON bruto. Aplicar paginação depois dos filtros, com nome/ID como ordenação estável.

Filtro semanal aceita conjunto de dias e um intervalo válido. Comparar com atividades próprias e reuniões, usando a mesma função de sobreposição de reuniões. Mostrar contadores de projetos aceitos ainda existentes e propostas atualmente pendentes.

Aluno submete título e descrição ao professor selecionado. Notificação ao professor aponta para a lista de propostas. Aceite cria projeto e notifica o aluno com link para ele; rejeição exige motivo e gera notificação que continua legível após apagar a proposta. A lista se atualiza depois da operação e trata item já processado por outra aba.

Notificações persistem no banco, podem ser marcadas como lidas e são consultadas a cada 30 segundos enquanto a aplicação está visível, além de ao receber foco. Após criação/edição/exclusão de reunião, notificar os demais membros com dia, horário, descrição e natureza da alteração, na mesma transação da mudança. Não notificar o próprio autor da ação. Evitar duplicatas em repetição de requisição.

### 8.2 Agenda e reuniões

Grade cobre 00:00–24:00 em passos de 15 minutos. Início/fim precisam ser múltiplos de 15, `0 <= inicio < fim <= 1440`; não aceitar atividade atravessando meia-noite, instruindo a dividir em dois dias. Criação por arraste preenche formulário; edição permite alterar dia/horários/descrição; exclusão exige ação clara. Atividades de projetos aparecem com indicação do projeto e abrem a gestão de reuniões, sem serem editadas pela API de atividade pessoal.

Dois intervalos conflitam quando estão no mesmo dia e `inicioA < fimB && inicioB < fimA`. Ao editar reunião, excluir ela própria da consulta. Verificar todos os membros, incluindo quem está realizando a ação; isso amplia o aviso previsto para os outros participantes.

Ao enviar reunião com conflitos, retornar 409 `CONFLITO_DE_HORARIOS`, lista sem descrições privadas e token assinado da confirmação, ligado a usuário/projeto, conteúdo da operação, versões das atividades conflitantes e participantes. Não salvar nem notificar ainda. Interface oferece “Voltar e ajustar” e “Salvar mesmo assim”. No segundo envio, verificar token com validade de 5 minutos e recalcular conflitos dentro da transação de gravação. Se o conteúdo, participantes ou conflitos mudaram, pedir nova confirmação; se continuam iguais, salvar com registro da confirmação. Sem conflitos, salvar diretamente. Não aceitar um simples booleano enviado antecipadamente como confirmação.

Conflitos com atividades pessoais são permitidos após confirmação e não removem nem alteram as atividades existentes. Ao adicionar um membro ao projeto, informar sobre conflitos das reuniões já existentes, sem cancelar reuniões automaticamente.

### 8.3 Escrita, metadados e salvamento

Persistir RichText como árvore JSON versionada, e não HTML arbitrário. Separar título do documento dos níveis de seções. Editor deve oferecer parágrafos, listas, negrito/itálico, citações diretas em bloco/inline, inserção de fonte, figuras com legenda e texto alternativo, tabelas com cabeçalho/legenda, acrônimos com expansão, seções/subseções/subsubseções e referências internas a elementos por ID estável.

Referências bibliográficas no texto são nós ligados ao ID da fonte, com localizador opcional (por exemplo, página). Adotar numeração em ordem da primeira ocorrência e bibliografia correspondente; não prometer formatação normativa específica. Acrônimos mostram a expansão na primeira ocorrência e geram lista de siglas. Seções usam níveis 1–3 e numeração hierárquica; figuras/tabelas e referências internas atualizam rótulos após reordenação. Evitar IDs repetidos ao duplicar nós. Validar citações e arquivos pelo projeto.

Resumos PT/EN usam subconjunto do editor sem anexos/citações; título inglês e listas de palavras-chave são campos próprios. Permitir campos incompletos durante a escrita, sinalizando na exportação quando relevantes, sem impedir o salvamento.

Salvar após 2 segundos sem alterações e, durante edição contínua, no máximo a cada 15 segundos. Serializar as gravações por projeto; cada requisição carrega versão e snapshot local. Se houver nova edição enquanto uma gravação está em andamento, manter estado sujo e enviar o próximo snapshot após confirmação. Uma resposta antiga nunca deve marcar texto mais novo como salvo.

Mostrar “Alterações pendentes”, “Salvando”, “Salvo” ou erro. Manter rascunho em IndexedDB por usuário/projeto/versão, com indicação de recuperação após falha. Em 409, suspender salvamento automático, preservar rascunho e apresentar versões local/remota para escolha ou conciliação manual; salvar a versão conciliada contra a versão remota atual. Não reenviar automaticamente usando uma versão nova sem intervenção do usuário.

Ao mudar de rota, tentar concluir gravação e pedir confirmação de saída somente se persistirem mudanças não salvas. `beforeunload` é aviso complementar, sem depender dele para salvar. Logout remove rascunhos após resolver pendências; expiração de sessão conserva recuperação isolada pelo ID do usuário e não a apresenta a outra conta. Testar duas abas e reconexão.

### 8.4 Fontes e Google Scholar

Decisão de integração: usar **SerpApi Google Scholar** por adaptador no servidor, com `engine=google_scholar`, consulta, idioma e paginação. O provedor documenta resultados estruturados e exige chave privada: [documentação do provedor](https://serpapi.com/google-scholar-api). Trata-se de serviço terceiro, não API oficial do Google; sua conta/chave é uma dependência operacional que pode ter custo.

Implementar interface `ProvedorBibliografico.buscar()` e adaptador real, encapsulados em `busca-scholar`. Não embutir a página do Google em iframe nem fazer raspagem própria. O painel exibe resultados retornados pelo adaptador, com indicação de origem e link externo para a publicação/consulta. O arraste acontece entre os cartões de resultado e a lista de fontes dentro da aplicação, preservando o gesto do caso de uso.

Usar `SERPAPI_API_KEY` exclusivamente no servidor, timeout de 10 segundos, cache de consultas de 10 minutos e limite inicial de 20 buscas/minuto/usuário. Tratar ausência de chave, timeout, quota, resposta inválida e indisponibilidade sem expor credenciais. Não adquirir assinatura nem inventar chave durante implementação.

Ao soltar um resultado ou acionar “Adicionar fonte”, validar metadados, mostrar campos ausentes para complementação e persistir a fonte. Resultados arrastados não são confiáveis: revalidar título, autores, URL, publicação e IDs. Identificação de duplicata usa DOI, depois provedor/ID, depois título normalizado + autores + publicação; permitir decisão explícita quando a correspondência for apenas aproximada.

Metadados ausentes permanecem desconhecidos. Gerar BibTeX mínimo a partir dos campos disponíveis, com chave estável e escape correto, ou preservar BibTeX importado. Incluir formulário manual e importação de arquivo/texto BibTeX com parser de biblioteca mantida, validando uma ou múltiplas entradas, sem parser baseado apenas em regex. Esses recursos pertencem à base.

Sem chave, desabilitar a busca integrada com explicação, mantendo fontes, importação manual e botão para abrir pesquisa no Scholar em outra aba. Esse modo degradado não conta como validação do cenário integrado. Testes automatizados usam fixtures na fronteira HTTP do provedor; a homologação ao vivo depende de credencial configurada e deve ser reportada separadamente.

### 8.5 Arquivos e PDF

Upload persiste bytes no SQLite, conforme `Arquivo.conteudo: Blob`, com listagem por nome/tamanho/tipo e download autenticado. Imagens do editor apontam para IDs de anexos, sem base64 embutido no documento. Upload e registro são uma operação atômica; falha não deixa arquivo parcial. Apresentar limite e erros de tamanho/tipo ao usuário.

O módulo `exportacao-basica` registra método `exportacao-basica.exportarPDF` e rota HTTP que verifica acesso, obtém snapshot consistente e invoca o método pelo registro. A entrada cliente registra botão de exportação. Concluir salvamento pendente antes de exportar; recusar versão divergente com 409.

Gerar HTML seguro a partir do mesmo modelo de documento, com estilos de impressão, e produzir bytes PDF via Chromium/Playwright. A API de geração é descrita em [Playwright `page.pdf()`](https://playwright.dev/docs/api/class-page#page-pdf). Incluir título/autores/orientadores, resumos/palavras-chave disponíveis, texto, figuras, tabelas, lista de siglas e bibliografia. Usar papel A4, margens de 25 mm, fonte legível e paginação; cabeçalhos de tabelas repetidos e controle de quebra para legendas e títulos.

Renderizar anexos a partir de bytes já autorizados no snapshot; bloquear acesso de rede do navegador de exportação e execução de scripts oriundos do conteúdo. Não visitar URLs de fontes nem endereços arbitrários. Limitar geração a duas simultâneas e timeout de 30 segundos, fechando página/contexto em `finally`. Erros devolvem resposta útil sem corromper projeto. Verificar PDF multipágina, acentos, tabelas longas e figuras; a geração de um arquivo não basta sem inspecionar o resultado.

## 9. Sequência de implementação com entregas verificáveis

Executar nesta ordem; etapas posteriores podem acrescentar testes às anteriores. Cada etapa termina com comportamento utilizável e verificado, sem deixar um fluxo central apenas como placeholder.

| Etapa | Trabalho | Critério de conclusão |
| --- | --- | --- |
| 1 — Fundação | Conferir UML/ambiente; criar workspaces, TypeScript, Vite/Vue, Express, lint/format, configuração e scripts. | Cliente e servidor iniciam; health responde; typecheck e build passam; UML intactos. |
| 2 — Domínio e banco | Entidades, DTOs, erros, migrações, repositórios, transações, FK/índices e seed separado. | Banco vazio migra; segunda execução não altera indevidamente; dados sobrevivem reinício; rollback funciona. |
| 3 — Registros e módulos | SDK, manifestos, ordenação, catálogo cliente, rotas/métodos/eventos, capacidades e validação de configuração. | Módulo de teste acrescenta tela/aba/rota/método sem editar núcleo; erros de configuração são detectados. |
| 4 — Sessão e autenticação | Sessões, CSRF, provisionamento CLI, módulo básico cliente/servidor, guardas e perfil. | Fluxos dos dois diagramas de autenticação executam; aluno/professor entram e saem; credenciais inválidas são tratadas. |
| 5 — Horários e diretório | Agenda pessoal completa, perfil de professor, contadores e filtros de texto/disponibilidade. | Arraste e formulário persistem; filtros consideram indisponibilidades com a regra definida. |
| 6 — Propostas e projetos | Envio, notificações, aceite/rejeição transacional, lista de projetos e manutenção de membros. | Aceite cria um único projeto; rejeição preserva motivo em notificação; cardinalidades/autorização verificadas. |
| 7 — Reuniões | Ocupação conjunta, CRUD, confirmação de conflitos e notificações. | Ajustar/cancelar/ignorar funcionam; mudança concorrente exige nova confirmação; agenda reflete reuniões. |
| 8 — Escrita e arquivos | Editor completo, metadados, anexos, fontes manuais/BibTeX, referências, autosave e rascunhos. | Todos os elementos sobrevivem reload; dois clientes não se sobrescrevem; vínculos inválidos são rejeitados. |
| 9 — Busca bibliográfica | Adaptador SerpApi, painel modular, arraste/alternativa acessível, erros e modo degradado. | Testes com respostas controladas passam; com chave, busca real e cadastramento validados; sem chave, limitação explicitada. |
| 10 — PDF | Módulo cliente/servidor, renderer compartilhado, estilos e download. | PDF real corresponde ao documento salvo e tem inspeção visual satisfatória. |
| 11 — Integração e operação | E2E completos, remoção/reinstalação de módulos, instalação limpa, documentação, build e execução de produção. | Matriz abaixo atendida, scripts reproduzíveis e dependências externas descritas honestamente. |

Resolver primeiro o contrato de RichText e de extensões na etapa 3, mesmo que o editor completo venha depois. Implementar notificações já na etapa 6; não postergar um requisito necessário a propostas e reuniões. Exportação deve consumir o mesmo contrato que o editor, evitando divergências de representação.

## 10. Estratégia de verificação e matriz de aceite

Testes unitários concentram-se em regras com ramificações: intervalos, normalização, hierarquia/numeração, validação de documento, deduplicação, carregamento de módulos e transições de salvamento. Testes de integração exercitam Express, sessão e SQLite reais temporários. E2E cobrem jornadas completas em navegador, sem substituir banco/API por mocks. Somente a fronteira do provedor externo é simulada na execução determinística.

| ID | Cenário e evidência esperada |
| --- | --- |
| A01 | Login válido de aluno e professor, inválido, expiração, restauração após reload e logout; sessão é renovada no login e inacessível depois de revogada. |
| A02 | Dois callbacks contribuem para a mesma lista de botões via evento; tela registrada abre; POST registrado pelo módulo autentica; rota não existe quando módulo é removido. |
| A03 | Adicionar módulo de teste em configuração habilita tela, aba do editor, rota e método sem alterar núcleo. Desabilitar e reconstruir/reiniciar remove contribuições e conserva dados. |
| A04 | ID/rota/método duplicado, ciclo, versão incompatível, erro de migração e divergência cliente/servidor produzem diagnóstico, sem inicialização parcialmente utilizável. |
| A05 | Agenda permite arraste, edição e exclusão próprias; domingo/sábado, limites 00:00/24:00 e extremidades adjacentes funcionam; reuniões não podem ser alteradas como atividades pessoais. |
| A06 | Diretório filtra texto com caixa/acentos e horários; reuniões de outros projetos bloqueiam disponibilidade; contadores não duplicam projetos com múltiplos membros. |
| A07 | Aluno envia propostas a dois professores; duplicata para o mesmo professor é rejeitada; destinatário recebe notificação. |
| A08 | Aceite cria projeto com aluno/professor e apaga proposta; chamadas concorrentes não duplicam projeto; falha de transação desfaz também vínculos/notificações. |
| A09 | Rejeição exige motivo, apaga proposta e mantém notificação legível; outro professor não pode aceitar/rejeitar. |
| A10 | Projeto suporta múltiplos alunos/professores; somente orientador altera membros; último autor/orientador não pode ser removido; não membro não acessa dados. |
| A11 | Reunião sem conflito salva e notifica somente demais membros. Com conflito, nada é salvo antes da confirmação; recuo preserva formulário; confirmação válida salva. |
| A12 | Reunião ignora a si mesma na edição; token alterado/expirado e conflito novo exigem revalidação; detalhes pessoais não vazam; exclusão atualiza agendas/notificações. |
| A13 | Editor persiste citações, referências, figuras, tabelas, acrônimos e três níveis de seção, incluindo reordenação, metadados e acentos; abre contribuições de módulo. |
| A14 | Autosave funciona com digitação contínua; resposta atrasada não apaga estado sujo; falha/reload recupera rascunho; dois clientes recebem 409 e conciliam sem perda silenciosa. |
| A15 | Busca retorna resultados controlados; arraste e botão cadastram fonte; duplicatas e metadados parciais são tratados; BibTeX com várias entradas é importado. Teste ao vivo separado quando houver chave. |
| A16 | Sem chave/quota/rede, painel comunica erro e permite fontes manuais; chave não aparece no bundle/logs; não há resultados fictícios em produção. |
| A17 | Upload/download mantém bytes, limita tamanho/tipo e acesso; referência a fonte/anexo de outro projeto é rejeitada; exclusão de item utilizado é bloqueada. |
| A18 | PDF contém conteúdo e bibliografia corretos, imagens, caracteres PT/EN, tabelas e páginas legíveis; documento de outro projeto/versão divergente não é exportado. |
| A19 | CSRF inválido, tentativa de SQL injection, RichText com script, URL perigosa, acesso por ID de outro usuário e abuso de login são rejeitados/tratados. |
| A20 | Em instalação limpa, migração, provisionamento, build e start funcionam seguindo README; reinício preserva banco/sessões válidas; cliente abre links profundos e API desconhecida retorna erro JSON. |

Dados de teste devem incluir pelo menos três alunos, três professores, projeto com vários autores/orientadores, professor sem atividades, propostas simultâneas, conflitos parciais/totais e documento multipágina com todos os elementos.

Ao final, executar `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:integration`, `npm run test:e2e` e `npm run build`; iniciar também o artefato de produção. Criar esses comandos no repositório e garantir que falhas retornem código diferente de zero. Não declarar teste externo ou inspeção visual como concluído quando não foi executado.

## 11. Operação e entregáveis finais

Entregar código completo, lockfile, migrações, SDK e módulos, testes, `.env.example`, configurações de módulos, README e documentação de API/extensão. O README deve permitir partir de diretório recém-obtido e conter:

1. Versões suportadas, instalação com `npm ci` e instalação do Chromium para testes/exportação.
2. Variáveis `PORT`, `DATABASE_PATH`, `APP_ORIGIN`, `APP_TIMEZONE`, segredo de assinatura de confirmações, parâmetros de cookie/HTTPS e `SERPAPI_API_KEY`. O segredo de assinatura é persistente entre reinícios, obrigatório em produção e nunca embutido no cliente.
3. Migração explícita e idempotente, provisionamento de aluno/professor, seed opcional de demonstração e execução em desenvolvimento.
4. Build e execução do servidor de produção servindo a SPA; proxy TLS e configuração de origem quando aplicáveis.
5. Como instalar, habilitar, desabilitar, atualizar e remover módulos nos dois lados, com exemplo real de módulo pequeno e explicação das APIs públicas.
6. Backup consistente do SQLite, incluindo a estratégia para WAL: usar backup online do banco ou parar o serviço antes de copiar. Restaurar somente com serviço parado e verificar compatibilidade de migrações antes de retomar.
7. Como executar testes, onde estão fixtures, limites configurados, formato de RichText e estratégia de recuperação de conflitos.
8. Como configurar e verificar a busca real; distinguir disponibilidade do adaptador implementado de homologação ao vivo dependente de credenciais.

O servidor fecha conexões e recursos de exportação ao encerrar. Logs identificam requisição, módulo e falha sem conteúdos sensíveis. A implantação inicial é uma instância de Express com SQLite em volume persistente; não projetar múltiplos servidores gravando o mesmo arquivo em rede.

Considerar a entrega concluída somente quando os sete casos de uso, os dois fluxos de autenticação, as entidades/cardinalidades relevantes e a exportação estiverem implementados e verificados, com modularidade demonstrada. Uma chave externa ausente deve aparecer como pendência de homologação, nunca ser ocultada por mock. Não exigir autorização adicional para decisões técnicas já fixadas neste plano; ajustes inevitáveis por incompatibilidade de versão devem ser documentados com motivo e manter os critérios de aceite.

## 12. Referências técnicas e estado inicial observado

- [Vue: criação de aplicação](https://vuejs.org/guide/quick-start.html#creating-a-vue-application).
- [Express 5: instalação e TypeScript](https://expressjs.com/en/5x/starter/installing/).
- [Node.js: SQLite](https://nodejs.org/api/sqlite.html).
- [Tiptap: integração Vue 3](https://tiptap.dev/docs/editor/getting-started/install/vue3).
- [SerpApi: Google Scholar](https://serpapi.com/google-scholar-api).
- [Playwright: geração de PDF](https://playwright.dev/docs/api/class-page#page-pdf).
- [Mermaid: documentação de referência fornecida pelo solicitante](https://mermaid.ai/open-source/intro/), para consulta se for necessário interpretar ou renderizar os diagramas; não foi necessário renderizá-los para este plano.

No levantamento inicial, o diretório continha somente os três diagramas e os sete arquivos de casos de uso; não havia aplicação, `package.json` ou repositório Git inicializado detectável. Foram observados Node.js 26.13.0 e npm 11.20.0, e a importação de `node:sqlite` foi verificada com banco apenas em memória. As páginas técnicas consultadas são referências de API, enquanto as escolhas de arquitetura e comportamento neste documento são decisões do projeto.
