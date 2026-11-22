import multer from "multer";
import { fileTypeFromBuffer } from "file-type";
import { exigir, AppError } from "../../../../packages/shared/src/index.js";
export const upload = (limit: number) =>
  multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: limit, files: 1, fields: 5, parts: 6 },
  }).single("arquivo");
export async function validarArquivo(
  file: Express.Multer.File | undefined,
  photo = false,
) {
  exigir(file, 400, "ARQUIVO_OBRIGATORIO", "Selecione um arquivo");
  const detected = await fileTypeFromBuffer(file.buffer).catch(() => undefined);
  let mime = detected?.mime;
  const image = ["image/png", "image/jpeg", "image/webp"];
  if (!mime && !photo && /\.(txt|bib)$/i.test(file.originalname)) {
    const text = new TextDecoder("utf-8", { fatal: true });
    try {
      text.decode(file.buffer);
      mime = /\.bib$/i.test(file.originalname)
        ? "application/x-bibtex"
        : "text/plain";
    } catch {
      throw new AppError(
        400,
        "TIPO_INVALIDO",
        "Arquivo de texto deve usar UTF-8",
      );
    }
    exigir(
      !file.buffer.includes(0),
      400,
      "TIPO_INVALIDO",
      "Texto binário não permitido",
    );
  }
  exigir(
    mime &&
      (photo
        ? image
        : [...image, "application/pdf", "text/plain", "application/x-bibtex"]
      ).includes(mime),
    400,
    "TIPO_INVALIDO",
    photo ? "Use PNG, JPEG ou WebP" : "Use PDF, TXT, BibTeX, PNG, JPEG ou WebP",
  );
  return {
    mime,
    nome: file.originalname.replace(/[\x00-\x1f/\\]/g, "_").slice(0, 200),
    buffer: file.buffer,
  };
}
