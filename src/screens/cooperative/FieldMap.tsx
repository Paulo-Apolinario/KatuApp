import { useCallback, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';
import OperationalMap from '@/src/components/maps/OperationalMap';
import { fieldService, fieldAddress, fieldTitle, type FieldKind } from '@/src/services/cooperativeFieldService';
import { FieldPage, FieldButton, LoadState, ui, useFieldData } from '@/src/components/cooperative/FieldUI';
import { directoryPaths } from './Directory';
export default function FieldMap() {
  const params = useLocalSearchParams<{
      kind: string;
      id?: string;
    }>(),
    kind: FieldKind = params.kind === 'pevs' ? 'pevs' : 'generators',
    id = typeof params.id === 'string' ? params.id : undefined;
  const [page, setPage] = useState(1),
    [selected, setSelected] = useState<string | null>(id || null);
  const r = useFieldData(useCallback(async () => {
    if (id) {
      const d = await fieldService.detail(kind, id);
      return {
        items: [d.item],
        pagination: {
          page: 1,
          total: 1,
          totalPages: 1
        }
      };
    }
    return fieldService.list(kind, '', page);
  }, [kind, id, page]));
  const points = (r.data?.items || []).filter(x => x.latitude != null && x.longitude != null && Number.isFinite(x.latitude) && Number.isFinite(x.longitude)).map(x => ({
    id: x.id,
    title: fieldTitle(x),
    description: fieldAddress(x),
    latitude: Number(x.latitude),
    longitude: Number(x.longitude),
    kind: kind === 'pevs' ? 'pev' as const : 'collection' as const
  }));
  const choice = r.data?.items.find(x => x.id === selected);
  return <FieldPage title={kind === 'pevs' ? 'Mapa de PEVs' : 'Mapa dos geradores'} subtitle="Toque em um local para consultar suas informações."><LoadState resource={r} />{points.length > 0 ? <View style={{
      height: 420,
      borderRadius: 18,
      overflow: 'hidden'
    }}><OperationalMap baseKind="location" baseLabel="Referência da região" baseLatitude={points[0].latitude} baseLongitude={points[0].longitude} points={points} selectedPointId={selected} onSelectPoint={setSelected} showPointList={false} /></View> : r.data && <Text style={ui.muted}>Nenhum local com coordenadas confirmadas nesta página.</Text>}{choice && <View style={ui.card}><Text style={ui.heading}>{fieldTitle(choice)}</Text><Text style={ui.body}>{fieldAddress(choice)}</Text><FieldButton label="Ver informações do local" onPress={() => router.push({
        pathname: '/(cooperativa)/' + directoryPaths[kind] + '/[id]' as any,
        params: {
          id: choice.id
        }
      })} /></View>}{r.data?.items.filter(x => x.latitude == null || x.longitude == null).map(x => <Text style={ui.muted} key={x.id}>{fieldTitle(x)} · sem localização confirmada.</Text>)}{!id && r.data && <View style={ui.card}><Text style={ui.muted}>Locais desta página: {r.data.items.length} de {r.data.pagination.total}. O mapa mostra somente esta página.</Text><View style={ui.row}><FieldButton secondary label="Página anterior" disabled={page === 1} onPress={() => {
          setSelected(null);
          setPage(n => n - 1);
        }} /><FieldButton secondary label="Próximos locais" disabled={page >= r.data.pagination.totalPages} onPress={() => {
          setSelected(null);
          setPage(n => n + 1);
        }} /></View></View>}</FieldPage>;
}
