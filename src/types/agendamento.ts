export type AgendamentoStatus =
  | "agendado"
  | "em_rota"
  | "coletado"
  | "cancelado";

export interface AgendamentoDoc {
  id: string;
  geradorId: string;
  cooperativaNome?: string;
  dataAgendada: any;
  status: AgendamentoStatus;
  createdAt?: any;
  updatedAt?: any;
}