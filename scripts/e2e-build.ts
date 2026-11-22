import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
mkdirSync("tmp/e2e", { recursive: true });
for (const side of ["client", "server"]) {
  const config = JSON.parse(
    readFileSync(`config/modules.${side}.json`, "utf8"),
  );
  config.packages.push({
    id: "exemplo",
    entry: `./tests/fixtures/modulo-exemplo/${side}.ts`,
  });
  config.enabled.push("exemplo");
  writeFileSync(`tmp/e2e/modules.${side}.json`, JSON.stringify(config));
}
const build = spawnSync("npm", ["run", "build"], {
  stdio: "inherit",
  env: { ...process.env, CLIENT_MODULES_CONFIG: "tmp/e2e/modules.client.json" },
});
const restore = spawnSync("npm", ["run", "modules:catalog"], {
  stdio: "inherit",
});
if (build.status !== 0 || restore.status !== 0) process.exit(1);
