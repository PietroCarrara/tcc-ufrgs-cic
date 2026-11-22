import * as sqlite from "node:sqlite";
import type { SQLInputValue, DatabaseSync } from "node:sqlite";
// Node 26 renomeou DatabaseSync para Database; o tipo 25 mantém o nome antigo.
const Database = (sqlite as unknown as { Database: typeof DatabaseSync })
  .Database;
import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
export class Banco {
  readonly db: DatabaseSync;
  constructor(path: string) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new Database(path);
    this.db.exec("PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;");
    if (path !== ":memory:") this.db.exec("PRAGMA journal_mode=WAL;");
    this.db.exec(
      "CREATE TABLE IF NOT EXISTS schema_migrations (owner TEXT NOT NULL, version INTEGER NOT NULL, checksum TEXT NOT NULL, applied_at TEXT NOT NULL, PRIMARY KEY(owner,version)) STRICT;",
    );
  }
  all<T = Record<string, any>>(sql: string, ...args: SQLInputValue[]): T[] {
    return this.db.prepare(sql).all(...args) as T[];
  }
  get<T = Record<string, any>>(
    sql: string,
    ...args: SQLInputValue[]
  ): T | undefined {
    return this.db.prepare(sql).get(...args) as T | undefined;
  }
  run(sql: string, ...args: SQLInputValue[]) {
    return this.db.prepare(sql).run(...args);
  }
  transaction<T>(fn: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const result = fn();
      if (result instanceof Promise)
        throw new Error("Transações não podem conter operações assíncronas");
      this.db.exec("COMMIT");
      return result;
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  migrar(owner: string, version: number, sql: string) {
    const checksum = createHash("sha256").update(sql).digest("hex");
    const existing = this.get(
      "SELECT checksum FROM schema_migrations WHERE owner=? AND version=?",
      owner,
      version,
    );
    if (existing) {
      if (existing.checksum !== checksum)
        throw new Error(`Checksum de migração alterado: ${owner}/${version}`);
      return;
    }
    this.transaction(() => {
      this.db.exec(sql);
      this.run(
        "INSERT INTO schema_migrations VALUES (?,?,?,?)",
        owner,
        version,
        checksum,
        new Date().toISOString(),
      );
    });
  }
  close() {
    this.db.close();
  }
}
export function migrarCore(b: Banco) {
  b.migrar(
    "core",
    1,
    `
CREATE TABLE usuarios(id TEXT PRIMARY KEY,nome TEXT NOT NULL,email_normalizado TEXT NOT NULL UNIQUE,papel TEXT NOT NULL CHECK(papel IN ('aluno','professor')),foto BLOB,foto_mime TEXT,criado_em TEXT NOT NULL,atualizado_em TEXT NOT NULL) STRICT;
CREATE TABLE professores(usuario_id TEXT PRIMARY KEY REFERENCES usuarios(id),biografia_json TEXT NOT NULL,sugestoes_json TEXT NOT NULL,busca TEXT NOT NULL) STRICT;
CREATE TABLE sessoes(hash TEXT PRIMARY KEY,usuario_id TEXT REFERENCES usuarios(id),provedor TEXT,csrf TEXT NOT NULL,criado INTEGER NOT NULL,atividade INTEGER NOT NULL,expira INTEGER NOT NULL) STRICT;
CREATE INDEX sessoes_usuario ON sessoes(usuario_id);
CREATE TABLE propostas(id TEXT PRIMARY KEY,aluno_id TEXT NOT NULL REFERENCES usuarios(id),professor_id TEXT NOT NULL REFERENCES professores(usuario_id),titulo TEXT NOT NULL,descricao TEXT NOT NULL,criado_em TEXT NOT NULL,UNIQUE(aluno_id,professor_id)) STRICT;
CREATE TABLE projetos(id TEXT PRIMARY KEY,titulo TEXT NOT NULL,titulo_ingles TEXT NOT NULL DEFAULT '',resumo_json TEXT NOT NULL,resumo_ingles_json TEXT NOT NULL,palavras_json TEXT NOT NULL DEFAULT '[]',palavras_ingles_json TEXT NOT NULL DEFAULT '[]',texto_json TEXT NOT NULL,schema_version INTEGER NOT NULL DEFAULT 1,versao INTEGER NOT NULL DEFAULT 1 CHECK(versao>0),criado_em TEXT NOT NULL,atualizado_em TEXT NOT NULL) STRICT;
CREATE TABLE projeto_autores(projeto_id TEXT NOT NULL REFERENCES projetos(id),usuario_id TEXT NOT NULL REFERENCES usuarios(id),PRIMARY KEY(projeto_id,usuario_id)) STRICT;
CREATE TABLE projeto_orientadores(projeto_id TEXT NOT NULL REFERENCES projetos(id),usuario_id TEXT NOT NULL REFERENCES professores(usuario_id),PRIMARY KEY(projeto_id,usuario_id)) STRICT;
CREATE VIEW membros AS SELECT projeto_id,usuario_id FROM projeto_autores UNION SELECT projeto_id,usuario_id FROM projeto_orientadores;
CREATE TABLE atividades(id TEXT PRIMARY KEY,usuario_id TEXT REFERENCES usuarios(id),projeto_id TEXT REFERENCES projetos(id),dia INTEGER NOT NULL CHECK(dia BETWEEN 0 AND 6),inicio INTEGER NOT NULL CHECK(inicio>=0 AND inicio%15=0),fim INTEGER NOT NULL CHECK(fim<=1440 AND fim%15=0 AND fim>inicio),descricao TEXT NOT NULL,versao INTEGER NOT NULL DEFAULT 1,confirmacao TEXT,criado_em TEXT NOT NULL,atualizado_em TEXT NOT NULL,CHECK((usuario_id IS NULL) != (projeto_id IS NULL))) STRICT;
CREATE INDEX atividades_usuario ON atividades(usuario_id,dia);CREATE INDEX atividades_projeto ON atividades(projeto_id,dia);
CREATE TABLE fontes(id TEXT PRIMARY KEY,projeto_id TEXT NOT NULL REFERENCES projetos(id),titulo TEXT NOT NULL,autores_json TEXT NOT NULL,link TEXT,publicacao TEXT,doi TEXT,provedor TEXT,externo_id TEXT,bibtex TEXT NOT NULL,versao INTEGER NOT NULL DEFAULT 1,criado_em TEXT NOT NULL,atualizado_em TEXT NOT NULL) STRICT;
CREATE INDEX fontes_projeto ON fontes(projeto_id);
CREATE TABLE arquivos(id TEXT PRIMARY KEY,projeto_id TEXT NOT NULL REFERENCES projetos(id),nome TEXT NOT NULL,mime TEXT NOT NULL,tamanho INTEGER NOT NULL CHECK(tamanho>=0),hash TEXT NOT NULL,conteudo BLOB NOT NULL,criador TEXT NOT NULL REFERENCES usuarios(id),criado_em TEXT NOT NULL) STRICT;
CREATE INDEX arquivos_projeto ON arquivos(projeto_id);
CREATE TABLE notificacoes(id TEXT PRIMARY KEY,destinatario TEXT NOT NULL REFERENCES usuarios(id),titulo TEXT NOT NULL,texto TEXT NOT NULL,lida INTEGER NOT NULL DEFAULT 0 CHECK(lida IN (0,1)),link TEXT NOT NULL,tipo TEXT NOT NULL,contexto_json TEXT NOT NULL,criado_em TEXT NOT NULL) STRICT;
CREATE INDEX notificacoes_usuario ON notificacoes(destinatario,lida,criado_em);
CREATE TABLE idempotencia(usuario_id TEXT NOT NULL REFERENCES usuarios(id),operacao TEXT NOT NULL,chave TEXT NOT NULL,fingerprint TEXT NOT NULL,resultado_json TEXT NOT NULL,expira INTEGER NOT NULL,PRIMARY KEY(usuario_id,operacao,chave)) STRICT;
`,
  );
}
