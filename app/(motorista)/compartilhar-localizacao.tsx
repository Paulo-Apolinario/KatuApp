import { useCallback, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { api } from '@/src/services/api';
import { startSharing, stopSharing } from '@/src/services/driverTracking';
import { sharingSession, sharingError } from '@/src/services/driverTrackingCore';
import { FieldPage, FieldButton, LoadState, ui, useFieldData } from '@/src/components/cooperative/FieldUI';
export default function DriverSharing() {
  const locked = useRef(false);
  const [selected, setSelected] = useState<{
      routeId?: string;
      collectionId?: string;
    }>({}),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const r = useFieldData(useCallback(async () => {
    const [context, local] = await Promise.all([api.get<{
      routes: {
        id: string;
        name: string;
      }[];
      collections: {
        id: string;
        generator?: {
          name: string;
        };
        bin?: {
          name: string;
        };
      }[];
      current?: {
        active: boolean;
        sessionId: string;
      };
    }>('/driver-tracking/context', true), sharingSession()]);
    return {
      ...context,
      local
    };
  }, []), 10000);
  async function act(stop = false) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError('');
    try {
      if (stop) await stopSharing();else {
        if (!selected.routeId && !selected.collectionId) throw Error('Selecione o serviço antes de compartilhar.');
        await startSharing(selected);
      }
      r.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
      locked.current = false;
    }
  }
  return <FieldPage homeHref="/(motorista)/home" title="Compartilhar localização" subtitle="Sua cooperativa poderá acompanhar sua posição durante o serviço selecionado."><Text style={ui.body}>Ative ao sair para o serviço. O App envia a posição e a precisão do GPS para a sua cooperativa. Encerre o compartilhamento quando terminar. Não é enviado um histórico de trajetos.</Text><LoadState resource={r} />{r.data?.local && <View style={ui.card}><Text style={ui.badge}>Compartilhamento ativado neste aparelho</Text><Text style={ui.body}>{r.data.local.mode === 'BACKGROUND' ? 'Localização durante o serviço, inclusive com o App em segundo plano quando o aparelho permitir.' : 'Modo com App aberto: mantenha o Katuá visível. Segundo plano não está disponível ou não foi permitido neste aparelho.'}</Text><FieldButton label="Encerrar compartilhamento" busy={busy} onPress={() => void act(true)} /></View>}{r.data && !r.data.local && <><Text style={ui.heading}>Selecione a rota ou coleta</Text>{r.data.routes.map(route => <FieldButton key={route.id} label={route.name} secondary={selected.routeId !== route.id} disabled={busy} onPress={() => setSelected({
        routeId: route.id
      })} />)}{r.data.collections.map(c => <FieldButton key={c.id} label={(c.generator?.name || c.bin?.name || 'Coleta individual') + ' · #' + c.id.slice(-8).toUpperCase()} secondary={selected.collectionId !== c.id} disabled={busy} onPress={() => setSelected({
        collectionId: c.id
      })} />)}{!r.data.routes.length && !r.data.collections.length ? <Text style={ui.muted}>Nenhum serviço disponível. Aguarde a delegação pela cooperativa.</Text> : <FieldButton label="Iniciar compartilhamento" busy={busy} onPress={() => void act()} />}</>}{!!(error || sharingError()) && <Text accessibilityRole="alert" style={{
      color: '#B42318'
    }}>{error || sharingError()}</Text>}</FieldPage>;
}
