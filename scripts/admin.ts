import { parseArgs } from "node:util";
import { stdin, stdout } from "node:process";
import { backup } from "node:sqlite";
import { z } from "zod";
import { Servidor } from "../apps/server/src/core/server.js";
import { provisionar } from "../modules/autenticacao-basica/server.js";
import { textoDoc } from "../packages/shared/src/index.js";
const [command, ...args] = process.argv.slice(2);
const s = await new Servidor().inicializar();
async function hidden(prompt: string): Promise<string> {
  if (!stdin.isTTY)
    throw new Error(
      "Provisionamento requer terminal interativo para ocultar a senha",
    );
  stdout.write(prompt);
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding("utf8");
  return new Promise((resolve, reject) => {
    let value = "";
    const done = () => {
      stdin.off("data", handler);
      stdin.setRawMode(false);
      stdin.pause();
      stdout.write("\n");
    };
    const handler = (chunk: string) => {
      for (const c of chunk) {
        if (c === "\u0003") {
          done();
          reject(new Error("Cancelado"));
          return;
        }
        if (c === "\r" || c === "\n") {
          done();
          resolve(value);
          return;
        }
        if (c === "\u007f") value = value.slice(0, -1);
        else if (c >= " ") value += c;
      }
    };
    stdin.on("data", handler);
  });
}
try {
  if (command === "migrate") console.log("Migrações aplicadas e verificadas.");
  else if (command === "provision") {
    const { values } = parseArgs({
      args,
      options: {
        nome: { type: "string" },
        email: { type: "string" },
        papel: { type: "string" },
      },
    });
    const input = z
      .object({
        nome: z.string().trim().min(1).max(150),
        email: z.email(),
        papel: z.enum(["aluno", "professor"]),
      })
      .parse(values);
    const senha = await hidden("Senha (12–128 caracteres): "),
      confirm = await hidden("Confirme a senha: ");
    if (senha !== confirm) throw new Error("Senhas diferentes");
    const id = await provisionar(
      s.banco,
      input.nome,
      input.email,
      input.papel,
      senha,
    );
    console.log(`Conta provisionada: ${id}`);
  } else if (command === "seed") {
    if (process.env.NODE_ENV === "production")
      throw new Error("Seed não permitido em produção");
    if (s.banco.get("SELECT 1 FROM usuarios LIMIT 1"))
      throw new Error(
        "Seed requer banco vazio para preservar dados existentes",
      );
    const users = [];
    for (const [nome, email, papel] of [
      ["Ana Silva", "ana@exemplo.edu", "aluno"],
      ["Bruno Costa", "bruno@exemplo.edu", "aluno"],
      ["Clara Alves", "clara@exemplo.edu", "aluno"],
      ["Marina Oliveira", "marina@exemplo.edu", "professor"],
      ["Rafael Santos", "rafael@exemplo.edu", "professor"],
      ["Helena Souza", "helena@exemplo.edu", "professor"],
    ] as const) {
      const id = await provisionar(
        s.banco,
        nome,
        email,
        papel,
        "Demonstracao!2026",
      );
      users.push(s.dominio.usuario(id));
      if (papel === "professor")
        s.dominio.atualizarPerfil(
          users.at(-1)!,
          nome,
          textoDoc(
            "Pesquisa em educação, tecnologia e sistemas de informação.",
          ),
          [textoDoc("Ferramentas colaborativas para a escrita acadêmica")],
        );
    }
    const proposal = s.dominio.enviarProposta(users[0], {
      professorId: users[3].id,
      titulo: "Tecnologia e colaboração na escrita acadêmica",
      descricao: "Investigar ferramentas modulares de apoio à escrita do TCC.",
    })!;
    const p = s.dominio.aceitarProposta(proposal.id, users[3]);
    s.dominio.alterarMembro(p.id, users[3], users[1].id, 1);
    s.dominio.alterarMembro(p.id, users[3], users[4].id, 2);
    s.dominio.enviarProposta(users[2], {
      professorId: users[3].id,
      titulo: "Acessibilidade digital no ensino",
      descricao: "Avaliar práticas de acessibilidade.",
    });
    s.dominio.enviarProposta(users[2], {
      professorId: users[4].id,
      titulo: "Acessibilidade digital no ensino",
      descricao: "Avaliar práticas de acessibilidade.",
    });
    s.dominio.salvarAtividade(users[0], {
      dia: 2,
      inicio: 540,
      fim: 660,
      descricao: "Aulas",
    });
    s.dominio.salvarAtividade(users[3], {
      dia: 3,
      inicio: 600,
      fim: 720,
      descricao: "Pesquisa",
    });
    s.dominio.salvarAtividade(
      users[3],
      { dia: 4, inicio: 840, fim: 900, descricao: "Orientação semanal" },
      undefined,
      undefined,
      p.id,
      undefined,
      "seed-meeting",
    );
    console.log(
      "Demonstração criada: ana/bruno/clara/marina/rafael/helena@exemplo.edu; senha: Demonstracao!2026",
    );
  } else if (command === "backup") {
    const destination = args[0];
    if (!destination)
      throw new Error("Uso: npm run backup -- /caminho/backup.sqlite");
    await backup(s.banco.db, destination);
    console.log(`Backup consistente criado em ${destination}`);
  } else throw new Error("Comando: migrate | provision | seed | backup");
} finally {
  await s.close();
}
