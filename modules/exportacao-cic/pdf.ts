import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import {
  AppError,
  type ProjetoDTO,
  type FonteDTO,
} from "../../packages/shared/src/index.js";
import {
  arquivosDeFiguras,
  renderBibliografiaLatex,
  renderPreProjetoLatex,
  renderProjetoLatex,
} from "./latex.js";

export interface Snapshot {
  projeto: ProjetoDTO;
  fontes: FonteDTO[];
  imagens: Record<string, { mime: string; conteudo: Uint8Array }>;
}

const image = "registry.gitlab.com/islandoftex/images/texlive:latest";
const exec = promisify(execFile);
const pdflatex = "pdflatex -interaction=nonstopmode -shell-escape main.tex";
const compilar = [
  pdflatex,
  "if [ -s main.acn ]; then makeglossaries main; fi",
  "if [ -s referencias.bib ]; then bibtex main; fi",
  pdflatex,
  pdflatex,
].join("\n");

function docker(args: string[], timeout: number) {
  const command = exec("docker", args, {
    timeout,
    killSignal: "SIGKILL",
    windowsHide: true,
  });
  command.child.stdin?.end();
  return command;
}

async function prepararImagens(dir: string, snapshot: Snapshot) {
  const files = new Map<string, string>();
  for (const id of arquivosDeFiguras(snapshot.projeto)) {
    const image = snapshot.imagens[id];
    if (image?.mime !== "image/jpeg" && image?.mime !== "image/png") continue;
    const format = image.mime === "image/jpeg" ? "jpg" : "png";
    const filename = `figura-${files.size + 1}.${format}`;
    await writeFile(join(dir, filename), image.conteudo);
    files.set(id, filename);
  }
  return files;
}

export class ExportacaoCic {
  private active = 0;

  private constructor(private readonly template: Buffer) {}

  static async inicializar() {
    const templateUrl = import.meta.resolve("@tcc/exportacao-cic/template.tex");
    const template = await readFile(new URL(templateUrl));
    await docker(["pull", image], 15 * 60_000).catch((cause) => {
      throw new Error(`Falha ao baixar a imagem Docker ${image}`, { cause });
    });
    return new ExportacaoCic(template);
  }

  async exportarPDF(snapshot: Snapshot) {
    if (this.active >= 2)
      throw new AppError(
        503,
        "EXPORTACAO_OCUPADA",
        "Há duas exportações em andamento. Tente novamente em instantes.",
      );
    this.active++;
    let dir: string | undefined;
    try {
      dir = await mkdtemp(join(tmpdir(), "trama-pdf-"));
      const imagens = await prepararImagens(dir, snapshot);
      await writeFile(join(dir, "main.tex"), this.template);
      await writeFile(
        join(dir, "predocument.tex"),
        renderPreProjetoLatex(snapshot.projeto),
      );
      await writeFile(
        join(dir, "projeto.tex"),
        renderProjetoLatex(snapshot.projeto, imagens),
      );
      await writeFile(
        join(dir, "referencias.bib"),
        renderBibliografiaLatex(snapshot.projeto, snapshot.fontes),
      );

      const container = `trama-pdf-${randomUUID()}`;
      try {
        await docker(
          [
            "run",
            "--rm",
            "-i",
            "--net=none",
            "--pull=never",
            "--name",
            container,
            "-v",
            `${dir}:/data`,
            "-w",
            "/data",
            image,
            "sh",
            "-ec",
            compilar,
          ],
          30_000,
        );
      } catch (error) {
        await docker(["rm", "-f", container], 5_000).catch(() => {});
        if (
          error &&
          typeof error === "object" &&
          "killed" in error &&
          error.killed
        )
          throw new AppError(
            503,
            "EXPORTACAO_TIMEOUT",
            "A compilação do PDF excedeu 30 segundos.",
          );
        throw error;
      }
      return await readFile(join(dir, "main.pdf"));
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(
        503,
        "EXPORTACAO_INDISPONIVEL",
        "Não foi possível compilar o PDF com o TeX Live.",
      );
    } finally {
      this.active--;
      if (dir) await rm(dir, { recursive: true, force: true, maxRetries: 3 });
    }
  }
}
