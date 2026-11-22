import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import request from "supertest";
import {
  mkdtempSync,
  rmSync,
  writeFileSync,
  readFileSync,
  mkdirSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { Servidor } from "../../apps/server/src/core/server.js";
import {
  provisionar,
  definirSenha,
} from "../../modules/autenticacao-basica/server.js";
import {
  textoDoc,
  type User,
  type ProjetoDTO,
  type FonteDTO,
} from "../../packages/shared/src/index.js";
import {
  Banco,
  migrarCore,
} from "../../apps/server/src/persistence/database.js";
const origin = "http://localhost:5173",
  password = "TesteSeguro!2026";
let server: Servidor, temp: string, project: ProjetoDTO;
const users: User[] = [];
type Client = {
  agent: ReturnType<typeof request.agent>;
  csrf: string;
  user: User;
  cookie: string;
};
let aluno: Client, prof: Client, outsider: Client, prof2: Client;
async function login(index: number) {
  const agent = request.agent(server.app),
    session = await agent.get("/api/session");
  const response = await agent
    .post("/api/login")
    .set("Origin", origin)
    .set("X-CSRF-Token", session.body.csrf)
    .send({ email: `user${index}@example.edu`, senha: password });
  expect(response.status).toBe(200);
  return {
    agent,
    csrf: response.body.csrf,
    user: response.body.usuario,
    cookie: response.headers["set-cookie"][0].split(";")[0],
  };
}
const post = (c: Client, url: string, body: any = {}) =>
  c.agent
    .post(url)
    .set("Origin", origin)
    .set("X-CSRF-Token", c.csrf)
    .send(body);
const patch = (c: Client, url: string, body: any = {}) =>
  c.agent
    .patch(url)
    .set("Origin", origin)
    .set("X-CSRF-Token", c.csrf)
    .send(body);
const del = (c: Client, url: string, body: any = {}) =>
  c.agent
    .delete(url)
    .set("Origin", origin)
    .set("X-CSRF-Token", c.csrf)
    .send(body);
const put = (c: Client, url: string, body: any = {}) =>
  c.agent.put(url).set("Origin", origin).set("X-CSRF-Token", c.csrf).send(body);
async function fresh() {
  return (await aluno.agent.get(`/api/projetos/${project.id}`))
    .body as ProjetoDTO;
}
beforeAll(async () => {
  temp = mkdtempSync(join(tmpdir(), "trama-integration-"));
  server = await new Servidor({
    database: join(temp, "test.sqlite"),
    origin,
    secret: "a".repeat(64),
  }).inicializar();
  for (let i = 0; i < 6; i++) {
    const id = await provisionar(
      server.banco,
      `Pessoa ${i}`,
      `user${i}@example.edu`,
      i < 3 ? "aluno" : "professor",
      password,
    );
    users.push(server.dominio.usuario(id));
  }
  aluno = await login(0);
  prof = await login(3);
  outsider = await login(2);
  prof2 = await login(4);
});
afterAll(async () => {
  await server.close();
  rmSync(temp, { recursive: true, force: true });
});
describe("sessão, CSRF e perfil", () => {
  it("A01 cria sessão anônima, renova token e restaura usuário", async () => {
    const a = request.agent(server.app),
      r = await a.get("/api/session");
    const old = r.headers["set-cookie"][0].split(";")[0];
    expect(r.body.usuario).toBeNull();
    const logged = await a
      .post("/api/login/")
      .set("Origin", origin)
      .set("X-CSRF-Token", r.body.csrf)
      .send({ email: "USER0@EXAMPLE.EDU", senha: password });
    expect(logged.status).toBe(200);
    expect(logged.headers["set-cookie"][0]).toContain("HttpOnly");
    expect(logged.headers["set-cookie"][0]).not.toContain(old);
    expect(
      (await request(server.app).get("/api/session").set("Cookie", old)).body
        .usuario,
    ).toBeNull();
    expect((await a.get("/api/session")).body.usuario.id).toBe(users[0].id);
    const out = await a
      .post("/api/logout")
      .set("Origin", origin)
      .set("X-CSRF-Token", logged.body.csrf);
    expect(out.status).toBe(204);
    expect((await a.get("/api/me")).status).toBe(401);
  });
  it("rejeita senha incorreta de forma genérica", async () => {
    const a = request.agent(server.app),
      s = await a.get("/api/session");
    const r = await a
      .post("/api/login")
      .set("Origin", origin)
      .set("X-CSRF-Token", s.body.csrf)
      .send({ email: "user0@example.edu", senha: "errada" });
    expect(r.status).toBe(401);
    expect(r.body.erro.codigo).toBe("CREDENCIAIS_INVALIDAS");
  });
  it("A19 rejeita origem e CSRF inválidos inclusive no login", async () => {
    expect((await aluno.agent.post("/api/propostas").send({})).status).toBe(
      403,
    );
    expect(
      (
        await aluno.agent
          .post("/api/logout")
          .set("Origin", "https://evil.test")
          .set("X-CSRF-Token", aluno.csrf)
      ).status,
    ).toBe(403);
  });
  it("atualiza biografia pesquisável, protege campos de professor", async () => {
    expect(
      (
        await patch(prof, "/api/me", {
          nome: "Márcia Ciência",
          biografia: textoDoc("EDUCAÇÃO inclusiva e tecnologia"),
          sugestoes: [textoDoc("Pesquisa modular")],
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await patch(aluno, "/api/me", {
          nome: "Aluno",
          biografia: textoDoc("x"),
        })
      ).status,
    ).toBe(403);
    const r = await aluno.agent.get("/api/professores?texto=marcia%20educacao");
    expect(r.body.total).toBe(1);
    expect(r.body.itens[0].email).toBeUndefined();
  });
});
describe("propostas, transações e cardinalidades", () => {
  it("A07 propostas simultâneas, unicidade e notificações", async () => {
    const body = {
      professorId: users[3].id,
      titulo: "Pesquisa colaborativa",
      descricao: "Proposta de estudo",
    };
    expect((await post(aluno, "/api/propostas", body)).status).toBe(201);
    expect((await post(aluno, "/api/propostas", body)).status).toBe(409);
    expect(
      (
        await post(aluno, "/api/propostas", {
          ...body,
          professorId: users[4].id,
        })
      ).status,
    ).toBe(201);
    expect(
      (await prof.agent.get("/api/notificacoes")).body.naoLidas,
    ).toBeGreaterThan(0);
    expect((await post(prof, "/api/propostas", body)).status).toBe(403);
  });
  it("A08 aceite concorrente cria um único projeto e remove proposta", async () => {
    const proposals = await prof.agent.get("/api/propostas");
    const id = proposals.body.itens[0].id;
    expect((await post(prof2, `/api/propostas/${id}/aceitar`)).status).toBe(
      404,
    );
    const results = await Promise.all([
      post(prof, `/api/propostas/${id}/aceitar`),
      post(prof, `/api/propostas/${id}/aceitar`),
    ]);
    expect(results.map((x) => x.status).sort()).toEqual([201, 404]);
    project = results.find((x) => x.status === 201)!.body;
    expect(project.membros).toHaveLength(2);
    expect(server.banco.get("SELECT COUNT(*) AS n FROM projetos")!.n).toBe(1);
    expect(
      server.banco.get("SELECT 1 FROM propostas WHERE id=?", id),
    ).toBeUndefined();
  });
  it("A08 rollback desfaz projeto, vínculos e notificação", () => {
    const prop = server.dominio.enviarProposta(users[1], {
      professorId: users[3].id,
      titulo: "Rollback",
      descricao: "Teste",
    })!;
    server.banco.db.exec(
      "CREATE TRIGGER falha_notificacao BEFORE INSERT ON notificacoes WHEN NEW.tipo='aceite' BEGIN SELECT RAISE(ABORT,'teste'); END;",
    );
    expect(() => server.dominio.aceitarProposta(prop.id, users[3])).toThrow();
    expect(
      server.banco.get("SELECT 1 FROM propostas WHERE id=?", prop.id),
    ).toBeTruthy();
    expect(server.banco.get("SELECT COUNT(*) AS n FROM projetos")!.n).toBe(1);
    server.banco.db.exec("DROP TRIGGER falha_notificacao");
  });
  it("A09 rejeição exige motivo e preserva contexto após remoção", async () => {
    const prop = (await prof2.agent.get("/api/propostas")).body.itens[0];
    expect(
      (await post(prof2, `/api/propostas/${prop.id}/rejeitar`, { motivo: " " }))
        .status,
    ).toBe(400);
    expect(
      (
        await post(prof2, `/api/propostas/${prop.id}/rejeitar`, {
          motivo: "Tema fora da linha de pesquisa",
        })
      ).status,
    ).toBe(204);
    const notices = (await aluno.agent.get("/api/notificacoes")).body.itens;
    expect(
      notices.some((n: any) => n.texto.includes("Tema fora da linha")),
    ).toBe(true);
  });
  it("A10 protege membros, mínimo por papel e dados de não membros", async () => {
    expect(
      (await outsider.agent.get(`/api/projetos/${project.id}`)).status,
    ).toBe(404);
    expect(
      (
        await post(
          aluno,
          `/api/projetos/${project.id}/membros/${users[1].id}`,
          { versao: 1 },
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await del(prof, `/api/projetos/${project.id}/membros/${prof.user.id}`, {
          versao: 1,
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await post(prof, `/api/projetos/${project.id}/membros/${users[1].id}`, {
          versao: 1,
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await post(prof, `/api/projetos/${project.id}/membros/${users[4].id}`, {
          versao: 2,
        })
      ).status,
    ).toBe(200);
    expect((await fresh()).membros).toHaveLength(4);
    expect(
      (
        await post(prof, `/api/projetos/${project.id}/membros/${users[2].id}`, {
          versao: 1,
        })
      ).status,
    ).toBe(409);
  });
  it("A06 contadores usam projetos distintos, diretório não vaza agenda", async () => {
    const r = await aluno.agent.get(`/api/professores/${users[3].id}`);
    expect(r.body.projetos).toBe(1);
    expect(r.body.email).toBeUndefined();
    expect(r.body.atividades).toBeUndefined();
  });
});
describe("agenda e confirmação assinada", () => {
  let activity: any, meeting: any, token: string;
  const slot = {
    dia: 0,
    inicio: 0,
    fim: 60,
    descricao: "Compromisso pessoal secreto",
  };
  it("A05 cria/edita agenda com extremidades, impede alteração de terceiros", async () => {
    const r = await post(aluno, "/api/me/atividades", slot);
    expect(r.status).toBe(201);
    activity = r.body;
    expect(
      (
        await patch(outsider, `/api/me/atividades/${activity.id}`, {
          ...slot,
          versao: 1,
        })
      ).status,
    ).toBe(404);
    expect(
      (
        await post(aluno, "/api/me/atividades", {
          ...slot,
          dia: 6,
          inicio: 1425,
          fim: 1440,
        })
      ).status,
    ).toBe(201);
    expect(
      (
        await patch(aluno, `/api/me/atividades/${activity.id}`, {
          ...slot,
          versao: 2,
        })
      ).status,
    ).toBe(409);
  });
  it("A11 conflito não salva, não notifica e oculta descrição privada", async () => {
    const before = server.banco.get(
      "SELECT COUNT(*) AS n FROM notificacoes",
    )!.n;
    const r = await post(prof, `/api/projetos/${project.id}/reunioes`, {
      ...slot,
      descricao: "Orientação",
    }).set("Idempotency-Key", "conflict");
    expect(r.status).toBe(409);
    expect(r.body.erro.codigo).toBe("CONFLITO_DE_HORARIOS");
    token = r.body.erro.detalhes.token;
    expect(JSON.stringify(r.body)).not.toContain("secreto");
    expect(server.banco.get("SELECT COUNT(*) AS n FROM notificacoes")!.n).toBe(
      before,
    );
    expect(
      (await prof.agent.get(`/api/projetos/${project.id}/reunioes`)).body.itens,
    ).toHaveLength(0);
  });
  it("A12 token adulterado e operação alterada exigem nova confirmação", async () => {
    for (const body of [
      { ...slot, descricao: "Orientação", token: token + "x" },
      { ...slot, descricao: "Outro assunto", token },
      { ...slot, descricao: "Orientação", ignorarConflitos: true },
    ])
      expect(
        (
          await post(prof, `/api/projetos/${project.id}/reunioes`, body).set(
            "Idempotency-Key",
            randomUUID(),
          )
        ).status,
      ).toBe(409);
  });
  it("A12 concorrência invalida token; confirmação recalculada salva uma vez", async () => {
    await patch(aluno, `/api/me/atividades/${activity.id}`, {
      ...slot,
      versao: 1,
      fim: 75,
    });
    const r = await post(prof, `/api/projetos/${project.id}/reunioes`, {
      ...slot,
      descricao: "Orientação",
      token,
    }).set("Idempotency-Key", "meeting");
    expect(r.status).toBe(409);
    token = r.body.erro.detalhes.token;
    const before = server.banco.get(
      "SELECT COUNT(*) AS n FROM notificacoes WHERE destinatario=?",
      prof.user.id,
    )!.n;
    const saved = await post(prof, `/api/projetos/${project.id}/reunioes`, {
      ...slot,
      descricao: "Orientação",
      token,
    }).set("Idempotency-Key", "meeting");
    expect(saved.status).toBe(201);
    meeting = saved.body;
    expect(
      server.banco.get(
        "SELECT COUNT(*) AS n FROM notificacoes WHERE destinatario=?",
        prof.user.id,
      )!.n,
    ).toBe(before);
    const replay = await post(prof, `/api/projetos/${project.id}/reunioes`, {
      ...slot,
      descricao: "Orientação",
      token,
    }).set("Idempotency-Key", "meeting");
    expect(replay.body.id).toBe(meeting.id);
    expect(
      (await prof.agent.get(`/api/projetos/${project.id}/reunioes`)).body.itens,
    ).toHaveLength(1);
  });
  it("A05 reunião aparece na agenda e não pode ser alterada como atividade pessoal", async () => {
    const a = await aluno.agent.get("/api/me/agenda");
    expect(a.body.itens.some((x: any) => x.id === meeting.id)).toBe(true);
    expect(
      (await del(prof, `/api/me/atividades/${meeting.id}`, { versao: 1 }))
        .status,
    ).toBe(404);
  });
  it("A06 filtro considera reuniões e aceita livre em ao menos um dia", async () => {
    const blocked = await aluno.agent.get(
      "/api/professores?dias=0&inicio=0&fim=60",
    );
    expect(blocked.body.itens.some((x: any) => x.id === prof.user.id)).toBe(
      false,
    );
    const available = await aluno.agent.get(
      "/api/professores?dias=0,1&inicio=0&fim=60",
    );
    expect(available.body.itens.some((x: any) => x.id === prof.user.id)).toBe(
      true,
    );
    const adjacent = await aluno.agent.get(
      "/api/professores?dias=0&inicio=60&fim=75",
    );
    expect(adjacent.body.itens.some((x: any) => x.id === prof.user.id)).toBe(
      true,
    );
  });
  it("A12 edição exclui própria reunião e remoção atualiza agendas", async () => {
    const edit = await patch(
      prof,
      `/api/projetos/${project.id}/reunioes/${meeting.id}`,
      { dia: 1, inicio: 60, fim: 120, descricao: "Sem conflito", versao: 1 },
    );
    expect(edit.status).toBe(200);
    const again = await patch(
      prof,
      `/api/projetos/${project.id}/reunioes/${meeting.id}`,
      { dia: 1, inicio: 60, fim: 120, descricao: "Só eu", versao: 2 },
    );
    expect(again.status).toBe(200);
    expect(
      (
        await del(prof, `/api/projetos/${project.id}/reunioes/${meeting.id}`, {
          versao: 3,
        })
      ).status,
    ).toBe(204);
    expect(
      (await aluno.agent.get("/api/me/agenda")).body.itens.some(
        (x: any) => x.id === meeting.id,
      ),
    ).toBe(false);
  });
});
describe("fontes, anexos, escrita e exportação", () => {
  let fonte: FonteDTO, arquivo: any;
  it("A15 importa múltiplas entradas BibTeX com chaves aninhadas", async () => {
    const r = await post(
      aluno,
      `/api/projetos/${project.id}/fontes/importar-bibtex`,
      {
        bibtex:
          "@article{um, title={Estudo {Acadêmico} e Ciência}, author={Silva, Ana and Costa, Bruno}, year={2024}}\n@book{dois,title={Outro estudo},author={Pessoa, Maria},year={2020}}",
      },
    );
    expect(r.status, r.text).toBe(201);
    expect(r.body.itens).toHaveLength(2);
    fonte = r.body.itens[0];
    expect(fonte.autores).toContain("Ana Silva");
  });
  it("A15 deduplica DOI e exige decisão para semelhança", async () => {
    const body = {
      titulo: "Fonte nova",
      autores: ["Pessoa"],
      doi: "10.1000/example",
    };
    expect(
      (await post(aluno, `/api/projetos/${project.id}/fontes`, body)).status,
    ).toBe(201);
    expect(
      (
        await post(aluno, `/api/projetos/${project.id}/fontes`, {
          ...body,
          titulo: "Outro título",
        })
      ).body.erro.codigo,
    ).toBe("FONTE_DUPLICADA");
    const similar = { titulo: "Aproximada", autores: [] };
    expect(
      (await post(aluno, `/api/projetos/${project.id}/fontes`, similar)).status,
    ).toBe(201);
    expect(
      (await post(aluno, `/api/projetos/${project.id}/fontes`, similar)).body
        .erro.codigo,
    ).toBe("FONTE_SEMELHANTE");
    expect(
      (
        await post(aluno, `/api/projetos/${project.id}/fontes`, {
          ...similar,
          permitirSemelhante: true,
        })
      ).status,
    ).toBe(201);
  });
  it("A17 upload/download mantém bytes, aplica tipo, limite e idempotência", async () => {
    const png = readFileSync("tests/fixtures/figura.png");
    const upload = () =>
      aluno.agent
        .post(`/api/projetos/${project.id}/arquivos`)
        .set("Origin", origin)
        .set("X-CSRF-Token", aluno.csrf)
        .set("Idempotency-Key", "png")
        .attach("arquivo", png, "imagem.png");
    const r = await upload();
    expect(r.status, r.text).toBe(201);
    arquivo = r.body;
    expect((await upload()).body.id).toBe(arquivo.id);
    const bytes = await aluno.agent.get(
      `/api/projetos/${project.id}/arquivos/${arquivo.id}`,
    );
    expect(bytes.body).toEqual(png);
    expect(
      (
        await outsider.agent.get(
          `/api/projetos/${project.id}/arquivos/${arquivo.id}`,
        )
      ).status,
    ).toBe(404);
    const bad = await aluno.agent
      .post(`/api/projetos/${project.id}/arquivos`)
      .set("Origin", origin)
      .set("X-CSRF-Token", aluno.csrf)
      .set("Idempotency-Key", "bad")
      .attach(
        "arquivo",
        Buffer.from('<svg onload="alert(1)"></svg>'),
        "bad.svg",
      );
    expect(bad.status).toBe(400);
    const big = await aluno.agent
      .post(`/api/projetos/${project.id}/arquivos`)
      .set("Origin", origin)
      .set("X-CSRF-Token", aluno.csrf)
      .set("Idempotency-Key", "big")
      .attach("arquivo", Buffer.alloc(10485761), "big.txt");
    expect(big.status).toBe(413);
  });
  it("A13/14 documento completo persiste; versão antiga nunca sobrescreve", async () => {
    const p = await fresh();
    const content: any[] = [
      {
        type: "heading",
        attrs: { id: "intro", level: 1 },
        content: [{ type: "text", text: "Introdução à ciência" }],
      },
      {
        type: "heading",
        attrs: { id: "sub", level: 2 },
        content: [{ type: "text", text: "Métodos" }],
      },
      {
        type: "heading",
        attrs: { id: "subsub", level: 3 },
        content: [{ type: "text", text: "Procedimentos" }],
      },
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "Pesquisa colaborativa ",
            marks: [{ type: "bold" }],
          },
          { type: "citation", attrs: { sourceId: fonte.id, locator: "p. 12" } },
          {
            type: "acronym",
            attrs: {
              short: "TCC",
              expansion: "Trabalho de Conclusão de Curso",
            },
          },
          { type: "internalReference", attrs: { targetId: "figura" } },
        ],
      },
      {
        type: "figure",
        attrs: {
          id: "figura",
          fileId: arquivo.id,
          caption: "Figura de teste",
          alt: "Gráfico de observações de teste",
        },
      },
      {
        type: "table",
        attrs: { id: "tabela", caption: "Resultados" },
        content: [
          {
            type: "tableRow",
            content: [
              {
                type: "tableHeader",
                content: [
                  {
                    type: "paragraph",
                    content: [{ type: "text", text: "Dimensão" }],
                  },
                ],
              },
              {
                type: "tableHeader",
                content: [
                  {
                    type: "paragraph",
                    content: [{ type: "text", text: "Resultado" }],
                  },
                ],
              },
            ],
          },
          ...Array.from({ length: 70 }, (_, i) => ({
            type: "tableRow",
            content: [
              {
                type: "tableCell",
                content: [
                  {
                    type: "paragraph",
                    content: [{ type: "text", text: `Observação ${i + 1}` }],
                  },
                ],
              },
              {
                type: "tableCell",
                content: [
                  {
                    type: "paragraph",
                    content: [
                      {
                        type: "text",
                        text: "Colaboração e informação científica",
                      },
                    ],
                  },
                ],
              },
            ],
          })),
        ],
      },
    ];
    const r = await put(aluno, `/api/projetos/${p.id}/documento`, {
      ...p,
      tituloIngles: "Collaborative research",
      resumo: textoDoc("Resumo em português com acentos."),
      resumoIngles: textoDoc("Abstract in English."),
      palavrasChave: ["ciência", "colaboração"],
      palavrasChaveIngles: ["research"],
      texto: { type: "doc", schemaVersion: 1, content },
    });
    expect(r.status, r.text).toBe(200);
    expect(r.body.versao).toBe(p.versao + 1);
    expect(
      (
        await put(prof, `/api/projetos/${p.id}/documento`, {
          ...p,
          texto: textoDoc("Sobrescrita"),
        })
      ).status,
    ).toBe(409);
    expect((await fresh()).texto.content).toHaveLength(content.length);
  });
  it("A17 bloqueia exclusão de fonte/imagem em uso e referências inválidas", async () => {
    expect(
      (
        await del(aluno, `/api/projetos/${project.id}/fontes/${fonte.id}`, {
          versao: 1,
        })
      ).status,
    ).toBe(409);
    expect(
      (await del(aluno, `/api/projetos/${project.id}/arquivos/${arquivo.id}`))
        .status,
    ).toBe(409);
    const p = await fresh();
    const r = await put(aluno, `/api/projetos/${p.id}/documento`, {
      ...p,
      texto: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "citation", attrs: { sourceId: randomUUID() } }],
          },
        ],
      },
    });
    expect(r.status).toBe(400);
  });
  it("A18 gera PDF real multipágina e verifica versão/acesso", async () => {
    const p = await fresh();
    expect(
      (
        await post(outsider, `/api/projetos/${p.id}/exportacoes/pdf`, {
          versao: p.versao,
        })
      ).status,
    ).toBe(404);
    expect(
      (
        await post(aluno, `/api/projetos/${p.id}/exportacoes/pdf`, {
          versao: 1,
        })
      ).status,
    ).toBe(409);
    const result = await post(aluno, `/api/projetos/${p.id}/exportacoes/pdf`, {
      versao: p.versao,
    })
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => cb(null, Buffer.concat(chunks)));
      });
    expect(result.status, result.text).toBe(200);
    expect(result.body.subarray(0, 4).toString()).toBe("%PDF");
    mkdirSync("output/pdf", { recursive: true });
    writeFileSync("output/pdf/validacao-academica.pdf", result.body);
  });
  it("A16 sem chave não retorna resultados fictícios", async () => {
    const r = await aluno.agent.get(
      `/api/projetos/${project.id}/busca-referencias?q=ciência`,
    );
    expect(r.status).toBe(503);
    expect(r.body.erro.codigo).toBe("BUSCA_NAO_CONFIGURADA");
  });
  it("A19 rejeita scripts, links perigosos, SQL injection e notificação alheia", async () => {
    const p = await fresh();
    expect(
      (
        await put(aluno, `/api/projetos/${p.id}/documento`, {
          ...p,
          texto: { type: "doc", content: [{ type: "script", text: "x" }] },
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await post(aluno, `/api/projetos/${p.id}/fontes`, {
          titulo: "X",
          autores: [],
          link: "javascript:alert(1)",
        })
      ).status,
    ).toBe(400);
    expect(
      (await aluno.agent.get("/api/professores?texto=%27%20OR%201%3D1--")).body
        .total,
    ).toBe(0);
    const n = (await prof.agent.get("/api/notificacoes")).body.itens[0];
    expect(
      (await patch(aluno, `/api/notificacoes/${n.id}`, { lida: true })).status,
    ).toBe(404);
    expect(
      (await aluno.agent.get("/api/rota-inexistente")).body.erro.codigo,
    ).toBe("NAO_ENCONTRADO");
  });
});

describe("proteção de anexos e dados de extensões", () => {
  it("foto própria, restrição de tipo, download e remoção", async () => {
    const r = await aluno.agent
      .put("/api/me/foto")
      .set("Origin", origin)
      .set("X-CSRF-Token", aluno.csrf)
      .attach("arquivo", "tests/fixtures/figura.png");
    expect(r.status).toBe(200);
    expect(
      (await aluno.agent.get(`/api/usuarios/${aluno.user.id}/foto`)).status,
    ).toBe(200);
    expect(
      (await outsider.agent.get(`/api/usuarios/${aluno.user.id}/foto`)).status,
    ).toBe(404);
    const bad = await aluno.agent
      .put("/api/me/foto")
      .set("Origin", origin)
      .set("X-CSRF-Token", aluno.csrf)
      .attach("arquivo", Buffer.from("PDF não é foto"), "foto.pdf");
    expect(bad.status).toBe(400);
    expect((await del(aluno, "/api/me/foto")).status).toBe(204);
    expect(
      (await aluno.agent.get(`/api/usuarios/${aluno.user.id}/foto`)).status,
    ).toBe(404);
  });
  it("arquivos truncados e UTF-8 inválido retornam erro de entrada", async () => {
    for (const [name, bytes] of [
      ["ruim.png", Buffer.from([137, 80, 78, 71])],
      ["ruim.txt", Buffer.from([255, 254, 253])],
    ] as const) {
      const r = await aluno.agent
        .post(`/api/projetos/${project.id}/arquivos`)
        .set("Origin", origin)
        .set("X-CSRF-Token", aluno.csrf)
        .set("Idempotency-Key", randomUUID())
        .attach("arquivo", bytes, name);
      expect(r.status).toBe(400);
    }
  });
  it("conteúdo de extensão removida é preservado, mas não pode ser falsificado", async () => {
    const original = (await fresh()).texto;
    const unknown = { type: "extensao-grafico", attrs: { dados: [1, 2, 3] } };
    server.banco.run(
      "UPDATE projetos SET texto_json=? WHERE id=?",
      JSON.stringify({ type: "doc", content: [unknown] }),
      project.id,
    );
    const p = await fresh(),
      opaque = {
        type: "opaque",
        attrs: { original: unknown, label: "Extensão indisponível" },
      };
    const r = await put(aluno, `/api/projetos/${project.id}/documento`, {
      ...p,
      texto: { type: "doc", content: [opaque] },
    });
    expect(r.status).toBe(200);
    expect(r.body.texto.content[0].attrs.original).toEqual(unknown);
    const changed = {
      ...opaque,
      attrs: { ...opaque.attrs, original: { type: "outro" } },
    };
    expect(
      (
        await put(aluno, `/api/projetos/${project.id}/documento`, {
          ...r.body,
          texto: { type: "doc", content: [changed] },
        })
      ).status,
    ).toBe(400);
    server.banco.run(
      "UPDATE projetos SET texto_json=? WHERE id=?",
      JSON.stringify(original),
      project.id,
    );
  });
  it("confirmação de reunião expira após cinco minutos", async () => {
    const body = {
      dia: 0,
      inicio: 0,
      fim: 60,
      descricao: "Verificação de expiração",
    };
    const initial = await post(
      prof,
      `/api/projetos/${project.id}/reunioes`,
      body,
    ).set("Idempotency-Key", "expires");
    expect(initial.status).toBe(409);
    const clock = vi.spyOn(Date, "now").mockReturnValue(Date.now() + 300001);
    try {
      const expired = await post(prof, `/api/projetos/${project.id}/reunioes`, {
        ...body,
        token: initial.body.erro.detalhes.token,
      }).set("Idempotency-Key", "expires");
      expect(expired.status).toBe(409);
      expect(expired.body.erro.codigo).toBe("CONFLITO_DE_HORARIOS");
    } finally {
      clock.mockRestore();
    }
  });
});
describe("persistência e migrações", () => {
  it("A20 reinício preserva dados e sessão válida", async () => {
    await server.close();
    server = await new Servidor({
      database: join(temp, "test.sqlite"),
      origin,
      secret: "a".repeat(64),
    }).inicializar();
    const r = await request(server.app)
      .get("/api/me")
      .set("Cookie", aluno.cookie);
    expect(r.status).toBe(200);
    expect(
      server.dominio.projeto(project.id, users[0]).texto.content!.length,
    ).toBeGreaterThan(1);
  });
  it("expiração, revogação por troca de senha e rate limit", async () => {
    const c = await login(1);
    server.banco.run(
      "UPDATE sessoes SET expira=0 WHERE usuario_id=?",
      c.user.id,
    );
    expect(
      (await request(server.app).get("/api/me").set("Cookie", c.cookie)).status,
    ).toBe(401);
    const newer = await login(1);
    await definirSenha(server.banco, newer.user.id, password);
    expect(
      (await request(server.app).get("/api/me").set("Cookie", newer.cookie))
        .status,
    ).toBe(401);
    const agent = request.agent(server.app),
      s = await agent.get("/api/session");
    let status = 0;
    for (let i = 0; i < 11; i++)
      status = (
        await agent
          .post("/api/login")
          .set("Origin", origin)
          .set("X-CSRF-Token", s.body.csrf)
          .send({ email: "naoexiste@example.edu", senha: "errada" })
      ).status;
    expect(status).toBe(429);
  });
  it("migrações são idempotentes, checam checksum e fazem rollback", () => {
    const b = new Banco(":memory:");
    migrarCore(b);
    migrarCore(b);
    expect(b.get("SELECT COUNT(*) AS n FROM schema_migrations")!.n).toBe(1);
    expect(() => b.migrar("core", 1, "SELECT 1")).toThrow("Checksum");
    expect(() =>
      b.migrar("falha", 1, "CREATE TABLE teste (id TEXT); INVALID SQL;"),
    ).toThrow();
    expect(
      b.get("SELECT 1 FROM sqlite_master WHERE name='teste'"),
    ).toBeUndefined();
    b.close();
  });
});
