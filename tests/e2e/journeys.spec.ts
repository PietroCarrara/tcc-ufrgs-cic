import { test, expect, type Page } from "@playwright/test";
async function login(page: Page, email: string, base = "") {
  await page.goto(`${base}/`);
  await page.getByRole("link", { name: "Entrar com e-mail" }).click();
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByLabel("Senha", { exact: true }).fill("TesteNavegador!2026");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByRole("heading", { name: /Olá,/ })).toBeVisible();
}
test("jornada completa: proposta, aceite, escrita, fontes, agenda, reuniões e PDF", async ({
  browser,
}) => {
  const context = await browser.newContext(),
    page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await login(page, "ana@teste.edu");
  await page.getByRole("link", { name: "◎ Orientadores" }).click();
  await page.getByLabel("Nome, biografia ou tema de pesquisa").fill("Marina");
  await page.getByRole("button", { name: "Filtrar", exact: true }).click();
  await expect(page.locator(".professor-card")).toHaveCount(1);
  await page.getByRole("button", { name: "Ver perfil" }).click();
  await page
    .getByLabel("Título sugerido")
    .fill("Pesquisa colaborativa no navegador");
  await page
    .getByLabel("Descrição da proposta")
    .fill("Investigar a escrita acadêmica com apoio modular.");
  await page.getByRole("button", { name: "Enviar proposta" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Proposta enviada" }),
  ).toBeVisible();
  const pc = await browser.newContext(),
    teacher = await pc.newPage();
  teacher.on("pageerror", (e) => errors.push(e.message));
  await login(teacher, "marina@teste.edu");
  await teacher.getByRole("link", { name: "↗ Propostas" }).click();
  await teacher
    .getByRole("button", { name: "Aceitar e criar projeto" })
    .click();
  await expect(
    teacher.getByRole("heading", {
      name: "Pesquisa colaborativa no navegador",
    }),
  ).toBeVisible();
  await expect(teacher).toHaveURL(/\/projetos\/[a-f0-9-]+$/);
  const projectUrl = teacher.url();
  await page.goto(projectUrl);
  await page
    .getByRole("textbox", { name: "Texto do projeto" })
    .fill("Introdução à pesquisa colaborativa.");
  await expect(
    page.getByRole("status").filter({ hasText: "Salvo" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "Texto do projeto" }),
  ).toContainText("Introdução à pesquisa colaborativa.");
  await page.getByRole("button", { name: "Fontes", exact: true }).click();
  await page.getByRole("button", { name: "+ Fonte manual" }).click();
  await page
    .getByLabel("Título", { exact: true })
    .fill("Práticas de pesquisa científica");
  await page
    .getByLabel("Autores, separados")
    .fill("Ana Pesquisadora; João Autor");
  await page.getByRole("button", { name: "Salvar fonte", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Práticas de pesquisa científica" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Escrita", exact: true }).click();
  await page.getByRole("textbox", { name: "Texto do projeto" }).click();
  await page.keyboard.press("End");
  await page.getByRole("button", { name: "+ Fonte", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Fonte", exact: true })
    .selectOption({ label: "Práticas de pesquisa científica" });
  await page.getByLabel("Localizador").fill("p. 5");
  await page.getByRole("button", { name: "Inserir", exact: true }).click();
  await page.getByRole("button", { name: "Salvar agora" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Salvo" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Buscar referências", exact: true })
    .click();
  await expect(
    page.getByText("Busca integrada indisponível:", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Buscar no Scholar" }),
  ).toBeDisabled();
  await page.getByRole("link", { name: "▦ Minha semana" }).click();
  await page.getByRole("button", { name: "+ Nova atividade" }).click();
  await page.getByLabel("Descrição", { exact: true }).fill("Aula particular");
  await page
    .getByRole("combobox", { name: "Dia", exact: true })
    .selectOption("1");
  await page
    .getByRole("combobox", { name: "Início", exact: true })
    .selectOption("540");
  await page
    .getByRole("combobox", { name: "Fim", exact: true })
    .selectOption("600");
  await page.getByRole("button", { name: "Salvar horário" }).click();
  await expect(
    page.locator(".schedule-event").filter({ hasText: "Aula particular" }),
  ).toBeVisible();
  await teacher.getByRole("button", { name: "Reuniões", exact: true }).click();
  await teacher.getByRole("button", { name: "+ Nova reunião" }).click();
  await teacher
    .getByLabel("Descrição", { exact: true })
    .fill("Orientação semanal");
  await teacher
    .getByRole("combobox", { name: "Início", exact: true })
    .selectOption("540");
  await teacher
    .getByRole("combobox", { name: "Fim", exact: true })
    .selectOption("600");
  await teacher.getByRole("button", { name: "Salvar horário" }).click();
  await expect(
    teacher.getByRole("heading", { name: "Conflito de horários" }),
  ).toBeVisible();
  await teacher.getByRole("button", { name: "Salvar mesmo assim" }).click();
  await expect(
    teacher.getByRole("heading", { name: "Orientação semanal" }),
  ).toBeVisible();
  await page.goto(projectUrl);
  page.on("dialog", (dialog) => dialog.accept());
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar PDF" }).click();
  const download = await downloaded;
  expect(download.suggestedFilename()).toBe("projeto.pdf");
  await page.screenshot({ path: "output/e2e-projeto.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "output/e2e-mobile.png", fullPage: true });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
  await context.close();
  await pc.close();
});
test("duas abas: conflito explícito e recuperação local após falha de rede", async ({
  browser,
}) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, "ana@teste.edu");
  await page
    .locator(".project-card")
    .filter({ hasText: "Pesquisa colaborativa no navegador" })
    .click();
  const url = page.url();
  const second = await context.newPage();
  await second.goto(url);
  await expect(
    second.getByRole("textbox", { name: "Texto do projeto" }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Texto do projeto" })
    .fill("Versão da primeira aba.");
  await page.getByRole("button", { name: "Salvar agora" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Salvo" }),
  ).toBeVisible();
  await second
    .getByRole("textbox", { name: "Texto do projeto" })
    .fill("Minha conciliação na segunda aba.");
  await second.getByRole("button", { name: "Salvar agora" }).click();
  await expect(
    second.getByRole("heading", { name: "Outro membro alterou o projeto" }),
  ).toBeVisible();
  await second
    .getByRole("button", { name: "Salvar minha versão conciliada" })
    .click();
  await expect(
    second.getByRole("status").filter({ hasText: "Salvo" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "Texto do projeto" }),
  ).toContainText("Minha conciliação");
  await page.route("**/api/projetos/*/documento", (route) => route.abort());
  await page
    .getByRole("textbox", { name: "Texto do projeto" })
    .fill("Rascunho preservado após desconexão.");
  await page.getByRole("button", { name: "Salvar agora" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Erro ao salvar" }),
  ).toBeVisible();
  page.on("dialog", (d) => d.accept());
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Rascunho recuperável encontrado" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Recuperar rascunho" }).click();
  await expect(
    page.getByRole("textbox", { name: "Texto do projeto" }),
  ).toContainText("Rascunho preservado");
  await page.unroute("**/api/projetos/*/documento");
  await page.getByRole("button", { name: "Salvar agora" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Salvo" }),
  ).toBeVisible();
  await context.close();
});
test("agenda por arraste, edição e exclusão; navegação pública e login inválido", async ({
  page,
}) => {
  await page.goto("/autenticacao");
  await page.getByLabel("E-mail", { exact: true }).fill("bruno@teste.edu");
  await page.getByLabel("Senha", { exact: true }).fill("errada");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "E-mail ou senha inválidos",
  );
  await page.getByLabel("Senha", { exact: true }).fill("TesteNavegador!2026");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.getByRole("link", { name: "▦ Minha semana" }).click();
  const first = page
      .locator(".day-column")
      .first()
      .locator(".time-slot")
      .nth(1),
    last = page.locator(".day-column").first().locator(".time-slot").nth(4);
  const a = await first.boundingBox(),
    b = await last.boundingBox();
  await page.mouse.move(a!.x + 15, a!.y + 4);
  await page.mouse.down();
  await page.mouse.move(b!.x + 15, b!.y + 4, { steps: 6 });
  await page.mouse.up();
  await page
    .getByLabel("Descrição", { exact: true })
    .fill("Arraste de domingo");
  await page.getByRole("button", { name: "Salvar horário" }).click();
  const event = page
    .locator(".schedule-event")
    .filter({ hasText: "Arraste de domingo" });
  await event.click();
  await page.getByLabel("Descrição", { exact: true }).fill("Atividade editada");
  await page.getByRole("button", { name: "Salvar horário" }).click();
  await page
    .locator(".schedule-event")
    .filter({ hasText: "Atividade editada" })
    .click();
  page.on("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Excluir atividade" }).click();
  await expect(page.locator(".schedule-event")).toHaveCount(0);
  await page.getByRole("button", { name: "Sair", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Entrar com e-mail" }),
  ).toBeVisible();
});

test("módulo instalado contribui tela e aba sem editar o núcleo", async ({
  page,
}) => {
  await login(page, "ana@teste.edu");
  await page.getByRole("link", { name: "Exemplo", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Módulo de exemplo" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "⌂ Meus projetos" }).click();
  await page.locator(".project-card").first().click();
  await page.getByRole("button", { name: "Exemplo", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Módulo de exemplo" }),
  ).toBeVisible();
});

test("elementos acadêmicos, metadados e anexos sobrevivem ao reload", async ({
  page,
}) => {
  await login(page, "ana@teste.edu");
  await page.locator(".project-card").first().click();
  const url = page.url();
  await page.getByRole("button", { name: "Arquivos", exact: true }).click();
  await page
    .getByLabel("Selecione um arquivo")
    .setInputFiles("tests/fixtures/figura.png");
  await page
    .getByRole("button", { name: "Enviar arquivo", exact: true })
    .click();
  await expect(page.getByRole("heading", { name: "figura.png" })).toBeVisible();
  await page.getByRole("button", { name: "Escrita", exact: true }).click();
  const editor = page.getByRole("textbox", { name: "Texto do projeto" });
  await editor.fill("Introdução acadêmica");
  await page
    .getByRole("button", { name: "Seção nível 1", exact: true })
    .click();
  await editor.press("End");
  await editor.press("Enter");
  await editor.pressSequentially("Métodos");
  await page
    .getByRole("button", { name: "Seção nível 2", exact: true })
    .click();
  await editor.press("End");
  await editor.press("Enter");
  await editor.pressSequentially("Procedimentos");
  await page
    .getByRole("button", { name: "Seção nível 3", exact: true })
    .click();
  await editor.press("End");
  await editor.press("Enter");
  await page.getByRole("button", { name: "+ Figura", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Imagem anexada" })
    .selectOption({ label: "figura.png" });
  await page
    .getByLabel("Legenda", { exact: true })
    .fill("Gráfico de verificação");
  await page
    .getByLabel("Texto alternativo")
    .fill("Comparação de três dimensões da pesquisa");
  await page.getByRole("button", { name: "Inserir", exact: true }).click();
  await editor.press("ArrowDown");
  await page.getByRole("button", { name: "+ Tabela", exact: true }).click();
  await page.getByLabel("Legenda da tabela").fill("Matriz de resultados");
  await page.getByRole("button", { name: "Inserir", exact: true }).click();
  await page.getByRole("button", { name: "+ Sigla", exact: true }).click();
  await page.getByLabel("Sigla", { exact: true }).fill("TCC");
  await page.getByLabel("Expansão").fill("Trabalho de Conclusão de Curso");
  await page.getByRole("button", { name: "Inserir", exact: true }).click();
  await page
    .getByRole("button", { name: "+ Referência interna", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Elemento de destino" })
    .selectOption({ label: "Figura 1" });
  await page.getByRole("button", { name: "Inserir", exact: true }).click();
  await page.getByRole("button", { name: "Salvar agora" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Salvo" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Dados do projeto", exact: true })
    .click();
  await page.getByLabel("Título em inglês").fill("Academic research");
  await page
    .getByRole("textbox", { name: "Resumo em português", exact: true })
    .fill("Resumo com conteúdo em português.");
  await page
    .getByRole("textbox", { name: "Abstract", exact: true })
    .fill("Abstract with English content.");
  await page.getByLabel("Palavras-chave,").fill("ciência; colaboração");
  await page.getByLabel("Keywords,").fill("science; collaboration");
  await page.getByRole("button", { name: "Salvar agora" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Salvo" }),
  ).toBeVisible();
  await page.goto(url);
  await expect(page.locator(".academic-node.figure img")).toBeVisible();
  await expect(page.locator(".writing-surface table")).toBeVisible();
  await page.getByRole("button", { name: "Prévia acadêmica" }).click();
  await expect(page.locator(".paper")).toContainText("1 Introdução acadêmica");
  await expect(page.locator(".paper")).toContainText("1.1 Métodos");
  await expect(page.locator(".paper")).toContainText("1.1.1 Procedimentos");
  await expect(page.locator(".paper")).toContainText("Matriz de resultados");
  await expect(page.locator(".paper")).toContainText("Lista de siglas");
});

test("busca integrada: HTTP do provedor controlado, arraste e alternativa por botão", async ({
  page,
}) => {
  const { Servidor } = await import("../../apps/server/src/core/server.js");
  const { default: auth, provisionar } =
    await import("../../modules/autenticacao-basica/server.js");
  const { criarModuloBusca } =
    await import("../../modules/busca-scholar/server.js");
  const { readFileSync } = await import("node:fs");
  const fixture = JSON.parse(
    readFileSync("tests/fixtures/scholar.json", "utf8"),
  );
  let calls = 0;
  const s = await new Servidor({
    database: ":memory:",
    serpapiKey: "test-only-key",
  }).inicializar([
    auth,
    criarModuloBusca(async (url) => {
      expect(new URL(String(url)).hostname).toBe("serpapi.com");
      calls++;
      return Response.json(fixture);
    }),
  ]);
  const http = s.app.listen(0, "127.0.0.1");
  await new Promise<void>((r) => http.once("listening", r));
  const port = (http.address() as { port: number }).port;
  s.config.origin = `http://127.0.0.1:${port}`;
  try {
    const uid = await provisionar(
        s.banco,
        "Aluno Busca",
        "busca@teste.edu",
        "aluno",
        "TesteNavegador!2026",
      ),
      pid = await provisionar(
        s.banco,
        "Orientador Busca",
        "orienta@teste.edu",
        "professor",
        "TesteNavegador!2026",
      );
    const user = s.dominio.usuario(uid),
      professor = s.dominio.usuario(pid);
    const proposal = s.dominio.enviarProposta(user, {
      professorId: pid,
      titulo: "Projeto bibliográfico",
      descricao: "Pesquisa",
    })!;
    const project = s.dominio.aceitarProposta(proposal.id, professor);
    await login(page, "busca@teste.edu", s.config.origin);
    await page.goto(`${s.config.origin}/projetos/${project.id}`);
    await page
      .getByRole("button", { name: "Buscar referências", exact: true })
      .click();
    await page.getByLabel("Termos da pesquisa").fill("ciência");
    await page.getByRole("button", { name: "Buscar no Scholar" }).click();
    await expect(page.locator(".search-result")).toHaveCount(2);
    await page
      .locator(".search-result")
      .first()
      .dragTo(page.locator(".sources-panel"));
    await expect(page.getByLabel("Título", { exact: true })).toHaveValue(
      "Pesquisa e colaboração",
    );
    await page
      .getByRole("button", { name: "Salvar fonte", exact: true })
      .click();
    await expect(page.locator(".source-card")).toContainText(
      "Pesquisa e colaboração",
    );
    await page
      .locator(".search-result")
      .nth(1)
      .getByRole("button", { name: "Adicionar fonte" })
      .click();
    await expect(page.getByLabel("Autores, separados")).toHaveValue("");
    await page
      .getByRole("button", { name: "Salvar fonte", exact: true })
      .click();
    await expect(page.locator(".source-card")).toHaveCount(2);
    expect(calls).toBe(1);
    await page.reload();
    await page.getByRole("button", { name: "Fontes", exact: true }).click();
    await expect(page.locator(".source-card")).toHaveCount(2);
    expect(s.dominio.fontes(project.id)[1].publicacao).toBeNull();
  } finally {
    await new Promise<void>((r) => http.close(() => r()));
    await s.close();
  }
});
