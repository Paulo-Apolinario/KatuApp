export type UserType =
  | "pf"
  | "comercial"
  | "grande"
  | "cooperativa"
  | "catador";

export interface UserDoc {
  uid: string;
  email: string;
  displayName: string;
  userType: UserType;
  phone?: string;
  profileCompleted?: boolean;
  rememberMe?: boolean;
  createdAt?: any;
}