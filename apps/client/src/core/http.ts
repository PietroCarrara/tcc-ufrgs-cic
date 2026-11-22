import { ref } from "vue";
import type {
  User,
  Collection,
} from "../../../../packages/shared/src/index.js";
export const usuario = ref<User | null>(null),
  csrf = ref("");
export class ApiError extends Error {
  constructor(
    public status: number,
    public codigo: string,
    message: string,
    public detalhes?: any,
  ) {
    super(message);
  }
}
export async function api<T = any>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData))
    headers.set("Content-Type", "application/json");
  if (options.method && !["GET", "HEAD"].includes(options.method))
    headers.set("X-CSRF-Token", csrf.value);
  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
      credentials: "same-origin",
    });
  } catch {
    throw new ApiError(
      0,
      "SEM_CONEXAO",
      "Não foi possível conectar. Seu rascunho permanece neste navegador.",
    );
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => ({
      erro: {
        codigo: "ERRO_HTTP",
        mensagem: "Não foi possível concluir a operação",
      },
    }));
    if (
      response.status === 401 &&
      payload.erro.codigo !== "CREDENCIAIS_INVALIDAS"
    )
      usuario.value = null;
    throw new ApiError(
      response.status,
      payload.erro.codigo,
      payload.erro.mensagem,
      payload.erro.detalhes,
    );
  }
  if (response.status === 204) return undefined as T;
  return response.headers.get("content-type")?.includes("application/json")
    ? response.json()
    : (response.blob() as Promise<T>);
}
export const enviar = <T = any>(
  url: string,
  body: unknown = {},
  method = "POST",
  headers?: HeadersInit,
) => api<T>(url, { method, body: JSON.stringify(body), headers });
export async function restaurar() {
  const data = await api<{ usuario: User | null; csrf: string }>(
    "/api/session",
  );
  usuario.value = data.usuario;
  csrf.value = data.csrf;
}
export async function todos<T>(url: string): Promise<T[]> {
  const sep = url.includes("?") ? "&" : "?";
  const result: T[] = [];
  let pagina = 1,
    total = Infinity;
  while (result.length < total) {
    const r = await api<Collection<T>>(
      `${url}${sep}limite=100&pagina=${pagina++}`,
    );
    result.push(...r.itens);
    total = r.total;
    if (!r.itens.length) break;
  }
  return result;
}
export async function download(url: string, body: unknown, nome: string) {
  const blob = await enviar<Blob>(url, body);
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}
