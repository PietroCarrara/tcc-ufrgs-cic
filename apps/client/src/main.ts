import { Cliente } from "./core/client.js";
import "./style.css";
new Cliente()
  .inicializar()
  .then((c) => c.servir())
  .catch((error) => {
    const root = document.getElementById("app")!;
    const main = document.createElement("main");
    main.className = "boot-error";
    const h = document.createElement("h1");
    h.textContent = "Não foi possível iniciar o Trama";
    const p = document.createElement("p");
    p.textContent = error.message;
    const button = document.createElement("button");
    button.textContent = "Tentar novamente";
    button.onclick = () => location.reload();
    main.append(h, p, button);
    root.append(main);
  });
