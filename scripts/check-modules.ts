import { Servidor } from "../apps/server/src/core/server.js";
const s = await new Servidor({ database: ":memory:" }).inicializar();
console.log(JSON.stringify(s.registro.capabilities(), null, 2));
await s.close();
