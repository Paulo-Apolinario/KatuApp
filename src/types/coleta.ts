export type ColetaStatus = "pendente" | "realizada" | "cancelada";

export interface ColetaDoc {
  id: string;
  geradorId: string;
  peso: number;
  status: ColetaStatus;
  createdAt?: any;
  updatedAt?: any;
}