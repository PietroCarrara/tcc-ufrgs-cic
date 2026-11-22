import { mkdtempSync, cpSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:net";
import { randomBytes } from "node:crypto";
import assert from "node:assert/strict";
const root = process.cwd(),
  work = mkdtempSync(join(tmpdir(), "trama-install-"));
let processServer;
const env = {
  ...process.env,
  NODE_ENV: "development",
  DATABASE_PATH: "data/verification.sqlite",
  APP_ORIGIN: "http://localhost:3000",
  COOKIE_SECURE: "false",
  CONFIRMATION_SECRET: randomBytes(32).toString("hex"),
  SERPAPI_API_KEY: "",
  CLIENT_MODULES_CONFIG: "config/modules.client.json",
};
function run(args) {
  const result = spawnSync("npm", args, { cwd: work, env, encoding: "utf8" });
  if (result.status !== 0)
    throw new Error(
      `npm ${args.join(" ")} falhou:\n${result.stdout}\n${result.stderr}`,
    );
  console.log(`OK npm ${args.join(" ")}`);
}
async function stop() {
  if (!processServer || processServer.exitCode !== null) return;
  const child = processServer;
  const closed = new Promise((resolve) => child.once("exit", resolve));
  child.kill("SIGTERM");
  await closed;
  processServer = undefined;
}
try {
  for (const path of [
    "package.json",
    "package-lock.json",
    "tsconfig.json",
    "tsconfig.build.json",
    "apps",
    "packages",
    "modules",
    "config",
    "scripts",
    "tests",
  ])
    cpSync(join(root, path), join(work, path), {
      recursive: true,
      filter: (source) =>
        !source.includes("/node_modules") &&
        !source.includes("/dist/") &&
        !source.endsWith("/dist"),
    });
  run(["ci"]);
  run(["run", "migrate"]);
  run(["run", "migrate"]);
  run(["run", "seed"]);
  run(["run", "build"]);
  const socket = createServer();
  await new Promise((r) => socket.listen(0, "127.0.0.1", r));
  const port = socket.address().port;
  await new Promise((r) => socket.close(r));
  const base = `http://127.0.0.1:${port}`;
  const production = {
    ...env,
    NODE_ENV: "production",
    COOKIE_SECURE: "true",
    APP_ORIGIN: "https://trama.example",
    PORT: String(port),
  };
  async function start() {
    processServer = spawn(process.execPath, ["dist/apps/server/src/main.js"], {
      cwd: work,
      env: production,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let logs = "";
    processServer.stdout.on("data", (c) => (logs += c));
    processServer.stderr.on("data", (c) => (logs += c));
    for (let i = 0; i < 100; i++) {
      try {
        const response = await fetch(base + "/api/health");
        if (response.ok) return;
      } catch {
        /* O processo ainda está iniciando. */
      }
      if (processServer.exitCode !== null) throw new Error(logs);
      await new Promise((r) => setTimeout(r, 50));
    }
    throw new Error("Timeout iniciando produção: " + logs);
  }
  await start();
  let response = await fetch(base + "/api/session");
  let cookie = response.headers.get("set-cookie").split(";")[0];
  assert.match(response.headers.get("set-cookie"), /Secure/);
  const anonymous = await response.json();
  response = await fetch(base + "/api/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: production.APP_ORIGIN,
      "X-CSRF-Token": anonymous.csrf,
      Cookie: cookie,
    },
    body: JSON.stringify({
      email: "ana@exemplo.edu",
      senha: "Demonstracao!2026",
    }),
  });
  assert.equal(response.status, 200);
  cookie = response.headers.get("set-cookie").split(";")[0];
  const session = await response.json();
  assert.equal(session.usuario.papel, "aluno");
  const projectList = await (
    await fetch(base + "/api/projetos", { headers: { Cookie: cookie } })
  ).json();
  assert.equal(projectList.itens.length, 1);
  assert.equal(
    (await fetch(base + "/projetos/" + projectList.itens[0].id)).status,
    200,
  );
  response = await fetch(base + "/api/nao-existe");
  assert.equal(response.status, 404);
  assert.equal((await response.json()).erro.codigo, "NAO_ENCONTRADO");
  const capabilities = await (await fetch(base + "/api/capabilities")).json();
  assert.equal(capabilities.modules.length, 3);
  assert.equal(
    (await fetch(base + "/api/exemplo", { headers: { Cookie: cookie } }))
      .status,
    404,
  );
  console.log(
    "OK artefato de produção: login, Secure, API, SPA e ausência do módulo de teste",
  );
  await stop();
  await start();
  assert.equal(
    (await fetch(base + "/api/me", { headers: { Cookie: cookie } })).status,
    200,
  );
  console.log("OK reinício preserva sessão e projeto");
  run(["run", "backup", "--", "data/backup.sqlite"]);
  assert.ok(existsSync(join(work, "data/backup.sqlite")));
  await stop();
  console.log("OK instalação limpa e backup concluídos");
} finally {
  await stop();
  rmSync(work, { recursive: true, force: true });
}
