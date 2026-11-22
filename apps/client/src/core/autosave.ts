export type SaveStatus =
  | "Salvo"
  | "Alterações pendentes"
  | "Salvando"
  | "Erro ao salvar"
  | "Conflito de versão";
/** Uma gravação por vez. Revisão local é independente da versão no servidor. */
export class Autosave<T> {
  revision = 0;
  savedRevision = 0;
  paused = false;
  private timer?: ReturnType<typeof setTimeout>;
  private continuous?: ReturnType<typeof setTimeout>;
  private pending?: Promise<boolean>;
  status: SaveStatus = "Salvo";
  constructor(
    private snapshot: () => T,
    private send: (value: T) => Promise<void>,
    private changed: (status: SaveStatus) => void,
    private error: (e: unknown) => void,
  ) {}
  private state(s: SaveStatus) {
    this.status = s;
    this.changed(s);
  }
  dirty() {
    this.revision++;
    this.state(this.paused ? "Conflito de versão" : "Alterações pendentes");
    clearTimeout(this.timer);
    if (this.paused) return;
    this.timer = setTimeout(() => void this.flush(), 2000);
    this.continuous ??= setTimeout(() => void this.flush(), 15000);
  }
  async flush(): Promise<boolean> {
    clearTimeout(this.timer);
    clearTimeout(this.continuous);
    this.continuous = undefined;
    if (this.paused) return false;
    if (this.pending) {
      await this.pending;
      if (this.paused) return false;
      if (this.revision !== this.savedRevision) return this.flush();
      return true;
    }
    if (this.revision === this.savedRevision) return true;
    const rev = this.revision,
      snap = this.snapshot();
    this.state("Salvando");
    this.pending = (async () => {
      try {
        await this.send(snap);
        this.savedRevision = rev;
        this.state(this.revision === rev ? "Salvo" : "Alterações pendentes");
        return true;
      } catch (e) {
        if ((e as { status?: number }).status === 409) {
          this.paused = true;
          this.state("Conflito de versão");
        } else this.state("Erro ao salvar");
        this.error(e);
        return false;
      }
    })();
    const result = await this.pending;
    this.pending = undefined;
    if (result && this.revision !== this.savedRevision) return this.flush();
    return result;
  }
  resume() {
    this.paused = false;
    this.dirty();
  }
  clean() {
    this.savedRevision = this.revision;
    this.paused = false;
    this.state("Salvo");
  }
  get unsaved() {
    return this.revision !== this.savedRevision;
  }
  destroy() {
    clearTimeout(this.timer);
    clearTimeout(this.continuous);
  }
}
