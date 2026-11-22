declare module "@citation-js/core" {
  export class Cite {
    constructor(input: string);
    data: Array<Record<string, any>>;
    format(type: string, options?: unknown): string;
  }
}
declare module "@citation-js/plugin-bibtex";
