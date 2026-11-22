import { writeFileSync } from "node:fs";
import { readModules, modulePath } from "../apps/server/src/core/registry.js";
const c = readModules(
  process.env.CLIENT_MODULES_CONFIG ?? "config/modules.client.json",
);
const enabled = c.packages.filter((p) => c.enabled.includes(p.id));
for (const p of enabled) modulePath(p.entry);
const lines = enabled.map(
  (p, i) =>
    `import m${i} from ${JSON.stringify(p.entry.startsWith("./") ? "../../../../" + p.entry.slice(2).replace(/\.ts$/, ".js") : p.entry)};`,
);
lines.push(
  ...enabled.map(
    (p, i) =>
      `if(m${i}.manifesto.id!==${JSON.stringify(p.id)})throw new Error("ID de módulo incompatível com configuração: ${p.id}");`,
  ),
);
lines.push(
  `export const catalog=[${enabled.map((_, i) => "m" + i).join(",")}];`,
  `export const options=${JSON.stringify(c.options)};`,
);
writeFileSync(
  "apps/client/src/core/catalog.generated.ts",
  lines.join("\n") + "\n",
);
