import { useCallback, useState } from 'react';
import { router } from 'expo-router';
import { Platform, Text, View } from 'react-native';
import ProtectedRoute from '@/src/components/ProtectedRoute';
import { useAuth } from '@/src/contexts/AuthContext';
import { FieldPage, FieldButton, LoadState, ui, useFieldData } from '@/src/components/cooperative/FieldUI';
import { durableGet, durableKeys } from '@/src/offline/durableStorage';
import type { DraftRecord } from '@/src/hooks/useDurableDraft';
import { prepareBrowserData } from '@/src/offline/prepareBrowserData';
export default function OfflineCenter() { const { user } = useAuth(), [busy, setBusy] = useState(false), [message, setMessage] = useState(''); const data = useFieldData(useCallback(async () => { if (!user)
    return []; const keys = await durableKeys('draft:' + user.id + ':'); return (await Promise.all(keys.map(k => durableGet<DraftRecord>(k)))).filter((v): v is DraftRecord => !!v); }, [user])); async function prepare() { if (busy)
    return; setBusy(true); try {
    if (Platform.OS === 'web' && navigator.storage?.persist)
        await navigator.storage.persist();
    setMessage(await prepareBrowserData(user!.role));
}
catch (e: any) {
    setMessage(e.message || 'Não foi possível concluir. Confira a conexão e o espaço disponível.');
}
finally {
    setBusy(false);
} } return <ProtectedRoute><FieldPage title="Dados offline e rascunhos" subtitle="Prepare os dados com internet antes de sair para o trabalho." homeHref={user?.role === 'COOPERATIVE' ? '/(cooperativa)/home' : user?.role === 'DRIVER' ? '/(motorista)/home' : user?.role === 'COLLECTOR' ? '/(catador)/homecat' : '/'}><View style={ui.card}><Text style={ui.body}>O App pode reabrir sem internet após concluir a preparação. Apenas dados já baixados ficam disponíveis. Mapas de fundo e localização ao vivo dependem de conexão.</Text><FieldButton label="Preparar dados para usar offline" busy={busy} onPress={() => void prepare()}/>{!!message && <Text accessibilityLiveRegion="polite" style={ui.body}>{message}</Text>}<Text style={ui.small}>A sincronização ocorre com o App aberto ou ao reabri-lo com conexão. Evite limpar os dados do navegador enquanto houver registros pendentes.</Text></View>{['COOPERATIVE', 'COLLECTOR', 'DRIVER'].includes(user?.role || '') && <FieldButton secondary label="Ver registros aguardando envio" onPress={() => router.push('/sync')}/>}<Text style={ui.heading}>Rascunhos salvos neste aparelho</Text><LoadState resource={data}/>{data.data?.map(d => <View style={ui.card} key={d.name}><Text style={ui.heading}>{d.title}</Text><Text style={ui.muted}>Salvo em {new Date(d.savedAt).toLocaleString('pt-BR')}</Text><FieldButton secondary label="Continuar rascunho" onPress={() => router.push({ pathname: (d.value.collectionId ? '/(catador)/collect' : d.value.pev ? '/(cooperativa)/pevs/novo' : '/(cooperativa)/geradores/novo') as any, params: d.value.collectionId ? { highlightCollectionId: d.value.collectionId } : { draft: d.name.split(':')[1] } })}/></View>)}{data.data?.length === 0 && <Text style={ui.muted}>Nenhum rascunho de cadastro nesta conta.</Text>}</FieldPage></ProtectedRoute>; }
