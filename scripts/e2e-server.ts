import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Servidor } from "../apps/server/src/core/server.js";
import { provisionar } from "../modules/autenticacao-basica/server.js";
import { textoDoc } from "../packages/shared/src/index.js";
const dir = mkdtempSync(join(tmpdir(), "trama-e2e-"));
const s = await new Servidor({
  port: 3107,
  modulesFile: "tmp/e2e/modules.server.json",
  database: join(dir, "app.sqlite"),
  origin: "http://127.0.0.1:3107",
  secret: "e2e-secret-".repeat(5),
  serpapiKey: undefined,
}).inicializar();
for (const [nome, email, papel] of [
  ["Ana Silva", "ana@teste.edu", "aluno"],
  ["Bruno Costa", "bruno@teste.edu", "aluno"],
  ["Clara Alves", "clara@teste.edu", "aluno"],
  ["Marina Oliveira", "marina@teste.edu", "professor"],
  ["Rafael Santos", "rafael@teste.edu", "professor"],
  ["Helena Souza", "helena@teste.edu", "professor"],
] as const) {
  const id = await provisionar(
    s.banco,
    nome,
    email,
    papel,
    "TesteNavegador!2026",
  );
  if (papel === "professor")
    s.dominio.atualizarPerfil(
      s.dominio.usuario(id),
      nome,
      textoDoc("Pesquisa em colaboração e educação"),
      [textoDoc("Escrita acadêmica modular")],
    );
}
const http = s.servir();
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () =>
    http.close(() => {
      void s.close().then(() => {
        rmSync(dir, { recursive: true, force: true });
        process.exit(0);
      });
    }),
  );
