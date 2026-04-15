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

const createBaseDraft = (kind: GeneratorDraftKind): GeneratorDraft => ({
  kind,
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
});

let currentDraft: GeneratorDraft = createBaseDraft("SMALL");

export const generatorDraftStore = {
  get(kind?: GeneratorDraftKind): GeneratorDraft {
    if (kind && currentDraft.kind !== kind) {
      return createBaseDraft(kind);
    }

    return { ...currentDraft };
  },

  set(patch: Partial<GeneratorDraft>) {
    const nextKind = patch.kind ?? currentDraft.kind;

    currentDraft = {
      ...createBaseDraft(nextKind),
      ...currentDraft,
      ...patch,
      kind: nextKind,
    };
  },

  clear(kind?: GeneratorDraftKind) {
    currentDraft = createBaseDraft(kind ?? "SMALL");
  },
};