import { it, expect, afterEach } from "vitest";
import request from "supertest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Servidor } from "../../apps/server/src/core/server.js";
import auth, { provisionar } from "../../modules/autenticacao-basica/server.js";
import example from "../fixtures/modulo-exemplo/server.js";
import type { ModuloServidor } from "../../packages/module-sdk/src/server.js";
const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});
const configFile = (ids: string[]) => {
  const dir = mkdtempSync(join(tmpdir(), "trama-modules-"));
  dirs.push(dir);
  const path = join(dir, "modules.json");
  writeFileSync(
    path,
    JSON.stringify({
      packages: ids.map((id) => ({
        id,
        entry:
          id === "exemplo"
            ? "./tests/fixtures/modulo-exemplo/server.ts"
            : `./modules/${id}/server.ts`,
      })),
      enabled: ids,
      options: {},
    }),
  );
  return { dir, path };
};
it("A03 instala rota/método e migração; desabilita e reabilita conservando dados", async () => {
  const { dir, path } = configFile(["autenticacao-basica", "exemplo"]);
  const opts = { database: join(dir, "db.sqlite"), modulesFile: path };
  let s = await new Servidor(opts).inicializar();
  expect(await s.registro.invocarMetodo("exemplo.saudacao", ["Ana"])).toBe(
    "Olá, Ana",
  );
  s.banco.run("INSERT INTO exemplo_dados VALUES(1,?)", "preservado");
  expect((await request(s.app).get("/api/exemplo")).status).toBe(401);
  await s.close();
  writeFileSync(
    path,
    JSON.stringify({
      packages: [
        {
          id: "autenticacao-basica",
          entry: "./modules/autenticacao-basica/server.ts",
        },
        { id: "exemplo", entry: "./tests/fixtures/modulo-exemplo/server.ts" },
      ],
      enabled: ["autenticacao-basica"],
    }),
  );
  s = await new Servidor(opts).inicializar();
  expect((await request(s.app).get("/api/exemplo")).status).toBe(404);
  expect(s.banco.get("SELECT valor FROM exemplo_dados")!.valor).toBe(
    "preservado",
  );
  expect(s.registro.capabilities().modules).toHaveLength(1);
  await s.close();
  writeFileSync(
    path,
    JSON.stringify({
      packages: [
        {
          id: "autenticacao-basica",
          entry: "./modules/autenticacao-basica/server.ts",
        },
        { id: "exemplo", entry: "./tests/fixtures/modulo-exemplo/server.ts" },
      ],
      enabled: ["autenticacao-basica", "exemplo"],
    }),
  );
  s = await new Servidor(opts).inicializar();
  expect(
    s.banco.get(
      "SELECT COUNT(*) AS n FROM schema_migrations WHERE owner='exemplo'",
    )!.n,
  ).toBe(1);
  await s.close();
});
it("A02 substitui autenticação por capacidade e elimina rota do módulo removido", async () => {
  const replacement: ModuloServidor = {
    manifesto: {
      id: "auth-teste",
      nome: "Autenticação apenas para teste",
      versao: 1,
      apiVersion: 1,
      capacidades: ["autenticacao"],
    },
    inicializar(r) {
      r.registrarRotaAPI(
        "/api/test-auth",
        (req, res) =>
          res.json(
            r.servicos.sessoes.criar(
              req,
              res,
              r.servicos.dominio.usuario(
                "11111111-1111-4111-8111-111111111111",
              ),
              "auth-teste",
            ),
          ),
        { publica: true },
      );
    },
  };
  const s = await new Servidor({ database: ":memory:" }).inicializar([
    replacement,
  ]);
  expect(s.registro.capabilities().modules[0].id).toBe("auth-teste");
  expect((await request(s.app).get("/api/login")).status).toBe(404);
  const date = new Date().toISOString();
  s.banco.run(
    "INSERT INTO usuarios VALUES(?,?,?,?,NULL,NULL,?,?)",
    "11111111-1111-4111-8111-111111111111",
    "Conta alternativa",
    "alternativa@teste.edu",
    "aluno",
    date,
    date,
  );
  const agent = request.agent(s.app),
    state = await agent.get("/api/session");
  const login = await agent
    .post("/api/test-auth")
    .set("Origin", "http://localhost:5173")
    .set("X-CSRF-Token", state.body.csrf)
    .send({});
  expect(login.status).toBe(200);
  expect((await agent.get("/api/me")).body.nome).toBe("Conta alternativa");
  expect(
    s.banco.get(
      "SELECT 1 FROM sqlite_master WHERE name='auth_basica_credenciais'",
    ),
  ).toBeUndefined();

  await s.close();
});
it("sessão de provedor desabilitado é rejeitada no próximo início", async () => {
  const { dir, path } = configFile(["autenticacao-basica"]);
  const opts = {
    database: join(dir, "db.sqlite"),
    modulesFile: path,
    origin: "http://localhost:5173",
  };
  let s = await new Servidor(opts).inicializar();
  await provisionar(s.banco, "Ana", "a@example.org", "aluno", "Password!12345");
  const agent = request.agent(s.app),
    state = await agent.get("/api/session");
  const logged = await agent
    .post("/api/login")
    .set("Origin", opts.origin)
    .set("X-CSRF-Token", state.body.csrf)
    .send({ email: "a@example.org", senha: "Password!12345" });
  const cookie = logged.headers["set-cookie"][0].split(";")[0];
  await s.close();
  s = await new Servidor(opts).inicializar([
    {
      manifesto: {
        id: "outra-auth",
        nome: "Teste",
        versao: 1,
        apiVersion: 1,
        capacidades: ["autenticacao"],
      },
      inicializar() {},
    },
  ]);
  expect(
    (await request(s.app).get("/api/me").set("Cookie", cookie)).status,
  ).toBe(401);
  await s.close();
});
it("A04 ausência de autenticação bloqueia inicialização", async () => {
  await expect(
    new Servidor({ database: ":memory:" }).inicializar([example]),
  ).rejects.toThrow("provedor");
});
it.each(["route", "method", "migration", "throw"])(
  "A04 falha %s não deixa servidor disponível",
  async (kind) => {
    const bad: ModuloServidor = {
      manifesto: {
        id: "ruim",
        nome: "Ruim",
        versao: 1,
        apiVersion: 1,
        capacidades: [],
      },
      inicializar(r) {
        if (kind === "route")
          r.registrarRotaAPI("/api/health/", () => {}, { metodo: "get" });
        if (kind === "method") {
          r.registrarMetodo("ruim.a", () => {});
          r.registrarMetodo("ruim.a", () => {});
        }
        if (kind === "migration")
          r.servicos.banco.migrar("ruim", 1, "INVALID SQL");
        if (kind === "throw") throw new Error("Falha explícita");
      },
    };
    const s = new Servidor({ database: ":memory:" });
    await expect(s.inicializar([auth, bad])).rejects.toThrow(
      "Falha ao inicializar ruim",
    );
    expect(() => s.servir()).toThrow("Inicialize");
  },
);
