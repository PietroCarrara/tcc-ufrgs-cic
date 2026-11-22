import type {
  User,
  Papel,
  RichText,
  ProjetoDTO,
  Intervalo,
  FonteDTO,
} from "../../../../packages/shared/src/index.js";
export abstract class Usuario implements User {
  abstract readonly papel: Papel;
  constructor(
    public id: string,
    public nome: string,
    public email?: string,
  ) {}
}
export class Aluno extends Usuario {
  readonly papel = "aluno" as const;
}
export class Professor extends Usuario {
  readonly papel = "professor" as const;
  constructor(
    id: string,
    nome: string,
    email?: string,
    public biografia?: RichText,
    public sugestoesDePesquisa: RichText[] = [],
  ) {
    super(id, nome, email);
  }
}
export class Projeto {
  constructor(public dados: ProjetoDTO) {}
}
export class Atividade {
  constructor(
    public id: string,
    public horario: Intervalo,
  ) {}
}
export class Fonte {
  constructor(public dados: FonteDTO) {}
}
export class Arquivo {
  constructor(
    public id: string,
    public nome: string,
    public conteudo: Uint8Array,
  ) {}
}
export class Notificacao {
  constructor(
    public titulo: string,
    public texto: string,
    public lida: boolean,
    public link: string,
  ) {}
}
export interface Tramitacao {
  aceitarProposta(id: string, u: User): ProjetoDTO;
  rejeitarProposta(id: string, u: User, motivo: string): void;
}
export class PropostaDeProjeto {
  constructor(
    public id: string,
    public descricao: string,
    private servico: Tramitacao,
  ) {}
  aceitar(u: User) {
    return this.servico.aceitarProposta(this.id, u);
  }
  rejeitar(u: User, motivo: string) {
    return this.servico.rejeitarProposta(this.id, u, motivo);
  }
}
