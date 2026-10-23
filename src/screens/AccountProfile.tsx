import { useState } from "react";
import { Text } from "react-native";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../services/api";
import authService from "../services/authService";
import { useNotification } from "../contexts/NotificationContext";
import {
  Workspace,
  Card,
  Field,
  Action,
  Notice,
} from "../components/ui/Workspace";
import { useSyncStatus } from "../hooks/useSyncStatus";
export default function AccountProfile() {
  const { user, refreshUser, signOut } = useAuth(),
    { notifySuccess } = useNotification(),
    sync = useSyncStatus();
  const [name, setName] = useState(user?.displayName || ""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const cooperative =
    (user as any)?.collector?.cooperative ||
    (user as any)?.driver?.cooperative ||
    (user as any)?.generator?.cooperative ||
    (user as any)?.cooperative;
  async function save() {
    if (name.trim().length < 3) {
      setError("Informe seu nome com pelo menos três caracteres.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api.patch("/auth/profile", { displayName: name.trim() }, true);
      await refreshUser();
      notifySuccess("Nome atualizado.");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function recover() {
    if (!user?.email) return;
    setBusy(true);
    setError("");
    try {
      const r = await authService.forgotPassword(user.email);
      if (!r.success) throw Error(r.error);
      notifySuccess(
        "Se o cadastro permitir, as instruções de recuperação serão enviadas ao seu e-mail. Confira a caixa de entrada.",
      );
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Workspace
      title="Minha conta"
      subtitle="Dados cadastrais, acesso e sincronização."
    >
      <Card>
        <Field
          label="Nome"
          value={name}
          onChangeText={setName}
          maxLength={150}
        />
        <Field
          label="E-mail de acesso"
          value={user?.email || ""}
          editable={false}
        />
        <Field
          label="Telefone cadastrado"
          value={user?.phone || "Não informado"}
          editable={false}
        />
        <Notice
          text={`Cooperativa / OSC: ${cooperative?.name || "Consulte a cooperativa responsável pelo seu cadastro"}`}
        />
        <Notice text="Telefone, endereço operacional e documentos devem ser corrigidos pela cooperativa para preservar o cadastro e a localização." />
        <Action label="Salvar nome" busy={busy} onPress={() => void save()} />
        {!!error && <Notice text={error} error />}
      </Card>
      <Card>
        <Text style={{ fontWeight: "700" }}>Acesso e senha</Text>
        <Notice text="Se não lembrar sua senha ou entrou por acesso rápido, solicite a recuperação por e-mail. A senha anterior não é necessária para esse fluxo." />
        <Action
          secondary
          label="Receber instruções para alterar a senha"
          disabled={busy}
          onPress={() => void recover()}
        />
      </Card>
      <Card>
        <Text style={{ fontWeight: "700" }}>Sincronização</Text>
        <Notice
          text={`${sync.pending} operação(ões) aguardando confirmação; ${sync.errors} com erro.`}
        />
        {!!sync.message && <Notice text={sync.message} />}
        <Action
          secondary
          label="Sincronizar agora"
          onPress={() => void sync.sync().catch((e) => setError(e.message))}
        />
        <Notice text="Sincronize antes de limpar os dados do aplicativo ou trocar de dispositivo. Sair da conta preserva as pendências associadas ao titular." />
      </Card>
      <Action secondary label="Sair da conta" onPress={() => void signOut()} />
    </Workspace>
  );
}
