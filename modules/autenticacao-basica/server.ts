import { scrypt, randomBytes, timingSafeEqual, randomUUID } from "node:crypto";
import type {
  ModuloServidor,
  RegistroServidor,
} from "../../packages/module-sdk/src/server.js";
import {
  loginSchema,
  exigir,
  type User,
} from "../../packages/shared/src/index.js";
import type { Banco } from "../../apps/server/src/persistence/database.js";
import { Limite } from "../../apps/server/src/core/session.js";
const params = { N: 16384, r: 8, p: 1, keylen: 64 };
const derive = (senha: string, salt: string, length: number) =>
  new Promise<Buffer>((resolve, reject) => {
    scrypt(
      senha,
      salt,
      length,
      { N: params.N, r: params.r, p: params.p, maxmem: 64 * 1024 * 1024 },
      (error, result) => (error ? reject(error) : resolve(result)),
    );
  });
export const manifesto = {
  id: "autenticacao-basica",
  nome: "Autenticação básica",
  versao: 1,
  apiVersion: 1 as const,
  capacidades: ["autenticacao", "login-basico"],
};
export function registrarTabelasBancoDeDados(b: Banco) {
  b.migrar(
    manifesto.id,
    1,
    `CREATE TABLE auth_basica_credenciais(usuario_id TEXT PRIMARY KEY REFERENCES usuarios(id),hash BLOB NOT NULL,salt TEXT NOT NULL,parametros_json TEXT NOT NULL) STRICT;`,
  );
}
export async function definirSenha(b: Banco, uid: string, senha: string) {
  exigir(
    senha.length >= 12 && senha.length <= 128,
    400,
    "SENHA_INVALIDA",
    "A senha deve ter 12 a 128 caracteres",
  );
  const salt = randomBytes(32).toString("hex");
  const key = (await derive(senha, salt, 64)) as Buffer;
  b.transaction(() => {
    b.run(
      "INSERT INTO auth_basica_credenciais VALUES(?,?,?,?) ON CONFLICT(usuario_id) DO UPDATE SET hash=excluded.hash,salt=excluded.salt,parametros_json=excluded.parametros_json",
      uid,
      key,
      salt,
      JSON.stringify(params),
    );
    b.run("DELETE FROM sessoes WHERE usuario_id=?", uid);
  });
}
export class AutenticacaoBasica implements ModuloServidor {
  manifesto = manifesto;
  async login(b: Banco, email: string, senha: string) {
    const row = b.get(
      "SELECT c.*,u.id,u.nome,u.papel,u.email_normalizado AS email FROM auth_basica_credenciais c JOIN usuarios u ON u.id=c.usuario_id WHERE u.email_normalizado=?",
      email.toLowerCase().trim(),
    );
    const result = (await derive(
      senha,
      row?.salt ?? "0".repeat(64),
      64,
    )) as Buffer;
    exigir(
      row &&
        result.length === row.hash.length &&
        timingSafeEqual(result, row.hash),
      401,
      "CREDENCIAIS_INVALIDAS",
      "E-mail ou senha inválidos",
    );
    return {
      id: row.id,
      nome: row.nome,
      email: row.email,
      papel: row.papel,
    } as User;
  }
  inicializar(r: RegistroServidor) {
    const { banco, sessoes } = r.servicos;
    registrarTabelasBancoDeDados(banco);
    const ip = new Limite(40, 900000),
      account = new Limite(10, 900000);
    r.registrarRotaAPI(
      "/api/login/",
      async (req, res) => {
        ip.consumir(req.ip ?? "desconhecido");
        account.consumir(req.body.email.toLowerCase().trim());
        const user = await this.login(banco, req.body.email, req.body.senha);
        res.json(sessoes.criar(req, res, user, manifesto.id));
      },
      { publica: true, schema: loginSchema },
    );
    r.registrarMetodo(
      "autenticacao-basica.definirSenha",
      async (uid: string, senha: string) => definirSenha(banco, uid, senha),
    );
  }
}
export async function provisionar(
  b: Banco,
  nome: string,
  email: string,
  papel: "aluno" | "professor",
  senha: string,
) {
  exigir(
    senha.length >= 12 && senha.length <= 128,
    400,
    "SENHA_INVALIDA",
    "A senha deve ter 12 a 128 caracteres",
  );
  const existing = b.get<User>(
    "SELECT id,papel FROM usuarios WHERE email_normalizado=?",
    email.toLowerCase().trim(),
  );
  if (existing)
    exigir(
      existing.papel === papel,
      409,
      "PAPEL_DIVERGENTE",
      "Papel da conta existente não pode ser alterado",
    );
  const id = existing?.id ?? randomUUID();
  if (!existing) {
    const date = new Date().toISOString();
    b.transaction(() => {
      b.run(
        "INSERT INTO usuarios VALUES(?,?,?,?,NULL,NULL,?,?)",
        id,
        nome,
        email.toLowerCase().trim(),
        papel,
        date,
        date,
      );
      if (papel === "professor")
        b.run(
          "INSERT INTO professores VALUES(?,?,?,?)",
          id,
          '{"type":"doc","content":[{"type":"paragraph"}]}',
          "[]",
          nome
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase(),
        );
    });
  }
  await definirSenha(b, id, senha);
  return id;
}
export default new AutenticacaoBasica();
