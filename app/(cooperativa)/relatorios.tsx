import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { api } from '@/src/services/api';
import { FieldPage, FieldButton, FieldInput, LoadState, Pager, ui, useFieldData } from '@/src/components/cooperative/FieldUI';
import { fieldDate, fieldQuantity } from '@/src/services/cooperativeFieldService';
const options = [['overview', 'Visão geral'], ['collections', 'Coletas'], ['waste', 'Materiais coletados'], ['staff', 'Catadores'], ['drivers', 'Motoristas'], ['vehicles', 'Veículos'], ['stock', 'Estoque atual'], ['destinations', 'Destinações']] as const;
const today = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Fortaleza',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
}).format(new Date());
const toIso = (v: string) => {
  const m = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) throw Error('Informe as datas no formato dd/mm/aaaa.');
  const key = `${m[3]}-${m[2]}-${m[1]}`;
  if (!Number.isFinite(Date.parse(key)) || new Date(key).toISOString().slice(0, 10) !== key) throw Error('Data inválida.');
  return key;
};
export default function Reports() {
  const day = today(),
    [from, setFrom] = useState('01/' + day.slice(5, 7) + '/' + day.slice(0, 4)),
    [to, setTo] = useState(day.split('-').reverse().join('/')),
    [filter, setFilter] = useState({
      from: day.slice(0, 7) + '-01',
      to: day
    }),
    [kind, setKind] = useState(''),
    [page, setPage] = useState(1),
    [error, setError] = useState('');
  const data = useFieldData(useCallback(async () => {
    if (!kind) return null;
    const type = ['stock', 'destinations'].includes(kind) ? 'waste' : kind === 'drivers' ? 'staff' : kind;
    const q = new URLSearchParams({
      start: filter.from,
      end: filter.to,
      page: String(page),
      pageSize: '20',
      dateBasis: 'collectedAt',
      ...(kind === 'staff' ? {
        role: 'COLLECTOR'
      } : {}),
      ...(kind === 'drivers' ? {
        role: 'DRIVER'
      } : {}),
      ...(kind === 'stock' ? {
        stage: 'STOCK'
      } : kind === 'destinations' ? {
        stage: 'DESTINED'
      } : {})
    });
    return api.get<{
      data: any;
    }>('/reports/' + type + '?' + q, true);
  }, [kind, filter, page]));
  const report = data.data?.data;
  const units = (v: Record<string, number> | undefined) => Object.entries(v || {}).filter(([, n]) => Number(n) > 0).map(([u, n]) => fieldQuantity(n, u)).join(' · ') || 'Sem quantidade registrada';
  return <FieldPage title="Relatórios e análises" subtitle="Escolha o relatório e o período que deseja consultar."><View style={ui.card}><FieldInput label="Data inicial (dd/mm/aaaa)" value={from} onChangeText={v => setFrom(v.replace(/\D/g, '').slice(0, 8).replace(/^(\d{2})(\d)/, '$1/$2').replace(/^(\d{2})\/(\d{2})(\d)/, '$1/$2/$3'))} keyboardType="numbers-and-punctuation" maxLength={10} /><FieldInput label="Data final (dd/mm/aaaa)" value={to} onChangeText={v => setTo(v.replace(/\D/g, '').slice(0, 8).replace(/^(\d{2})(\d)/, '$1/$2').replace(/^(\d{2})\/(\d{2})(\d)/, '$1/$2/$3'))} keyboardType="numbers-and-punctuation" maxLength={10} /><FieldButton label="Aplicar período" onPress={() => {
        try {
          const a = toIso(from),
            b = toIso(to);
          if (a > b || Date.parse(b) - Date.parse(a) > 365 * 86400000) throw Error('Escolha um período de até 366 dias, em ordem crescente.');
          setFilter({
            from: a,
            to: b
          });
          setPage(1);
          setError('');
        } catch (e: any) {
          setError(e.message);
        }
      }} /></View><View style={ui.row}>{options.map(([v, l]) => <FieldButton key={v} label={l} secondary={kind !== v} onPress={() => {
        setKind(v);
        setPage(1);
      }} />)}</View>{!!error && <Text accessibilityRole="alert" style={{
      color: '#B42318'
    }}>{error}</Text>}<LoadState resource={data} />{report && <><View style={ui.card}><Text style={ui.heading}>{options.find(([v]) => v === kind)?.[1]}</Text><Text style={ui.muted}>{kind === 'stock' ? 'Saldo atual de estoque; o período não representa um saldo histórico.' : `${filter.from.split('-').reverse().join('/')} a ${filter.to.split('-').reverse().join('/')} · referência: ${kind === 'destinations' ? 'destinação' : 'coleta em campo'}`}</Text><Text style={ui.body}>{report.meta.total} registro(s){report.summary.executed !== undefined ? ' · ' + report.summary.executed + ' coleta(s) realizada(s)' : ''}</Text><Text style={ui.heading}>{units(report.summary.units)}</Text><Text style={ui.small}>Atualizado em {fieldDate(report.meta.generatedAt)}</Text>{report.meta.warnings?.map((w: string, n: number) => <Text key={n} style={ui.muted}>{w}</Text>)}</View>{kind === 'overview' && <><View style={ui.card}><Text style={ui.heading}>Situação das coletas</Text>{report.statusCounts.map((v: any) => <View key={v.key} style={{
            gap: 5
          }}><Text style={ui.body}>{v.name}: {v.count}</Text><View style={{
              height: 8,
              backgroundColor: '#E7EFEA',
              borderRadius: 4
            }}><View style={{
                height: 8,
                borderRadius: 4,
                backgroundColor: '#087B55',
                width: Math.max(0, Math.min(100, v.count / Math.max(1, report.summary.records) * 100)) + '%' as `${number}%`
              }} /></View></View>)}</View><View style={ui.card}><Text style={ui.heading}>Materiais no período</Text><Text style={ui.small}>Barras comparadas apenas entre materiais da mesma unidade.</Text>{report.materialTotals.map((v: any, n: number) => <View key={v.id + '-' + v.unit + '-' + n} style={{
            gap: 5
          }}><Text style={ui.body}>{v.name} · {fieldQuantity(v.quantity, v.unit)}</Text><View style={{
              height: 8,
              backgroundColor: '#E7EFEA',
              borderRadius: 4
            }}><View style={{
                height: 8,
                borderRadius: 4,
                backgroundColor: '#087B55',
                width: Math.max(0, Math.min(100, v.quantity / Math.max(1, ...report.materialTotals.filter((m: any) => m.unit === v.unit).map((m: any) => m.quantity)) * 100)) + '%' as `${number}%`
              }} /></View></View>)}</View></>}{report.rows.map((r: any) => <View key={r.id} style={ui.card}><Text style={ui.heading}>{r.name || 'Registro'}</Text><Text style={ui.badge}>{r.status}</Text>{r.role && <Text style={ui.body}>{r.role}</Text>}<Text style={ui.body}>{units(r.units)}</Text>{r.count != null && <Text style={ui.body}>{r.count} coleta(s) realizada(s) · {r.routes} rota(s)</Text>}{r.date && <Text style={ui.muted}>{fieldDate(r.date)}</Text>}{[r.collector, r.driver, r.vehicle].some(Boolean) && <Text style={ui.muted}>{[r.collector, r.driver, r.vehicle].filter(Boolean).join(' · ')}</Text>}{r.destinationName && <Text style={ui.body}>Destino: {r.destinationName}</Text>}{r.lotCode && <Text style={ui.small}>{r.lotCode}</Text>}</View>)}{!report.rows.length && <Text style={ui.muted}>Nenhum registro no período selecionado.</Text>}<Pager pagination={{
        page,
        total: report.meta.total,
        totalPages: Math.max(1, Math.ceil(report.meta.total / 20))
      }} onPage={setPage} /></>}</FieldPage>;
}
