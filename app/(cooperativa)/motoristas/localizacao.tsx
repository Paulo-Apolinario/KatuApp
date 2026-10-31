import { useCallback, useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';
import { api } from '@/src/services/api';
import OperationalMap from '@/src/components/maps/OperationalMap';
import { FieldPage, FieldButton, LoadState, ui, useFieldData } from '@/src/components/cooperative/FieldUI';
type Position = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  capturedAt: string;
  receivedAt: string;
};
export default function DriverLocation() {
  const p = useLocalSearchParams<{
      id: string;
    }>(),
    id = typeof p.id === 'string' ? p.id : '';
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(t);
  }, []);
  const r = useFieldData(useCallback(() => api.get<{
    state: string;
    driver: {
      id: string;
      name: string;
    };
    serviceLabel?: string;
    position: Position | null;
    mode: string;
  }>('/driver-tracking/drivers/' + encodeURIComponent(id), true), [id]), 5000);
  const position = r.data?.position;
  const age = position ? now - new Date(position.capturedAt).getTime() : Infinity;
  const live = r.data?.state === 'LIVE' && age <= 45000 && !r.error;
  const labels: Record<string, string> = {
    STOPPED: 'Compartilhamento encerrado ou não iniciado',
    WAITING: 'Aguardando primeiro sinal GPS',
    LIVE: 'Localização atualizada',
    STALE: 'Última posição · atualização atrasada',
    OFFLINE: 'Sem atualização recente'
  };
  return <FieldPage title="Localização do motorista" subtitle="Acompanhamento do celular durante o serviço compartilhado."><LoadState resource={r} />{r.data && <View style={ui.card}><Text style={ui.heading}>{r.data.driver.name}</Text>{r.data.serviceLabel && <Text style={ui.muted}>{r.data.serviceLabel}</Text>}<Text style={ui.heading}>{live ? 'Localização atualizada' : r.error ? 'Sem conexão para atualizar' : age > 45000 && r.data.state === 'LIVE' ? 'Última posição · atualização atrasada' : labels[r.data.state]}</Text>{position && <><Text style={ui.body}>Sinal GPS: {new Intl.DateTimeFormat('pt-BR', {
            timeZone: 'America/Fortaleza',
            dateStyle: 'short',
            timeStyle: 'medium'
          }).format(new Date(position.capturedAt))}</Text><Text style={ui.muted}>Precisão aproximada: {position.accuracy == null ? 'não informada' : Math.round(position.accuracy) + ' m'}</Text>{!live && <Text style={ui.muted}>Este marcador é a última posição recebida. Não representa necessariamente a localização atual.</Text>}</>}</View>}{position && <View style={{
      height: 440,
      borderRadius: 18,
      overflow: 'hidden'
    }}><OperationalMap baseLabel="Referência do último sinal" baseKind="driver" baseLatitude={position.latitude} baseLongitude={position.longitude} points={[{
        id: 'tracked-driver',
        title: live ? 'Posição atual' : 'Última posição',
        latitude: position.latitude,
        longitude: position.longitude,
        kind: 'driver'
      }]} selectedPointId="tracked-driver" showPointList={false} accuracyCircle={position.accuracy ? {
        ...position,
        radius: position.accuracy
      } : undefined} /></View>}<Text style={ui.muted}>Atualiza a cada 5 segundos enquanto esta tela está aberta. O sinal depende do GPS, da conexão e do compartilhamento no aparelho do motorista.</Text><FieldButton secondary label="Atualizar localização" onPress={r.refresh} /></FieldPage>;
}
