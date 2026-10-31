import { useCallback, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Linking, Text, View } from 'react-native';
import { fieldService, fieldLabels, fieldDate, fieldAddress, fieldTitle, fieldQuantity, fieldDocument, type FieldKind, type FieldWork } from '@/src/services/cooperativeFieldService';
import { FieldPage, FieldButton, LoadState, Pager, ui, useFieldData } from '@/src/components/cooperative/FieldUI';
export function WorkCard({
  work: c,
  kind,
  entityId
}: {
  work: FieldWork;
  kind: FieldKind;
  entityId: string;
}) {
  const participant = kind === 'collectors' && c.participants.length > 0;
  return <View style={ui.card}><Text style={ui.heading}>{c.generator?.name || c.bin?.name || c.routePoint?.name || 'Coleta avulsa'}</Text><Text style={ui.small}>Coleta #{c.id.slice(-8).toUpperCase()}</Text><Text style={ui.badge}>{fieldLabels[c.status] || c.status}</Text><Text style={ui.body}>{c.route?.name || 'Coleta individual'} · {fieldDate(c.schedule?.scheduledDate || c.route?.scheduledDate || c.collectedAt || c.createdAt)}</Text><Text style={ui.muted}>{[c.collector?.name, c.driver?.name, c.vehicle?.plate].filter(Boolean).join(' · ') || 'Equipe a definir'}</Text>{participant && <Text style={ui.muted}>Participação: {c.participants.find(p => p.collectorId === entityId)?.nameSnapshot || 'Equipe da coleta'}. Quantidades abaixo são da coleta; consulte o relatório de equipe para a divisão individual.</Text>}{c.collectionMaterials.map(m => <Text key={m.id} style={ui.body}>{m.nameSnapshot}: {fieldQuantity(m.quantity, m.unit)}</Text>)}{c.cancellationReason && <Text style={ui.body}>Cancelamento: {c.cancellationReason}</Text>}{c.incidents.map(i => <Text key={i.id} style={ui.body}>Ocorrência {fieldLabels[i.status]?.toLowerCase() || i.status}: {i.description}{i.resolution ? ' · ' + i.resolution : ''}</Text>)}{c.notes && <Text style={ui.muted}>{c.notes}</Text>}</View>;
}
export default function EntityDetail({
  kind
}: {
  kind: FieldKind;
}) {
  const p = useLocalSearchParams<{
      id: string;
    }>(),
    id = Array.isArray(p.id) ? p.id[0] : p.id;
  const [filter, setFilter] = useState('all'),
    [page, setPage] = useState(1);
  const result = useFieldData(useCallback(() => fieldService.detail(kind, id, filter, page), [kind, id, filter, page]));
  const d = result.data,
    item = d?.item;
  const [actionError, setActionError] = useState('');
  async function navigate() {
    try {
      if (item?.latitude == null || item.longitude == null) throw Error("Local sem coordenadas confirmadas.");
      await Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${item.latitude},${item.longitude}&travelmode=driving`);
    } catch (e: any) {
      setActionError(e.message || "Não foi possível abrir a navegação.");
    }
  }
  async function phone() {
    try {
      if (item?.phone) await Linking.openURL('tel:' + item.phone.replace(/[^\d+]/g, ''));
    } catch {
      setActionError('Não foi possível abrir o telefone neste dispositivo.');
    }
  }
  return <FieldPage title={item ? fieldTitle(item) : 'Informações'} subtitle="Cadastro, atendimentos e pendências da cooperativa."><LoadState resource={result} />{actionError && <Text accessibilityRole="alert">{actionError}</Text>}{item && <><View style={ui.card}><Text style={ui.badge}>{fieldLabels[item.status || item.accessStatus || ''] || 'Cadastro ativo'}</Text>{kind === 'generators' && <Text style={ui.body}>{item.type === 'LARGE' ? 'Grande gerador' : item.documentNumber?.length === 11 ? 'Gerador residencial cadastrado' : item.documentNumber ? 'Pequeno gerador' : 'Pequeno gerador · documento pendente'}</Text>}{item.documentNumber && <Text style={ui.body}>CPF/CNPJ: {fieldDocument(item.documentNumber)}</Text>}{(kind === 'generators' || kind === 'pevs') && <Text style={ui.body}>{fieldAddress(item)}</Text>}{item.email && <Text style={ui.body}>{item.email}</Text>}{item.phone && <FieldButton secondary label={'Ligar: ' + item.phone} onPress={() => void phone()} />}<View style={ui.row}>{kind === 'drivers' && <FieldButton label="Localização do motorista" icon="navigate-outline" onPress={() => router.push({
            pathname: '/(cooperativa)/motoristas/localizacao' as any,
            params: {
              id
            }
          })} />} {(kind === 'generators' || kind === 'pevs') && <FieldButton secondary label="Localizar no mapa" onPress={() => router.push({
            pathname: '/(cooperativa)/field-map' as any,
            params: {
              kind,
              id
            }
          })} />}</View>{(kind === 'generators' || kind === 'pevs') && <FieldButton secondary label="Navegar até o local" disabled={item.latitude == null || item.longitude == null} onPress={() => void navigate()} />}{item.needsPickup && <Text style={ui.badge}>PEV necessita de retirada.</Text>}{item.acceptedMaterials?.length ? <Text style={ui.body}>Materiais aceitos: {item.acceptedMaterials.join(', ')}</Text> : null}{item.restrictions && <Text style={ui.body}>Orientações: {item.restrictions}</Text>}</View><View style={ui.card}><Text style={ui.heading}>Acompanhamento</Text><Text style={ui.body}>{d!.summary.active} em campo · {d!.summary.pending} aguardando saída · {d!.summary.incidents} ocorrência(s) aberta(s)</Text></View>{kind === 'generators' && <View style={ui.card}><Text style={ui.heading}>Solicitações recentes</Text><Text style={ui.small}>Até 20 solicitações mais recentes.</Text>{d!.requests.map(r => <View key={r.id} style={{
          gap: 4,
          paddingVertical: 8
        }}><Text style={ui.badge}>{fieldLabels[r.status] || r.status} · #{r.id.slice(-8).toUpperCase()}</Text><Text style={ui.body}>{fieldDate(r.scheduledDate || r.preferredDate || r.createdAt)}</Text>{r.notes && <Text style={ui.muted}>{r.notes}</Text>}</View>)}{!d!.requests.length && <Text style={ui.muted}>Nenhuma solicitação registrada.</Text>}</View>}<Text style={ui.heading}>{kind === 'collectors' || kind === 'drivers' ? 'Trabalhos' : 'Coletas e atendimentos'}</Text><View style={ui.row}>{[['all', 'Todos'], ['active', 'Em campo'], ['pending', 'Pendências'], ['completed', 'Realizados']].map(([v, l]) => <FieldButton key={v} secondary={filter !== v} label={l} onPress={() => {
          setFilter(v);
          setPage(1);
        }} />)}</View>{d!.collections.map(c => <WorkCard key={c.id} kind={kind} entityId={id} work={c} />)}{!d!.collections.length && <Text style={ui.muted}>Nenhum trabalho nesta situação.</Text>}<Pager pagination={d!.pagination} onPage={setPage} /></>}</FieldPage>;
}
