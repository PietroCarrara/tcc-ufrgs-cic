# Documento, salvamento e colaboração

## RichText v1

Persistimos JSON, nunca HTML arbitrário. A raiz é `{ "type": "doc", "schemaVersion": 1, "content": [...] }`. O contrato e renderer compartilhados ficam em `packages/shared/src`.

| Nó                                              | Uso / atributos                                                                      |
| ----------------------------------------------- | ------------------------------------------------------------------------------------ |
| `paragraph`, `text`                             | Texto e parágrafos; `text` contém string                                             |
| `heading`                                       | `level: 1–3`, `id` estável; o título do projeto é separado                           |
| `bulletList`, `orderedList`, `listItem`         | Listas; ordenada pode conter `start`                                                 |
| `blockquote`, marca `directQuote`               | Citação direta em bloco ou inline                                                    |
| `hardBreak`, `horizontalRule`                   | Quebra e separador                                                                   |
| `citation`                                      | Inline, `sourceId` do projeto, `locator` opcional                                    |
| `figure`                                        | Bloco, `id`, `fileId` de imagem do projeto, `caption`, `alt`                         |
| `table`, `tableRow`, `tableHeader`, `tableCell` | Tabela com `id`, `caption`; células com `colspan`, `rowspan`, `colwidth`, `align`    |
| `acronym`                                       | Inline, `short`, `expansion`                                                         |
| `internalReference`                             | Inline, `targetId` de seção/figura/tabela                                            |
| `opaque` / `opaqueInline`                       | Bloco ou elemento inline não editável, `original` de extensão indisponível e `label` |

Marcas: `bold`, `italic`, `strike`, `underline`, `code`, `link` HTTP(S), `directQuote`. Conteúdo colado passa pelo esquema Tiptap. O servidor revalida estrutura, nós/marcas, atributos, tamanho, IDs, fontes e anexos. URLs perigosas e HTML executável são rejeitados ou escapados.

Resumos, biografia e sugestões usam subconjunto sem anexos, fontes ou seções. Títulos PT/EN e listas de palavras-chave são campos próprios. Metadados incompletos podem ser salvos; a exportação alerta antes de continuar.

Referências bibliográficas são numeradas pela primeira ocorrência, com bibliografia correspondente. Seções têm numeração hierárquica; figuras/tabelas e referências internas são recalculadas na prévia e exportação. O editor gera IDs únicos ao inserir/duplicar elementos. Siglas expandem na primeira ocorrência na prévia/PDF e produzem lista de siglas.

Nós de extensão sem implementação ativa são convertidos em conteúdo opaco, exibidos com aviso e preservados. O servidor permite somente payloads opacos já existentes no documento; não permite introduzir ou alterar arbitrariamente esse conteúdo pelo editor base. Nunca descarte payloads de módulos durante migração ou remoção.

## Salvamento

O editor salva após dois segundos de inatividade ou até quinze segundos de digitação contínua. Há uma única requisição pendente por instância do projeto. Cada snapshot tem revisão local e versão-base do servidor. A confirmação de um snapshot antigo não marca edições posteriores como salvas; elas são enviadas em seguida.

O servidor atualiza usando `WHERE id = ? AND versao = ?` em transação. Toda alteração de texto/metadados ou membros invalida a versão. `409 VERSAO_DIVERGENTE` suspende o autosave. A interface mantém o texto local, carrega a versão remota e permite editar/conciliar, salvar a versão conciliada contra a versão atual, ou adotar a remota. Uma nova concorrência gera outro conflito, nunca reenvio silencioso.

Estados: alterações pendentes, salvando, salvo, erro e conflito. Falhas de rede não eliminam conteúdo. IndexedDB mantém rascunhos por conta/projeto/aba/versão-base. Ao reabrir, a interface pede decisão explícita sobre recuperação. Rascunhos de outra conta não são apresentados. Expiração de sessão conserva dados; logout resolve pendências ou exige descarte explícito antes de removê-los.

Ao sair da rota, tenta salvar. Somente se falhar e restarem alterações, pede confirmação de saída. `beforeunload` complementa o fluxo; não há dependência de uma requisição durante fechamento da página.

## Fontes e arquivos

Fontes são compartilhadas por projeto, independentes do módulo de busca. Duplicatas exatas usam DOI normalizado, depois provedor/ID. Correspondência aproximada usa título normalizado + autores + publicação e exige confirmação explícita. Datas parciais e desconhecidas não são completadas com valores inventados.

Importação BibTeX usa Citation.js, aceita uma ou múltiplas entradas e é atômica. Cada fonte pode armazenar BibTeX importado ou mínimo gerado com escape e chave estável. Um erro em qualquer entrada reverte o lote.

Arquivos são BLOBs no SQLite. Upload e registro são atômicos; requisições repetidas usam `Idempotency-Key` por usuário/operação com validade de 24 horas. Downloads verificam associação ao projeto. Imagens no documento referenciam IDs, sem base64 no RichText. Exclusão de fonte/imagem em uso é bloqueada; remova os usos e salve antes de excluir.

## Reuniões e privacidade

Atividades se repetem semanalmente, de domingo (0) a sábado (6), em minutos desde meia-noite e múltiplos de 15. Intervalos adjacentes não conflitam. Ausência de atividades significa disponibilidade. Não existem datas, exceções de feriados ou recorrências complexas.

Em reuniões, o servidor considera todos os membros e responde com conflitos sem descrições privadas. O token HMAC inclui usuário, projeto, conteúdo, participantes e versões das atividades conflitantes e vale cinco minutos. No segundo envio, recalcula tudo dentro da transação. Mudanças invalidam a confirmação. Um booleano antecipado não substitui esse fluxo. Nenhuma notificação é emitida antes da gravação confirmada.
