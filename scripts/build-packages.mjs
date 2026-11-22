import { mkdirSync, cpSync } from "node:fs";
for (const name of ["shared", "module-sdk"]) {
  mkdirSync(`packages/${name}/dist`, { recursive: true });
  cpSync(`dist/packages/${name}/src`, `packages/${name}/dist`, {
    recursive: true,
  });
}
