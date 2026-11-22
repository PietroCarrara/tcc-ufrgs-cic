import { Servidor } from "./core/server.js";
const s = await new Servidor().inicializar();
const http = s.servir();
let stopping = false;
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    if (stopping) return;
    stopping = true;
    http.close(() => {
      void s.close().then(() => process.exit(0));
    });
    http.closeIdleConnections();
  });
