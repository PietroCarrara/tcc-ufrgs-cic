import { randomBytes } from "node:crypto";
export interface Config {
  port: number;
  database: string;
  origin: string;
  timezone: string;
  secure: boolean;
  secret: string;
  jsonLimit: number;
  documentLimit: number;
  uploadLimit: number;
  photoLimit: number;
  projectFilesLimit: number;
  production: boolean;
  modulesFile: string;
  allowNoAuth?: boolean;
  serpapiKey?: string;
}
export function config(overrides: Partial<Config> = {}): Config {
  const production = process.env.NODE_ENV === "production";
  const secret =
    process.env.CONFIRMATION_SECRET ||
    (!production ? randomBytes(32).toString("hex") : "");
  const c = {
    port: Number(process.env.PORT ?? 3000),
    database: process.env.DATABASE_PATH ?? "data/tcc.sqlite",
    origin: process.env.APP_ORIGIN ?? "http://localhost:5173",
    timezone: process.env.APP_TIMEZONE ?? "America/Sao_Paulo",
    secure: process.env.COOKIE_SECURE === "true",
    secret,
    jsonLimit: Number(process.env.JSON_LIMIT_BYTES ?? 2097152),
    documentLimit: Number(process.env.DOCUMENT_LIMIT_BYTES ?? 1048576),
    uploadLimit: Number(process.env.UPLOAD_LIMIT_BYTES ?? 10485760),
    photoLimit: Number(process.env.PHOTO_LIMIT_BYTES ?? 2097152),
    projectFilesLimit: Number(
      process.env.PROJECT_FILES_LIMIT_BYTES ?? 104857600,
    ),
    production,
    modulesFile: "config/modules.server.json",
    serpapiKey: process.env.SERPAPI_API_KEY,
    ...overrides,
  };
  if (c.secret.length < 32)
    throw new Error("CONFIRMATION_SECRET deve ter pelo menos 32 caracteres");
  if (c.production && (!c.secure || !c.origin.startsWith("https://")))
    throw new Error("Produção exige COOKIE_SECURE=true e APP_ORIGIN HTTPS");
  new Intl.DateTimeFormat("pt-BR", { timeZone: c.timezone });
  new URL(c.origin);
  for (const k of [
    "port",
    "jsonLimit",
    "documentLimit",
    "uploadLimit",
    "photoLimit",
    "projectFilesLimit",
  ] as const)
    if (!Number.isSafeInteger(c[k]) || c[k] <= 0)
      throw new Error(`Configuração inválida: ${k}`);
  return c;
}
