export type GeradorTipo = "pf" | "comercial" | "grande";

export interface GeradorDoc {
  id: string;
  userId?: string;
  nome: string;
  email?: string;
  telefone?: string;
  endereco: string;
  tipo: GeradorTipo;
  cooperativaId?: string;
  kgTotal: number;
  sequenciaVerde: number;
  createdAt?: any;
  updatedAt?: any;
}