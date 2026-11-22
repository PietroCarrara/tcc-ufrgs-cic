import { randomUUID, createHmac, timingSafeEqual } from "node:crypto";
import { Banco } from "../persistence/database.js";
import type { Config } from "../core/config.js";
import { hash } from "../core/session.js";
import {
  exigir,
  AppError,
  vazio,
  normalizar,
  textoVisivel,
  sobrepoe,
  percorrer,
  dias,
  horario,
  type User,
  type ProjetoDTO,
  type FonteDTO,
  type Intervalo,
  type AtividadeDTO,
  type RichText,
  validarDocumento,
} from "../../../../packages/shared/src/index.js";
const now = () => new Date().toISOString();
export class Dominio {
  constructor(
    public banco: Banco,
    public config: Config,
  ) {}
  usuario(id: string, privateData = false): User {
    const u = this.banco.get<User>(
      `SELECT id,nome,papel,${privateData ? "email_normalizado AS email," : ""}foto IS NOT NULL AS foto FROM usuarios WHERE id=?`,
      id,
    );
    exigir(u, 404, "NAO_ENCONTRADO", "Usuário não encontrado");
    return u;
  }
  notificar(
    dest: string,
    titulo: string,
    texto: string,
    link: string,
    tipo: string,
    contexto: unknown = {},
  ) {
    this.banco.run(
      "INSERT INTO notificacoes VALUES(?,?,?,?,0,?,?,?,?)",
      randomUUID(),
      dest,
      titulo,
      texto,
      link,
      tipo,
      JSON.stringify(contexto),
      now(),
    );
  }
  membros(id: string): User[] {
    return this.banco.all<User>(
      "SELECT u.id,u.nome,u.papel FROM usuarios u JOIN membros m ON m.usuario_id=u.id WHERE m.projeto_id=? ORDER BY u.nome,u.id",
      id,
    );
  }
  acesso(id: string, u: User, orientador = false) {
    exigir(
      this.banco.get(
        "SELECT 1 FROM membros WHERE projeto_id=? AND usuario_id=?",
        id,
        u.id,
      ),
      404,
      "NAO_ENCONTRADO",
      "Projeto não encontrado",
    );
    if (orientador)
      exigir(
        this.banco.get(
          "SELECT 1 FROM projeto_orientadores WHERE projeto_id=? AND usuario_id=?",
          id,
          u.id,
        ),
        403,
        "SEM_PERMISSAO",
        "Somente orientadores podem alterar membros",
      );
  }
  projeto(id: string, u: User): ProjetoDTO {
    this.acesso(id, u);
    const p = this.banco.get("SELECT * FROM projetos WHERE id=?", id)!;
    return {
      id: p.id,
      titulo: p.titulo,
      tituloIngles: p.titulo_ingles,
      resumo: JSON.parse(p.resumo_json),
      resumoIngles: JSON.parse(p.resumo_ingles_json),
      palavrasChave: JSON.parse(p.palavras_json),
      palavrasChaveIngles: JSON.parse(p.palavras_ingles_json),
      texto: JSON.parse(p.texto_json),
      versao: p.versao,
      membros: this.membros(id),
    };
  }
  checkVersion(actual: number, expected: number) {
    exigir(
      actual === expected,
      409,
      "VERSAO_DIVERGENTE",
      "Este recurso foi alterado. Recarregue e concilie suas mudanças.",
      { versao: actual },
    );
  }
  salvarProjeto(id: string, u: User, p: Omit<ProjetoDTO, "id" | "membros">) {
    return this.banco.transaction(() => {
      const old = this.projeto(id, u);
      this.checkVersion(old.versao, p.versao);
      const text = JSON.stringify(p.texto);
      exigir(
        Buffer.byteLength(text) <= this.config.documentLimit,
        413,
        "DOCUMENTO_GRANDE",
        "Documento excede o limite",
      );
      validarDocumento(p.texto);
      this.validarVinculos(id, p.texto, old.texto);
      const n = this.banco.run(
        "UPDATE projetos SET titulo=?,titulo_ingles=?,resumo_json=?,resumo_ingles_json=?,palavras_json=?,palavras_ingles_json=?,texto_json=?,versao=versao+1,atualizado_em=? WHERE id=? AND versao=?",
        p.titulo,
        p.tituloIngles,
        JSON.stringify(p.resumo),
        JSON.stringify(p.resumoIngles),
        JSON.stringify(p.palavrasChave),
        JSON.stringify(p.palavrasChaveIngles),
        text,
        now(),
        id,
        p.versao,
      );
      exigir(
        n.changes,
        409,
        "VERSAO_DIVERGENTE",
        "Projeto alterado por outro membro",
      );
      return this.projeto(id, u);
    });
  }
  validarVinculos(id: string, doc: RichText, previous: RichText) {
    const ids = new Set<string>(),
      targets: string[] = [];
    const oldOpaque = new Set<string>();
    percorrer(previous, (n) => {
      if (n.type === "opaque" || n.type === "opaqueInline")
        oldOpaque.add(JSON.stringify(n.attrs?.original));
      if (
        ![
          "doc",
          "paragraph",
          "text",
          "heading",
          "bulletList",
          "orderedList",
          "listItem",
          "blockquote",
          "hardBreak",
          "horizontalRule",
          "citation",
          "figure",
          "table",
          "tableRow",
          "tableCell",
          "tableHeader",
          "acronym",
          "internalReference",
          "opaque",
          "opaqueInline",
        ].includes(n.type)
      )
        oldOpaque.add(JSON.stringify(n));
    });
    percorrer(doc, (n) => {
      const a = n.attrs ?? {};
      if (a.id) ids.add(String(a.id));
      if (n.type === "internalReference") targets.push(String(a.targetId));
      if (n.type === "opaque" || n.type === "opaqueInline")
        exigir(
          oldOpaque.has(JSON.stringify(a.original)),
          400,
          "DOCUMENTO_INVALIDO",
          "Conteúdo opaco novo ou alterado não permitido",
        );
      if (n.type === "citation")
        exigir(
          this.banco.get(
            "SELECT 1 FROM fontes WHERE id=? AND projeto_id=?",
            String(a.sourceId),
            id,
          ),
          400,
          "FONTE_INVALIDA",
          "Fonte não pertence ao projeto",
        );
      if (n.type === "figure")
        exigir(
          this.banco.get(
            "SELECT 1 FROM arquivos WHERE id=? AND projeto_id=? AND mime LIKE 'image/%'",
            String(a.fileId),
            id,
          ),
          400,
          "ARQUIVO_INVALIDO",
          "Imagem não pertence ao projeto",
        );
    });
    for (const t of targets)
      exigir(
        ids.has(t),
        400,
        "REFERENCIA_INVALIDA",
        "Referência interna sem destino",
      );
  }
  enviarProposta(
    u: User,
    p: { professorId: string; titulo: string; descricao: string },
  ) {
    exigir(
      u.papel === "aluno",
      403,
      "SEM_PERMISSAO",
      "Somente alunos enviam propostas",
    );
    return this.banco.transaction(() => {
      exigir(
        this.banco.get(
          "SELECT 1 FROM professores WHERE usuario_id=?",
          p.professorId,
        ),
        404,
        "NAO_ENCONTRADO",
        "Professor não encontrado",
      );
      exigir(
        !this.banco.get(
          "SELECT 1 FROM propostas WHERE aluno_id=? AND professor_id=?",
          u.id,
          p.professorId,
        ),
        409,
        "PROPOSTA_DUPLICADA",
        "Já existe uma proposta pendente para este professor",
      );
      const id = randomUUID();
      this.banco.run(
        "INSERT INTO propostas VALUES(?,?,?,?,?,?)",
        id,
        u.id,
        p.professorId,
        p.titulo,
        p.descricao,
        now(),
      );
      this.notificar(
        p.professorId,
        "Nova proposta",
        `${u.nome} enviou a proposta “${p.titulo}”.`,
        "/propostas",
        "proposta",
        { id, titulo: p.titulo },
      );
      return this.banco.get("SELECT * FROM propostas WHERE id=?", id);
    });
  }
  aceitarProposta(id: string, u: User): ProjetoDTO {
    return this.banco.transaction(() => {
      const p = this.banco.get(
        "SELECT * FROM propostas WHERE id=? AND professor_id=?",
        id,
        u.id,
      );
      exigir(
        p,
        404,
        "NAO_ENCONTRADO",
        "Proposta não encontrada ou já processada",
      );
      const pid = randomUUID(),
        doc = JSON.stringify(vazio()),
        date = now();
      this.banco.run(
        "INSERT INTO projetos(id,titulo,resumo_json,resumo_ingles_json,texto_json,criado_em,atualizado_em) VALUES(?,?,?,?,?,?,?)",
        pid,
        p.titulo,
        doc,
        doc,
        doc,
        date,
        date,
      );
      this.banco.run(
        "INSERT INTO projeto_autores VALUES(?,?)",
        pid,
        p.aluno_id,
      );
      this.banco.run("INSERT INTO projeto_orientadores VALUES(?,?)", pid, u.id);
      this.notificar(
        p.aluno_id,
        "Proposta aceita",
        `${u.nome} aceitou “${p.titulo}”. Seu projeto está disponível.`,
        `/projetos/${pid}`,
        "aceite",
        { proposta: id, projeto: pid },
      );
      this.banco.run("DELETE FROM propostas WHERE id=?", id);
      return this.projeto(pid, u);
    });
  }
  rejeitarProposta(id: string, u: User, motivo: string) {
    exigir(motivo.trim(), 400, "MOTIVO_OBRIGATORIO", "Informe o motivo");
    this.banco.transaction(() => {
      const p = this.banco.get(
        "SELECT * FROM propostas WHERE id=? AND professor_id=?",
        id,
        u.id,
      );
      exigir(
        p,
        404,
        "NAO_ENCONTRADO",
        "Proposta não encontrada ou já processada",
      );
      this.notificar(
        p.aluno_id,
        "Proposta recusada",
        `${u.nome} recusou “${p.titulo}”. Motivo: ${motivo}`,
        "/propostas",
        "rejeicao",
        { titulo: p.titulo, motivo },
      );
      this.banco.run("DELETE FROM propostas WHERE id=?", id);
    });
  }
  alterarMembro(id: string, u: User, uid: string, v: number, remove = false) {
    return this.banco.transaction(() => {
      this.acesso(id, u, true);
      const p = this.projeto(id, u);
      this.checkVersion(p.versao, v);
      const target = this.usuario(uid);
      const table =
        target.papel === "aluno" ? "projeto_autores" : "projeto_orientadores";
      const exists = p.membros.some((x) => x.id === uid);
      if (remove) {
        exigir(exists, 404, "NAO_ENCONTRADO", "Membro não encontrado");
        exigir(
          p.membros.filter((x) => x.papel === target.papel).length > 1,
          409,
          "ULTIMO_MEMBRO",
          "O projeto precisa de ao menos um autor e um orientador",
        );
        this.banco.run(
          `DELETE FROM ${table} WHERE projeto_id=? AND usuario_id=?`,
          id,
          uid,
        );
      } else {
        exigir(!exists, 409, "MEMBRO_DUPLICADO", "Usuário já participa");
        this.banco.run(`INSERT INTO ${table} VALUES(?,?)`, id, uid);
        this.notificar(
          uid,
          "Novo projeto",
          `Você foi adicionado a “${p.titulo}”.`,
          `/projetos/${id}`,
          "membro",
        );
      }
      this.banco.run(
        "UPDATE projetos SET versao=versao+1,atualizado_em=? WHERE id=?",
        now(),
        id,
      );
      const conflitos = remove
        ? []
        : this.banco
            .all<AtividadeDTO>(
              "SELECT * FROM atividades WHERE projeto_id=?",
              id,
            )
            .flatMap((a) =>
              this.conflitos(id, a, a.id).filter((c) => c.usuarioId === uid),
            );
      return { versao: p.versao + 1, conflitos };
    });
  }
  agenda(uid: string): AtividadeDTO[] {
    return this.banco.all<AtividadeDTO>(
      "SELECT a.*,p.titulo AS projeto_titulo FROM atividades a LEFT JOIN projetos p ON p.id=a.projeto_id WHERE a.usuario_id=? OR a.projeto_id IN (SELECT projeto_id FROM membros WHERE usuario_id=?) ORDER BY a.dia,a.inicio,a.id",
      uid,
      uid,
    );
  }
  ocupacao(id: string, u: User) {
    this.acesso(id, u);
    return this.membros(id).flatMap((m) =>
      this.agenda(m.id).map((a) => ({
        usuarioId: m.id,
        nome: m.nome,
        id: a.id,
        versao: a.versao,
        dia: a.dia,
        inicio: a.inicio,
        fim: a.fim,
      })),
    );
  }
  conflitos(id: string, a: Intervalo, exclude?: string) {
    return this.membros(id)
      .flatMap((m) =>
        this.agenda(m.id)
          .filter((b) => b.id !== exclude && sobrepoe(a, b))
          .map((b) => ({
            usuarioId: m.id,
            nome: m.nome,
            atividadeId: b.id,
            versao: b.versao,
            dia: b.dia,
            inicio: b.inicio,
            fim: b.fim,
          })),
      )
      .sort((a, b) =>
        `${a.usuarioId}${a.atividadeId}`.localeCompare(
          `${b.usuarioId}${b.atividadeId}`,
        ),
      );
  }
  private assinar(payload: string) {
    return createHmac("sha256", this.config.secret)
      .update(payload)
      .digest("base64url");
  }
  private verificarToken(token: string | undefined, fingerprint: string) {
    if (!token) return false;
    const [data, sig] = token.split(".");
    if (!data || !sig) return false;
    const expected = this.assinar(data);
    if (
      sig.length !== expected.length ||
      !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
    )
      return false;
    try {
      const p = JSON.parse(Buffer.from(data, "base64url").toString());
      return p.expira > Date.now() && p.fingerprint === fingerprint;
    } catch {
      return false;
    }
  }
  salvarAtividade(
    u: User,
    a: Intervalo,
    id?: string,
    v?: number,
    projectId?: string,
    token?: string,
    chave?: string,
  ) {
    return this.banco.transaction(() => {
      if (projectId) this.acesso(projectId, u);
      const operation = `reuniao:${projectId ?? u.id}`;
      const fingerprint = hash(JSON.stringify(a));
      if (!id && projectId) {
        const replay = this.repeticao(u.id, operation, chave, fingerprint);
        if (replay) return replay;
      }
      if (id) {
        const old = this.banco.get<AtividadeDTO>(
          `SELECT * FROM atividades WHERE id=? AND ${projectId ? "projeto_id" : "usuario_id"}=?`,
          id,
          projectId ?? u.id,
        );
        exigir(old, 404, "NAO_ENCONTRADO", "Atividade não encontrada");
        this.checkVersion(old.versao, v!);
      }
      let proof: string | null = null;
      if (projectId) {
        const conflicts = this.conflitos(projectId, a, id);
        const check = hash(
          JSON.stringify({
            usuario: u.id,
            projectId,
            id: id ?? null,
            v: v ?? null,
            a,
            membros: this.membros(projectId)
              .map((m) => m.id)
              .sort(),
            conflicts,
          }),
        );
        if (conflicts.length && !this.verificarToken(token, check)) {
          const data = Buffer.from(
            JSON.stringify({ fingerprint: check, expira: Date.now() + 300000 }),
          ).toString("base64url");
          throw new AppError(
            409,
            "CONFLITO_DE_HORARIOS",
            "Há participantes ocupados nesse horário.",
            { conflitos: conflicts, token: `${data}.${this.assinar(data)}` },
          );
        }
        if (conflicts.length) proof = token!;
      }
      const aid = id ?? randomUUID();
      if (id)
        this.banco.run(
          "UPDATE atividades SET dia=?,inicio=?,fim=?,descricao=?,versao=versao+1,confirmacao=?,atualizado_em=? WHERE id=?",
          a.dia,
          a.inicio,
          a.fim,
          a.descricao,
          proof,
          now(),
          id,
        );
      else
        this.banco.run(
          "INSERT INTO atividades VALUES(?,?,?,?,?,?,?,1,?,?,?)",
          aid,
          projectId ? null : u.id,
          projectId ?? null,
          a.dia,
          a.inicio,
          a.fim,
          a.descricao,
          proof,
          now(),
          now(),
        );
      if (projectId)
        this.avisarReuniao(projectId, u, a, id ? "alterada" : "criada");
      const result = this.banco.get<AtividadeDTO>(
        "SELECT id,usuario_id,projeto_id,dia,inicio,fim,descricao,versao FROM atividades WHERE id=?",
        aid,
      )!;
      if (!id && projectId)
        this.registrarRepeticao(u.id, operation, chave!, fingerprint, result);
      return result;
    });
  }
  excluirAtividade(u: User, id: string, v: number, projectId?: string) {
    this.banco.transaction(() => {
      if (projectId) this.acesso(projectId, u);
      const a = this.banco.get<AtividadeDTO>(
        `SELECT * FROM atividades WHERE id=? AND ${projectId ? "projeto_id" : "usuario_id"}=?`,
        id,
        projectId ?? u.id,
      );
      exigir(a, 404, "NAO_ENCONTRADO", "Atividade não encontrada");
      this.checkVersion(a.versao, v);
      this.banco.run("DELETE FROM atividades WHERE id=?", id);
      if (projectId) this.avisarReuniao(projectId, u, a, "excluída");
    });
  }
  private avisarReuniao(id: string, u: User, a: Intervalo, change: string) {
    for (const m of this.membros(id))
      if (m.id !== u.id)
        this.notificar(
          m.id,
          `Reunião ${change}`,
          `${dias[a.dia]}, ${horario(a.inicio)}–${horario(a.fim)}: ${a.descricao}`,
          `/projetos/${id}?aba=reunioes`,
          "reuniao",
          { ...a, change },
        );
  }
  repeticao(
    uid: string,
    op: string,
    key: string | undefined,
    fingerprint: string,
  ): any {
    exigir(
      key && key.length <= 100,
      400,
      "IDEMPOTENCIA_OBRIGATORIA",
      "Envie Idempotency-Key (até 100 caracteres)",
    );
    this.banco.run("DELETE FROM idempotencia WHERE expira<?", Date.now());
    const row = this.banco.get(
      "SELECT * FROM idempotencia WHERE usuario_id=? AND operacao=? AND chave=?",
      uid,
      op,
      key,
    );
    if (row) {
      exigir(
        row.fingerprint === fingerprint,
        409,
        "CHAVE_REUTILIZADA",
        "Chave de repetição reutilizada para outra operação",
      );
      return JSON.parse(row.resultado_json);
    }
  }
  registrarRepeticao(
    uid: string,
    op: string,
    key: string,
    fingerprint: string,
    result: unknown,
  ) {
    this.banco.run(
      "INSERT INTO idempotencia VALUES(?,?,?,?,?,?)",
      uid,
      op,
      key,
      fingerprint,
      JSON.stringify(result),
      Date.now() + 86400000,
    );
  }
  fontes(id: string): FonteDTO[] {
    return this.banco
      .all("SELECT * FROM fontes WHERE projeto_id=? ORDER BY criado_em,id", id)
      .map((f) => ({ ...f, autores: JSON.parse(f.autores_json) }) as FonteDTO);
  }
  salvarFonte(
    id: string,
    u: User,
    f: Omit<FonteDTO, "id" | "projeto_id" | "versao"> & {
      permitirSemelhante?: boolean;
    },
    fid?: string,
    v?: number,
  ) {
    this.acesso(id, u);
    return this.banco.transaction(() => this.persistirFonte(id, f, fid, v));
  }
  persistirFonte(
    id: string,
    f: Omit<FonteDTO, "id" | "projeto_id" | "versao"> & {
      permitirSemelhante?: boolean;
    },
    fid?: string,
    v?: number,
  ) {
    const all = this.fontes(id);
    if (fid) {
      const old = all.find((x) => x.id === fid);
      exigir(old, 404, "NAO_ENCONTRADO", "Fonte não encontrada");
      this.checkVersion(old.versao, v!);
    }
    const doi = f.doi
      ? normalizar(f.doi.replace(/^https?:\/\/(dx\.)?doi.org\//, ""))
      : null;
    for (const other of all.filter((x) => x.id !== fid)) {
      const exact =
        (doi && other.doi === doi) ||
        (f.provedor &&
          f.externo_id &&
          other.provedor === f.provedor &&
          other.externo_id === f.externo_id);
      const approx =
        normalizar(other.titulo) === normalizar(f.titulo) &&
        normalizar(other.autores.join(" ")) ===
          normalizar(f.autores.join(" ")) &&
        other.publicacao === (f.publicacao ?? null);
      exigir(
        !exact && (!approx || f.permitirSemelhante),
        409,
        exact ? "FONTE_DUPLICADA" : "FONTE_SEMELHANTE",
        exact
          ? "Fonte já cadastrada"
          : "Existe uma fonte semelhante. Confirme para cadastrar outra.",
        { fonte: other },
      );
    }
    const sourceId = fid ?? randomUUID();
    const bib = f.bibtex || gerarBibtex(sourceId, f);
    if (fid)
      this.banco.run(
        "UPDATE fontes SET titulo=?,autores_json=?,link=?,publicacao=?,doi=?,provedor=?,externo_id=?,bibtex=?,versao=versao+1,atualizado_em=? WHERE id=?",
        f.titulo,
        JSON.stringify(f.autores),
        f.link ?? null,
        f.publicacao ?? null,
        doi,
        f.provedor ?? null,
        f.externo_id ?? null,
        bib,
        now(),
        fid,
      );
    else
      this.banco.run(
        "INSERT INTO fontes VALUES(?,?,?,?,?,?,?,?,?,?,1,?,?)",
        sourceId,
        id,
        f.titulo,
        JSON.stringify(f.autores),
        f.link ?? null,
        f.publicacao ?? null,
        doi,
        f.provedor ?? null,
        f.externo_id ?? null,
        bib,
        now(),
        now(),
      );
    return this.fontes(id).find((x) => x.id === sourceId)!;
  }
  verificarUso(id: string, item: string, kind: "sourceId" | "fileId") {
    const p = this.banco.get("SELECT texto_json FROM projetos WHERE id=?", id)!;
    let count = 0;
    percorrer(JSON.parse(p.texto_json), (n) => {
      if (n.attrs?.[kind] === item) count++;
      if (
        (n.type === "opaque" || n.type === "opaqueInline") &&
        JSON.stringify(n.attrs?.original).includes(item)
      )
        count++;
    });
    exigir(
      !count,
      409,
      "RECURSO_EM_USO",
      `Remova os ${count} usos no documento e salve antes de excluir.`,
      { usos: count },
    );
  }
  perfil(uid: string) {
    const u = this.usuario(uid, true),
      p = this.banco.get("SELECT * FROM professores WHERE usuario_id=?", uid);
    return {
      ...u,
      ...(p
        ? {
            biografia: JSON.parse(p.biografia_json),
            sugestoes: JSON.parse(p.sugestoes_json),
          }
        : {}),
    };
  }
  atualizarPerfil(
    u: User,
    nome: string,
    bio?: RichText,
    sugestoes?: RichText[],
  ) {
    return this.banco.transaction(() => {
      this.banco.run(
        "UPDATE usuarios SET nome=?,atualizado_em=? WHERE id=?",
        nome,
        now(),
        u.id,
      );
      if (u.papel === "professor") {
        const old = this.perfil(u.id);
        const b = bio ?? old.biografia,
          s = sugestoes ?? old.sugestoes;
        this.banco.run(
          "UPDATE professores SET biografia_json=?,sugestoes_json=?,busca=? WHERE usuario_id=?",
          JSON.stringify(b),
          JSON.stringify(s),
          normalizar(
            `${nome} ${textoVisivel(b)} ${s.map(textoVisivel).join(" ")}`,
          ),
          u.id,
        );
      }
      return this.perfil(u.id);
    });
  }
}
export function gerarBibtex(
  id: string,
  f: {
    titulo: string;
    autores: string[];
    link?: string | null;
    publicacao?: string | null;
  },
) {
  const escape = (s: string) =>
    s.replace(/\\/g, "\\textbackslash{}").replace(/[{}%&#_]/g, (c) => `\\${c}`);
  return `@misc{fonte${id.replaceAll("-", "")},\n  title = {${escape(f.titulo)}}${f.autores.length ? `,\n  author = {${f.autores.map(escape).join(" and ")}}` : ""}${f.publicacao ? `,\n  year = {${f.publicacao.slice(0, 4)}}` : ""}${f.link ? `,\n  url = {${escape(f.link)}}` : ""}\n}`;
}
