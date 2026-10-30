export type RegisterDraftProfile = "pf" | "comercial" | "grande" | "cooperativa" | "catador";

export type RegisterDraft = {
  profile: RegisterDraftProfile;
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  phone: string;
  rememberMe: boolean;

  cpf: string;
  cooperativeName: string;
  registrationNumber: string;

  zipCode: string;
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  stateName: string;
  address: string;

  latitude: string;
  longitude: string;
};

const defaultDraft: RegisterDraft = {
  profile: "pf",
  name: "",
  email: "",
  password: "",
  confirmPassword: "",
  phone: "",
  rememberMe: false,

  cpf: "",
  cooperativeName: "",
  registrationNumber: "",

  zipCode: "",
  street: "",
  number: "",
  neighborhood: "",
  city: "",
  stateName: "",
  address: "",

  latitude: "",
  longitude: "",
};

let currentDraft: RegisterDraft = { ...defaultDraft };

export const registerDraftStore = {
  get(profile?: RegisterDraftProfile): RegisterDraft {
    if (profile && currentDraft.profile !== profile) {
      return { ...defaultDraft, profile };
    }

    return { ...currentDraft };
  },

  set(patch: Partial<RegisterDraft>) {
    currentDraft = {
      ...currentDraft,
      ...patch,
    };
  },

  replace(next: RegisterDraft) {
    currentDraft = { ...next };
  },

  clear(profile?: RegisterDraftProfile) {
    currentDraft = {
      ...defaultDraft,
      profile: profile ?? "pf",
    };
  },
};