import { chromium, type Browser } from "playwright";
import {
  AppError,
  type ProjetoDTO,
  type FonteDTO,
} from "../../packages/shared/src/index.js";
import { renderProjeto } from "../../packages/shared/src/render.js";
export interface Snapshot {
  projeto: ProjetoDTO;
  fontes: FonteDTO[];
  imagens: Record<string, { mime: string; conteudo: Uint8Array }>;
}
export class ExportacaoBasica {
  private browser?: Promise<Browser>;
  private active = 0;
  async close() {
    if (this.browser) await (await this.browser).close();
    this.browser = undefined;
  }
  async exportarPDF(snapshot: Snapshot) {
    if (this.active >= 2)
      throw new AppError(
        503,
        "EXPORTACAO_OCUPADA",
        "Há duas exportações em andamento. Tente novamente em instantes.",
      );
    this.active++;
    let context: Awaited<ReturnType<Browser["newContext"]>> | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      this.browser ??= chromium.launch({ headless: true }).catch((e) => {
        this.browser = undefined;
        throw e;
      });
      const browser = await this.browser;
      context = await browser.newContext({ javaScriptEnabled: false });
      const ctx = context;
      return await Promise.race([
        (async () => {
          await ctx.route("**/*", (route) => route.abort());
          const page = await ctx.newPage();
          const html = renderProjeto(
            snapshot.projeto,
            snapshot.fontes,
            (id) => {
              const image = snapshot.imagens[id];
              return image
                ? `data:${image.mime};base64,${Buffer.from(image.conteudo).toString("base64")}`
                : "";
            },
          );
          await page.setContent(
            `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'"><style>@page{size:A4;margin:25mm}body{font-family:Arial,sans-serif;font-size:11pt;line-height:1.6;color:#182c28;overflow-wrap:anywhere}header{margin-bottom:24pt;border-bottom:1px solid #a8b8b0;padding-bottom:16pt}h1{font-size:23pt}h2{font-size:16pt}h3{font-size:13pt}h1,h2,h3,caption,figcaption{break-after:avoid}p{orphans:3;widows:3}figure{margin:18pt 0;break-inside:avoid}img{max-width:100%;max-height:180mm;object-fit:contain}figcaption,caption{font-size:10pt;text-align:left;margin-bottom:6pt}table{width:100%;border-collapse:collapse;margin:15pt 0;table-layout:fixed}thead{display:table-header-group;break-after:avoid}tbody tr:first-child{break-before:avoid}td p,th p{margin:0}tr{break-inside:avoid}td,th{border:1px solid #9baea5;padding:6pt;vertical-align:top}blockquote{border-left:3px solid #8caaa1;padding-left:15pt;margin:15pt}dt{font-weight:bold}dd{margin-bottom:6pt}li{margin-bottom:5pt}aside{border:1px solid #aaa;padding:8pt}</style></head><body>${html}</body></html>`,
            { waitUntil: "load", timeout: 15000 },
          );
          return page.pdf({
            format: "A4",
            printBackground: true,
            margin: {
              top: "25mm",
              bottom: "25mm",
              left: "25mm",
              right: "25mm",
            },
            displayHeaderFooter: true,
            headerTemplate: "<span></span>",
            footerTemplate:
              '<div style="font:9px Arial;width:100%;text-align:center"><span class="pageNumber"></span> / <span class="totalPages"></span></div>',
          });
        })(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () =>
              reject(
                new AppError(
                  503,
                  "EXPORTACAO_TIMEOUT",
                  "A exportação excedeu 30 segundos",
                ),
              ),
            30000,
          );
        }),
      ]);
    } catch (e) {
      if (e instanceof AppError) throw e;
      throw new AppError(
        503,
        "EXPORTACAO_INDISPONIVEL",
        "Não foi possível gerar o PDF. Verifique a instalação do Chromium.",
      );
    } finally {
      clearTimeout(timer);
      await context?.close();
      this.active--;
    }
  }
}
