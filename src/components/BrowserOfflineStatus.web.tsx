import { localReadNotice } from "../offline/readCache";
import { hasLocalWrites } from "../offline/saveGuard";
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { useSyncStatus } from '../hooks/useSyncStatus';
export default function BrowserOfflineStatus() {
    const { user } = useAuth(), sync = useSyncStatus();
    const [online, setOnline] = useState(true), [ready, setReady] = useState(false), [error, setError] = useState(''), [waiting, setWaiting] = useState<ServiceWorker | null>(null), [cachedAt, setCachedAt] = useState('');
    useEffect(() => { const update = () => setCachedAt(user ? localReadNotice(user.id) : ''); update(); const timer = setInterval(update, 1000); return () => clearInterval(timer); }, [user]);
    useEffect(() => {
        setOnline(navigator.onLine);
        const update = () => setOnline(navigator.onLine);
        window.addEventListener('online', update);
        window.addEventListener('offline', update);
        const preventReload = (event: BeforeUnloadEvent) => { if (hasLocalWrites()) {
            event.preventDefault();
            event.returnValue = '';
        } };
        window.addEventListener('beforeunload', preventReload);
        if (!('serviceWorker' in navigator)) {
            setError('Este navegador não permite preparar a abertura offline.');
            return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); window.removeEventListener('beforeunload', preventReload); };
        }
        let alive = true, reg: ServiceWorkerRegistration;
        async function status() { if (!alive || !reg)
            return; setWaiting(reg.waiting); const workers = [reg.waiting, reg.active].filter((v): v is ServiceWorker => !!v); const results = await Promise.all(workers.map(worker => new Promise<any>(resolve => { const channel = new MessageChannel(); const timer = setTimeout(() => { channel.port1.close(); resolve(null); }, 2500); channel.port1.onmessage = e => { clearTimeout(timer); channel.port1.close(); resolve(e.data); }; worker.postMessage({ type: 'STATUS' }, [channel.port2]); }))); if (alive)
            setReady(results.some(v => v?.ready === true && v.version === document.querySelector('meta[name="katua-build"]')?.getAttribute('content'))); }
        void navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).then(r => { reg = r; void status(); r.addEventListener('updatefound', () => { const installing = r.installing; installing?.addEventListener('statechange', () => { if (installing.state === 'redundant' && alive)
            setError('A preparação não foi concluída. Confira a conexão e o espaço disponível.'); void status(); }); }); }).catch(() => { if (alive)
            setError('A preparação offline ainda não foi concluída. Abra o App com internet e tente novamente.'); });
        const timer = setInterval(status, 3000);
        return () => { alive = false; clearInterval(timer); window.removeEventListener('online', update); window.removeEventListener('offline', update); window.removeEventListener('beforeunload', preventReload); };
    }, []);
    return <View style={{ backgroundColor: online ? '#EAF5EE' : '#FFF3D6', paddingHorizontal: 14, paddingVertical: 8, gap: 4 }}><Text accessibilityLiveRegion="polite" style={{ color: '#153D2C', fontSize: 12, fontWeight: '700' }}>{!online ? 'Sem internet · trabalhando com dados baixados' : ready ? 'App pronto para reabrir offline' : 'Preparando abertura offline...'}</Text>{!!cachedAt && <Text style={{ color: "#925300", fontSize: 12 }}>Dados baixados neste aparelho · atualize a tela quando houver conexão.</Text>}{!!error && <Text accessibilityRole="alert" style={{ color: '#B42318', fontSize: 12 }}>{error}</Text>}{user && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}><Pressable accessibilityRole="button" accessibilityLabel="Dados offline e rascunhos" onPress={() => router.push('/offline' as any)}><Text style={{ color: '#087B55', fontSize: 12, paddingVertical: 7 }}>Dados offline e rascunhos</Text></Pressable>{sync.pending > 0 && <Pressable accessibilityRole="button" accessibilityLabel="Abrir registros aguardando envio" onPress={() => router.push('/sync')}><Text style={{ color: '#925300', fontSize: 12, paddingVertical: 7 }}>{sync.pending} aguardando envio{sync.errors ? ' · precisa de revisão' : ''}</Text></Pressable>}{waiting && sync.pending === 0 && <Pressable accessibilityRole="button" accessibilityLabel="Atualizar versão do App" onPress={() => { if (hasLocalWrites())
        return; waiting.postMessage({ type: 'ACTIVATE_UPDATE' }); navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true }); }}><Text style={{ color: '#087B55', fontSize: 12, paddingVertical: 7 }}>Atualizar App</Text></Pressable>}</View>}</View>;
}
