import { useCallback, useState } from 'react';
import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { fieldService, fieldAddress, fieldTitle, fieldLabels, type FieldKind } from '@/src/services/cooperativeFieldService';
import { FieldPage, FieldButton, FieldInput, LoadState, Pager, ui, useFieldData } from '@/src/components/cooperative/FieldUI';
export const directoryPaths = {
  collectors: 'catadores',
  drivers: 'motoristas',
  generators: 'geradores',
  pevs: 'pevs'
};
const titles = {
  collectors: 'Catadores',
  drivers: 'Motoristas',
  generators: 'Geradores',
  pevs: 'PEVs'
};
export default function Directory({
  kind
}: {
  kind: FieldKind;
}) {
  const [search, setSearch] = useState(''),
    [q, setQ] = useState(''),
    [page, setPage] = useState(1);
  const data = useFieldData(useCallback(() => fieldService.list(kind, q, page), [kind, q, page]));
  return <FieldPage title={titles[kind]} subtitle={kind === 'drivers' ? 'Consulte os trabalhos e acompanhe a localização compartilhada.' : kind === 'collectors' ? 'Selecione um catador para consultar seus trabalhos.' : 'Consulte os locais e os atendimentos vinculados.'}><View style={ui.row}>{(kind === 'generators' || kind === 'pevs') && <><FieldButton label={kind === 'pevs' ? 'Adicionar PEV' : 'Adicionar gerador'} onPress={() => router.push('/(cooperativa)/' + directoryPaths[kind] + '/novo' as any)} /><FieldButton secondary label="Ver no mapa" icon="map-outline" onPress={() => router.push({
          pathname: '/(cooperativa)/field-map' as any,
          params: {
            kind
          }
        })} /></>}</View><FieldInput label="Buscar por nome ou local" value={search} onChangeText={setSearch} returnKeyType="search" onSubmitEditing={() => {
      setPage(1);
      setQ(search.trim());
    }} /><View style={ui.row}><FieldButton label="Buscar" onPress={() => {
        setPage(1);
        setQ(search.trim());
      }} /><FieldButton secondary label="Atualizar" onPress={data.refresh} /></View><LoadState resource={data} />{data.data?.items.map(item => <View key={item.id} style={ui.card}><Text style={ui.heading}>{fieldTitle(item)}</Text><Text style={ui.badge}>{fieldLabels[item.status || item.accessStatus || ''] || 'Cadastro ativo'}{item.needsPickup ? ' · Necessita retirada' : ''}</Text>{(kind === 'generators' || kind === 'pevs') && <Text style={ui.body}>{fieldAddress(item)}</Text>}{item.phone && <Text style={ui.muted}>{item.phone}</Text>}<FieldButton secondary label={kind === 'collectors' || kind === 'drivers' ? 'Ver trabalhos' : 'Ver informações'} onPress={() => router.push({
        pathname: '/(cooperativa)/' + directoryPaths[kind] + '/[id]' as any,
        params: {
          id: item.id
        }
      })} />{kind === 'drivers' && <FieldButton label="Localização do motorista" icon="navigate-outline" onPress={() => router.push({
        pathname: '/(cooperativa)/motoristas/localizacao' as any,
        params: {
          id: item.id
        }
      })} />}</View>)}{data.data && !data.data.items.length && <Text style={ui.muted}>Nenhum cadastro encontrado.</Text>}<Pager pagination={data.data?.pagination} onPage={setPage} /></FieldPage>;
}
