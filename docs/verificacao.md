# Registro de verificação

Verificação final em **11/11/2026**, no ambiente Node 26.13.0 / npm 11.20.0. Os testes usam bancos e contas isolados; não há credenciais de instituição no repositório.

## Comandos e evidências

- `npm run lint`: ESLint com zero avisos permitidos.
- `npm run typecheck`: TypeScript strict no servidor/contratos/scripts/testes e vue-tsc no cliente/SFCs.
- `npm test`: **35 testes unitários** — intervalos, acentos, RichText seguro, numeração, dependências/eventos/telas, salvamento e adaptador SerpApi.
- `npm run test:integration`: **40 testes de integração** — Express e SQLite reais, incluindo migrações e dados em disco, sessão/CSRF, autorização, propostas, rollback, membros, conflitos, fontes, anexos, PDF e módulos.
- `npm run test:e2e`: **6 jornadas completas no Chromium** — API/banco reais; somente a fronteira HTTP da SerpApi é substituída por fixture no cenário de busca determinístico.
- `npm run build`: JavaScript ESM do servidor e bundle Vue de produção. Catálogo padrão restaurado após o build E2E; fixture de módulo não incluída na distribuição normal.
- `node scripts/verify-production.mjs`: instalação em diretório temporário com `npm ci`, duas migrações consecutivas, seed explícito, build, início com `NODE_ENV=production`, autenticação, cookie Secure, rotas profundas da SPA, API 404 JSON, ausência da rota de exemplo, reinício com sessão/projeto preservados e backup SQLite online.
- `npm run provision`: executado em PTY com conta temporária. A senha não apareceu na saída do terminal; a confirmação criou a conta corretamente.
- `npm audit`: zero vulnerabilidades conhecidas na árvore resolvida. O lockfile faz parte da entrega.

## Matriz de aceite

| Plano | Evidência                                                                                                                                                                         |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A01   | Integração de sessão válida/inválida, rotação, expiração, revogação por senha/logout e reinício; E2E de login/reload/logout.                                                      |
| A02   | Dois callbacks mutam a mesma lista, tela registrada e login modular; provedor alternativo autentica sem tabela/rota do módulo básico.                                             |
| A03   | Fixture instala tela/aba/navegação/rota/método/migração; teste de desabilitar, reabilitar e preservar tabela. E2E usa build configurado, sem editar núcleo.                       |
| A04   | Testes de duplicatas, ciclos, dependências/versões, colisões e falha de migração/inicialização. Cliente verifica protocolo/capacidades e exibe diagnóstico.                       |
| A05   | Grade por arraste, edição/exclusão no navegador; fronteiras 00:00/24:00, domingo/sábado, sobreposição e autorização na integração.                                                |
| A06   | Busca com acentos/caixa, contadores distintos e filtros incluindo reuniões; regra de um dos dias/intervalo inteiro verificada.                                                    |
| A07   | Propostas simultâneas, duplicata por par, restrição de papel e notificação.                                                                                                       |
| A08   | Aceites concorrentes, projeto único, vínculos e remoção; trigger de falha comprova rollback.                                                                                      |
| A09   | Motivo obrigatório, contexto legível após remoção e autorização do destinatário.                                                                                                  |
| A10   | Vários autores/orientadores, versão alterada, restrição ao orientador, mínimo de membros e isolamento.                                                                            |
| A11   | Aviso sem gravação/notificação, confirmação, criação e notificação somente dos demais; jornada E2E com conflito.                                                                  |
| A12   | Token adulterado, mudança de operação/atividade e expiração; exclusão da própria reunião na comparação; exclusão refletida na agenda.                                             |
| A13   | E2E cria três níveis de seção, fonte, figura, tabela, sigla, referência interna e metadados; tudo persiste após reload. Conteúdo opaco testado separadamente.                     |
| A14   | Unitários de debounce/limite contínuo/resposta atrasada; E2E com duas abas, 409, escolha explícita, falha de rede, reload e rascunho.                                             |
| A15   | Adaptador HTTP real exercitado com fixture; E2E de pesquisa, arraste e botão; duplicatas, datas desconhecidas e importação BibTeX múltipla.                                       |
| A16   | Sem chave, quota, timeout, erro HTTP e resposta inválida; painel degradado verificado no navegador. Chave é exclusiva do servidor.                                                |
| A17   | Bytes preservados, limites, assinatura/tipo, arquivo truncado, UTF-8 inválido, fotos, acesso, idempotência e bloqueio de exclusão em uso.                                         |
| A18   | PDF real de cinco páginas, título/autores/orientadores, resumos PT/EN, acentos, níveis de seção, figura, tabela de 70 linhas, siglas e bibliografia; acesso e versão verificados. |
| A19   | CSRF/origem, SQL injection, nós/URLs perigosos, IDs de terceiros e limitação de login exercitados.                                                                                |
| A20   | Instalação limpa, migração idempotente, CLI, build/start de produção, links profundos, reinício e backup verificados.                                                             |

## Inspeção visual

As capturas `output/e2e-projeto.png` e `output/e2e-mobile.png` foram inspecionadas. A largura móvel de 390 px não apresenta overflow horizontal da página; menus e abas usam rolagem própria.

O teste de PDF gera `output/pdf/validacao-academica.pdf`. Todas as cinco páginas foram renderizadas com Poppler e inspecionadas: texto legível, imagem visível, cabeçalhos de tabela repetidos, linhas sem sobreposição, legendas, bibliografia e paginação. O primeiro teste detectou excesso de espaço em células; o CSS final remove margens de parágrafos nas células e evita cabeçalho isolado do início da tabela. A saída final tem cinco páginas A4. Não se declara conformidade integral com ABNT.

Os arquivos de `output/`, bancos temporários, logs, traces e relatórios de navegador são artefatos locais ignorados. Os testes regeneram as evidências.

## Dependência externa não homologada

**Não foi realizada consulta ao vivo à SerpApi**, pois não foi fornecida uma `SERPAPI_API_KEY`. O adaptador de produção está implementado e seus contratos/erros estão testados. A fixture não é usada em produção e não substitui homologação externa. O roteiro para essa homologação está no README.

A implantação TLS em um domínio institucional também depende da infraestrutura do operador. A execução do artefato de produção foi verificada localmente, com requisições ao backend simulando o encaminhamento do proxy HTTPS; nenhum site foi publicado externamente.
