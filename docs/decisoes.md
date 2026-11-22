# Decisões e limites operacionais

O escopo funcional segue `plano_de_execucao.md`. Os documentos UML e os sete casos de uso originais permanecem intactos.

- Interface denominada **Trama**; português, CSS local, layout responsivo, alternativas de formulário ao arraste. Sem serviços de imagem, fontes remotas ou dados fictícios em produção.
- Aplicação local Node/Express + SQLite, sem publicação em hospedagem externa. A arquitetura prescrita exige processos Node e Chromium e persistência em volume; não foi convertida para Workers.
- Node 26.13.0 e npm 11.20.0 verificados no executor. O adaptador usa `node:sqlite.Database` em execução; `@types/node` ainda nomeia esse mesmo contrato `DatabaseSync`. O alias aparece somente na anotação de tipos, sem usar o construtor obsoleto.
- Vitest atualizado para 5.1.0. Overrides de `glob` e `minimatch` eliminam alertas transitivos nas ferramentas de desenvolvimento. O lockfile fixa a árvore testada.
- A recuperação local usa IndexedDB por conta, projeto, aba e versão-base. Uma aba não apaga o rascunho de outra ao salvar. Ao iniciar, recupera preferencialmente o rascunho da própria aba; se ela foi fechada, oferece o mais recente do mesmo usuário/projeto.
- Não há edição em tempo real. Conflito 409 suspende o autosave; a interface mostra as versões e exige escolha humana. O texto local pode ser conciliado no editor antes de enviar contra a versão atual.
- O PDF usa apresentação acadêmica básica, sem declaração de conformidade ABNT. O texto é renderizado pelo mesmo contrato da prévia, em HTML escapado. Chromium não executa scripts nem acessa a rede.
- Busca usa SerpApi, terceiro que consulta Google Scholar. Não é uma API oficial do Google. A integração real está implementada, mas a homologação externa requer uma chave fornecida pelo operador. Testes determinísticos substituem somente a fronteira HTTP do provedor.
- Autenticação, busca e exportação são removíveis; usuários, fontes e arquivos pertencem à base. Migrações desabilitadas não são desfeitas e tabelas não são apagadas.
- A implantação suporta uma instância Express, SQLite em disco local e TLS em proxy reverso. O servidor escuta em loopback; o proxy deve encaminhar a origem pública e limitar acesso direto.
