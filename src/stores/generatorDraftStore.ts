export type GeneratorDraftKind = "SMALL" | "LARGE";

export type GeneratorDraft = {
  kind: GeneratorDraftKind;
  nome: string;
  contato: string;
  telefone: string;
  email: string;

  cep: string;
  rua: string;
  numero: string;
  bairro: string;
  cidade: string;
  estado: string;
  address: string;

  latitude: string;
  longitude: string;
};

const baseDraft: GeneratorDraft = {
  kind: "SMALL",
  nome: "",
  contato: "",
  telefone: "",
  email: "",

  cep: "",
  rua: "",
  numero: "",
  bairro: "",
  cidade: "",
  estado: "",
  address: "",

  latitude: "",
  longitude: "",
};

let currentDraft: GeneratorDraft = { ...baseDraft };

export const generatorDraftStore = {
  get(kind?: GeneratorDraftKind): GeneratorDraft {
    if (kind && currentDraft.kind !== kind) {
      return { ...baseDraft, kind };
    }

    return { ...currentDraft };
  },

  set(patch: Partial<GeneratorDraft>) {
    currentDraft = {
      ...currentDraft,
      ...patch,
    };
  },

  clear(kind?: GeneratorDraftKind) {
    currentDraft = {
      ...baseDraft,
      kind: kind ?? "SMALL",
    };
  },
};