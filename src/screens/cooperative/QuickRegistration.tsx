import { useEffect, useRef, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Text, View } from "react-native";
import { api } from "@/src/services/api";
import { useAuth } from "@/src/contexts/AuthContext";
import { useDurableDraft } from "@/src/hooks/useDurableDraft";
import {
  FieldPage,
  FieldButton,
  FieldInput,
  ui,
} from "@/src/components/cooperative/FieldUI";
const empty = {
  name: "",
  type: "SMALL",
  phone: "",
  address: "",
  email: "",
  recoveryEmail: "",
  document: "",
};
type Kind = "generators" | "collectors";
export default function QuickRegistration({ kind }: { kind: Kind }) {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editing = Boolean(id),
    generator = kind === "generators";
  const { user } = useAuth();
  const [form, setForm] = useState(empty),
    [record, setRecord] = useState<any>(null);
  const [loading, setLoading] = useState(editing),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const [expanded, setExpanded] = useState(editing);
  const alive = useRef(true),
    guard = useRef(false);
  const draft = useDurableDraft(
    `quick-registration:${kind}:${id || "new"}`,
    `Cadastro rápido de ${generator ? "gerador" : "catador"}`,
    form,
    (v) => {
      if (!editing) setForm({ ...empty, ...v });
    },
    !editing,
  );
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    if (!id) return;
    let active = true;
    setLoading(true);
    void api
      .get<any>(`/${kind}/${id}`, true)
      .then((response) => {
        if (!active) return;
        const value = response[generator ? "generator" : "collector"];
        if (!value) throw Error("Cadastro não encontrado.");
        setRecord(value);
        setForm({
          name: value.name || "",
          type: value.type || "SMALL",
          phone: value.phone || "",
          address: value.address || "",
          email: value.email || "",
          recoveryEmail: value.recoveryEmail || "",
          document: value[generator ? "documentNumber" : "cpf"] || "",
        });
      })
      .catch((e) => {
        if (active)
          setError(e.message || "Não foi possível carregar o cadastro.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, kind, generator]);
  const change = (key: keyof typeof empty, value: string) => {
    setMessage("");
    setForm((previous) => ({ ...previous, [key]: value }));
  };
  async function save() {
    if (guard.current || loading || !user) return;
    if (form.name.trim().length < 2) {
      setError("Informe um nome com pelo menos dois caracteres.");
      return;
    }
    if (!editing && (!draft.ready || draft.saving || draft.error)) {
      setError("Aguarde o salvamento do rascunho neste aparelho.");
      return;
    }
    guard.current = true;
    setBusy(true);
    setError("");
    try {
      const body: any = {
        name: form.name.trim(),
        recoveryEmail: form.recoveryEmail.trim().toLowerCase() || null,
        ...(generator ? { type: form.type } : {}),
      };
      for (const key of ["phone", "address", "email"] as const) {
        if (form[key].trim()) body[key] = form[key].trim();
      }
      if (generator && record?.userId && !record?.accessActivationPending)
        delete body.email;
      if (
        form.document.trim() &&
        form.document.trim() !==
          (record?.[generator ? "documentNumber" : "cpf"] || "")
      )
        body[generator ? "documentNumber" : "cpf"] = form.document.trim();
      const response = editing
        ? await api.patch<any>(`/${kind}/${id}`, body, true, user.id)
        : await api.post<any>(`/${kind}`, body, true, user.id);
      if (!alive.current) return;
      const saved = response[generator ? "generator" : "collector"];
      if (!saved?.id)
        throw Error(
          "Confira a lista para confirmar o cadastro antes de repetir.",
        );
      if (!editing) await draft.clear();
      router.replace({
        pathname:
          `/(cooperativa)/${generator ? "geradores" : "catadores"}/[id]` as any,
        params: { id: saved.id },
      });
    } catch (e: any) {
      if (alive.current)
        setError(
          e.message ||
            "Não foi possível salvar. Confira a lista antes de repetir; o rascunho permanece neste aparelho.",
        );
    } finally {
      guard.current = false;
      if (alive.current) setBusy(false);
    }
  }
  async function sendAccess() {
    if (guard.current || !record?.id) return;
    guard.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await api.post<{ message: string }>(
        `/registrations/${kind}/${record.id}/access-link`,
        undefined,
        true,
        user?.id,
      );
      if (alive.current) setMessage(response.message);
    } catch (e: any) {
      if (alive.current)
        setError(e.message || "Não foi possível enviar o acesso.");
    } finally {
      guard.current = false;
      if (alive.current) setBusy(false);
    }
  }
  const dirtyContact =
    record &&
    (form.recoveryEmail.trim() !== (record.recoveryEmail || "") ||
      form.phone.trim() !== (record.phone || "") ||
      form.email.trim() !== (record.email || ""));
  const cooperativeEmail = user?.cooperative?.email || user?.email || "";
  const input = (
    key: keyof typeof empty,
    label: string,
    props: Record<string, unknown> = {},
  ) => (
    <FieldInput
      label={label}
      value={form[key]}
      onChangeText={(value) => change(key, value)}
      editable={!busy && !loading}
      {...props}
    />
  );
  return (
    <FieldPage
      title={`${editing ? "Completar cadastro" : "Cadastro rápido"} de ${generator ? "gerador" : "catador"}`}
      subtitle="Documentos e informações complementares podem ser preenchidos depois."
    >
      {loading && <Text style={ui.body}>Carregando cadastro…</Text>}
      {!!error && (
        <Text accessibilityRole="alert" style={ui.body}>
          {error}
        </Text>
      )}
      {!!message && (
        <Text accessibilityRole="alert" style={ui.badge}>
          {message}
        </Text>
      )}
      {!loading && (!editing || record) && (
        <>
          <View style={ui.card}>
            {generator && (
              <View style={ui.row}>
                <FieldButton
                  label="Pequeno / residencial"
                  secondary={form.type !== "SMALL"}
                  disabled={busy}
                  onPress={() => change("type", "SMALL")}
                />
                <FieldButton
                  label="Grande gerador"
                  secondary={form.type !== "LARGE"}
                  disabled={busy}
                  onPress={() => change("type", "LARGE")}
                />
              </View>
            )}
            {input(
              "name",
              generator
                ? "Nome da pessoa ou estabelecimento *"
                : "Nome do catador *",
              { maxLength: 150 },
            )}
            {input("phone", "Celular com DDD (opcional)", {
              keyboardType: "phone-pad",
              maxLength: 30,
            })}
            {input("address", "Endereço ou referência (opcional)", {
              multiline: true,
              maxLength: 500,
            })}
            <Text style={ui.muted}>
              O cadastro já pode ser usado nas operações. Salvar não cria login
              automaticamente.
            </Text>
          </View>
          <FieldButton
            secondary
            label={
              expanded
                ? "Ocultar dados complementares"
                : "Adicionar documento, e-mail ou recuperação"
            }
            onPress={() => setExpanded((value) => !value)}
          />
          {expanded && (
            <View style={ui.card}>
              {input(
                "document",
                generator ? "CPF/CNPJ (opcional)" : "CPF (opcional)",
                { maxLength: 18, autoCapitalize: "characters" },
              )}
              {input("email", "E-mail pessoal de acesso (opcional)", {
                keyboardType: "email-address",
                autoCapitalize: "none",
                editable:
                  !busy &&
                  !(
                    generator &&
                    record?.userId &&
                    !record?.accessActivationPending
                  ),
              })}
              {input("recoveryEmail", "E-mail de recuperação (opcional)", {
                keyboardType: "email-address",
                autoCapitalize: "none",
              })}
              {!!cooperativeEmail && (
                <FieldButton
                  secondary
                  label="Usar e-mail da cooperativa"
                  disabled={busy}
                  onPress={() => change("recoveryEmail", cooperativeEmail)}
                />
              )}
              <Text style={ui.muted}>
                O e-mail de recuperação pode ser o da cooperativa e atender
                vários colaboradores. Ele não se torna o login deles.
              </Text>
            </View>
          )}
          <FieldButton
            label={editing ? "Salvar alterações" : "Salvar cadastro rápido"}
            busy={busy}
            disabled={loading || (!editing && (!draft.ready || draft.saving))}
            onPress={() => void save()}
          />
          {!editing && (
            <Text style={ui.small}>
              {draft.error ||
                "O formulário fica como rascunho neste aparelho. É preciso conexão para confirmar o cadastro no sistema."}
            </Text>
          )}
          {editing && (
            <View style={ui.card}>
              <Text style={ui.heading}>Acesso ao aplicativo</Text>
              <Text style={ui.muted}>
                Primeiro salve o celular e o e-mail de recuperação. A senha será
                definida pelo link enviado ao endereço cadastrado.
              </Text>
              <FieldButton
                secondary
                label={
                  record?.hasOnlineAccess
                    ? "Enviar recuperação de acesso"
                    : "Enviar link para definir acesso"
                }
                disabled={busy || dirtyContact}
                onPress={() => void sendAccess()}
              />
              {dirtyContact && (
                <Text style={ui.small}>
                  Salve as alterações antes de enviar o link.
                </Text>
              )}
            </View>
          )}
        </>
      )}
    </FieldPage>
  );
}
